import type { NextApiRequest, NextApiResponse } from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import { getSessionRecord, getSessionJoinToken, updateSessionState } from '@/server/session/store';
import {
  getSessionState,
  finalizeSession,
  updateSessionPbis,
  selectActivePbi,
  delegateFacilitator,
} from '@/server/session/service';
import type { RealtimeEnvelope } from '@/client/realtime/types';
import { HttpError } from '@/server/http/error';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';

export const config = {
  api: {
    bodyParser: false,
  },
};

type SessionConnections = Map<string, Set<WebSocket>>;

type ExtendedServer = {
  wss?: WebSocketServer;
  websocketSessions?: SessionConnections;
};

const getOrCreateWebSocketServer = (res: NextApiResponse): ExtendedServer => {
  const server = (res.socket as any)?.server as ExtendedServer | undefined;
  
  if (!server) {
    throw new Error('Server not available');
  }

  if (!server.websocketSessions) {
    server.websocketSessions = new Map();
  }

  if (!server.wss) {
    console.log('Initializing WebSocket server...');
    server.wss = new WebSocketServer({ noServer: true });

    // Handle upgrade requests
    const httpServer = (res.socket as any).server;
    if (httpServer && !httpServer._wsUpgradeListenerAdded) {
      httpServer._wsUpgradeListenerAdded = true;
      
      httpServer.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
        const pathname = request.url?.split('?')[0];
        
        if (pathname === '/api/ws') {
          server.wss!.handleUpgrade(request, socket, head, (ws) => {
            server.wss!.emit('connection', ws, request);
          });
        }
      });
    }

    server.wss.on('connection', (socket: WebSocket, request: IncomingMessage) => {
      void (async () => {
        try {
          const url = new URL(request.url ?? '', 'http://localhost');
          const sessionId = url.searchParams.get('sessionId');
          const joinToken = url.searchParams.get('token');

          if (!sessionId || !joinToken) {
            console.warn('ws connection rejected: missing parameters');
            socket.close(4001, 'sessionId and token required');
            return;
          }

          const record = await getSessionRecord(sessionId);
          if (!record) {
            console.warn('ws connection rejected: session not found', { sessionId });
            socket.close(4404, 'session not found');
            return;
          }

          const token = await getSessionJoinToken(sessionId);
          if (token && token !== joinToken) {
            console.warn('ws connection rejected: invalid token', { sessionId });
            socket.close(4403, 'invalid token');
            return;
          }

          console.info('ws connection accepted', { sessionId });

          let connections = server.websocketSessions!.get(sessionId);
          if (!connections) {
            connections = new Set();
            server.websocketSessions!.set(sessionId, connections);
          }
          connections.add(socket);

          const broadcastState = async () => {
            try {
              const state = await getSessionState(sessionId);
              const envelope: RealtimeEnvelope = {
                sessionId,
                event: 'state_sync',
                payload: state,
                version: Date.now(),
              };
              const data = JSON.stringify(envelope);
              
              for (const client of connections!) {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(data);
                }
              }
            } catch (error) {
              console.error('Failed to broadcast state:', error);
            }
          };

          // Send initial state
          await broadcastState();

          socket.on('message', async (raw) => {
            try {
              const message = JSON.parse(raw.toString()) as RealtimeEnvelope;
              console.log('Received message:', message.event);
              await handleMessage(sessionId, joinToken, message);
              await broadcastState();
            } catch (error) {
              console.error('Message handling error:', error);
              const envelope: RealtimeEnvelope = {
                sessionId,
                event: 'error',
                payload: {
                  message: error instanceof Error ? error.message : 'WebSocket message failed',
                },
              };
              socket.send(JSON.stringify(envelope));
            }
          });

          socket.on('close', () => {
            console.info('ws connection closed', { sessionId });
            connections!.delete(socket);
            if (connections!.size === 0) {
              server.websocketSessions!.delete(sessionId);
            }
          });

          socket.on('error', (error) => {
            console.error('WebSocket error:', error);
          });
        } catch (error) {
          console.error('Connection setup error:', error);
          socket.close(4500, 'Internal server error');
        }
      })();
    });
  }

  return server;
};

const handleMessage = async (sessionId: string, joinToken: string, message: RealtimeEnvelope) => {
  switch (message.event) {
    case 'ping':
      return;
    case 'vote_cast': {
      const { userId, point } = (message.payload ?? {}) as { userId?: string; point?: number };
      if (!userId || typeof point !== 'number') {
        throw new HttpError(400, 'ValidationError', 'vote_cast requires userId and point');
      }
      const record = await updateSessionState(sessionId, (state) => {
        state.votes[userId] = point;
        if (state.phase === 'READY') {
          state.phase = 'VOTING';
        }
      });
      if (!record) throw new HttpError(404, 'NotFound', 'Session not found');
      return;
    }
    case 'pbi_add': {
      const { pbiId } = (message.payload ?? {}) as { pbiId?: string };
      if (!pbiId) {
        throw new HttpError(400, 'ValidationError', 'pbi_add requires pbiId');
      }
      await updateSessionPbis(sessionId, joinToken, 'add', pbiId);
      return;
    }
    case 'pbi_remove': {
      const { pbiId } = (message.payload ?? {}) as { pbiId?: string };
      if (!pbiId) {
        throw new HttpError(400, 'ValidationError', 'pbi_remove requires pbiId');
      }
      await updateSessionPbis(sessionId, joinToken, 'remove', pbiId);
      return;
    }
    case 'pbi_set_active': {
      const { pbiId } = (message.payload ?? {}) as { pbiId?: string };
      if (!pbiId) {
        throw new HttpError(400, 'ValidationError', 'pbi_set_active requires pbiId');
      }
      await selectActivePbi(sessionId, joinToken, pbiId);
      return;
    }
    case 'reveal_request': {
      const record = await updateSessionState(sessionId, (state) => {
        state.phase = 'REVEAL';
      });
      if (!record) throw new HttpError(404, 'NotFound', 'Session not found');
      return;
    }
    case 'reset_votes': {
      const record = await updateSessionState(sessionId, (state) => {
        Object.keys(state.votes).forEach((key) => {
          state.votes[key] = null;
        });
        state.phase = 'VOTING';
      });
      if (!record) throw new HttpError(404, 'NotFound', 'Session not found');
      return;
    }
    case 'finalize_point': {
      const payload = (message.payload ?? {}) as { finalPoint?: number; memo?: string | null };
      if (typeof payload.finalPoint !== 'number') {
        throw new HttpError(400, 'ValidationError', 'finalPoint is required');
      }
      await finalizeSession(sessionId, {
        finalPoint: payload.finalPoint,
        memo: payload.memo,
      });
      return;
    }
    case 'delegate_facilitator': {
      const payload = (message.payload ?? {}) as { userId?: string; delegateTo?: string };
      if (!payload.userId || !payload.delegateTo) {
        throw new HttpError(400, 'ValidationError', 'userId and delegateTo are required');
      }
      await delegateFacilitator(sessionId, payload.userId, payload.delegateTo);
      return;
    }
    default:
      return;
  }
};

export default function websocketHandler(req: NextApiRequest, res: NextApiResponse) {
  try {
    getOrCreateWebSocketServer(res);
    res.status(200).send('WebSocket server ready');
  } catch (error) {
    console.error('Failed to initialize WebSocket server:', error);
    res.status(500).send('Failed to initialize WebSocket server');
  }
}
