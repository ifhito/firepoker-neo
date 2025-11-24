import type { NextApiRequest, NextApiResponse } from 'next';
import type { Server as HTTPServer } from 'http';
import type { Socket as NetSocket } from 'net';
import { Server as SocketIOServer } from 'socket.io';
import { getSessionRecord, getSessionJoinToken, updateSessionState } from '@/server/session/store';
import {
  getSessionState,
  finalizeSession,
  updateSessionPbis,
  selectActivePbi,
  delegateFacilitator,
  registerParticipant,
} from '@/server/session/service';
import type { RealtimeEnvelope } from '@/client/realtime/types';
import { HttpError } from '@/server/http/error';

export const config = {
  api: {
    bodyParser: false,
  },
};

interface SocketServer extends HTTPServer {
  io?: SocketIOServer;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

const sessionUserConnections = new Map<string, Map<string, number>>();

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
        
        // 全参加者が投票済みか確認
        const allParticipants = state.participants.map(p => p.userId);
        const votedParticipants = Object.keys(state.votes).filter(
          uid => state.votes[uid] !== null && state.votes[uid] !== undefined
        );
        
        // 全員が投票済みの場合、自動的にREVEALフェーズに移行
        if (allParticipants.length > 0 && 
            allParticipants.every(uid => votedParticipants.includes(uid))) {
          console.log('All participants voted, auto-revealing results');
          state.phase = 'REVEAL';
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
      const payload = (message.payload ?? {}) as {
        finalPoint?: number;
        memo?: string | null;
        userId?: string;
      };
      if (typeof payload.finalPoint !== 'number') {
        throw new HttpError(400, 'ValidationError', 'finalPoint is required');
      }
      if (!payload.userId) {
        throw new HttpError(400, 'ValidationError', 'userId is required');
      }
      const record = await getSessionRecord(sessionId);
      if (!record) {
        throw new HttpError(404, 'NotFound', 'Session not found');
      }
      if (record.state.meta.facilitatorId !== payload.userId) {
        throw new HttpError(403, 'Unauthorized', 'Only facilitator can finalize');
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

export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (res.socket.server.io) {
    console.log('Socket.io already initialized');
    res.status(200).json({ success: true, message: 'Socket.io already initialized' });
    return;
  }

  console.log('Initializing Socket.io server...');

  const io = new SocketIOServer(res.socket.server, {
    path: '/api/socketio',
    addTrailingSlash: false,
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  res.socket.server.io = io;

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on(
      'join_session',
      async (data: { sessionId: string; joinToken: string; userId?: string; displayName?: string }) => {
        try {
        const { sessionId, joinToken, userId, displayName } = data;

        if (!sessionId || !joinToken) {
          socket.emit('error', { message: 'sessionId and token required' });
          socket.disconnect();
          return;
        }

        if (!userId) {
          socket.emit('error', { message: 'userId required' });
          socket.disconnect();
          return;
        }

        const record = await getSessionRecord(sessionId);
        if (!record) {
          console.warn('Socket.io connection rejected: session not found', { sessionId });
          socket.emit('error', { message: 'session not found' });
          socket.disconnect();
          return;
        }

        const token = await getSessionJoinToken(sessionId);
        if (token && token !== joinToken) {
          console.warn('Socket.io connection rejected: invalid token', { sessionId });
          socket.emit('error', { message: 'invalid token' });
          socket.disconnect();
          return;
        }

        const normalizedName =
          (typeof displayName === 'string' && displayName.trim().length > 0
            ? displayName.trim()
            : undefined) ?? userId;

        const updatedState = await registerParticipant(sessionId, joinToken, {
          userId,
          displayName: normalizedName,
        });

        // Join the session room
        socket.join(sessionId);
        console.info('Client joined session:', { socketId: socket.id, sessionId, userId });

        socket.data.sessionId = sessionId;
        socket.data.joinToken = joinToken;
        socket.data.userId = userId;
        socket.data.displayName = normalizedName;

        let userConnections = sessionUserConnections.get(sessionId);
        if (!userConnections) {
          userConnections = new Map();
          sessionUserConnections.set(sessionId, userConnections);
        }
        userConnections.set(userId, (userConnections.get(userId) ?? 0) + 1);

        // Send initial state
        const state = updatedState ?? (await getSessionState(sessionId));
        const envelope: RealtimeEnvelope = {
          sessionId,
          event: 'state_sync',
          payload: state,
          version: Date.now(),
        };
        socket.emit('message', envelope);

        if (updatedState) {
          socket.to(sessionId).emit('message', {
            sessionId,
            event: 'state_sync',
            payload: updatedState,
            version: Date.now(),
          });
        }

        // Handle incoming messages
        socket.on('message', async (message: RealtimeEnvelope) => {
          try {
            console.log('Received message:', message.event, 'from', socket.id);
            await handleMessage(sessionId, joinToken, message);

            // Broadcast updated state to all clients in the session
            const updatedState = await getSessionState(sessionId);
            const updateEnvelope: RealtimeEnvelope = {
              sessionId,
              event: 'state_sync',
              payload: updatedState,
              version: Date.now(),
            };
            io.to(sessionId).emit('message', updateEnvelope);
          } catch (error) {
            console.error('Message handling error:', error);
            const errorEnvelope: RealtimeEnvelope = {
              sessionId,
              event: 'error',
              payload: {
                message: error instanceof Error ? error.message : 'Message processing failed',
              },
            };
            socket.emit('message', errorEnvelope);
          }
        });

        socket.on('disconnect', async () => {
          console.info('Client disconnected:', socket.id);

          const disconnectedSessionId = socket.data.sessionId as string | undefined;
          const disconnectedUserId = socket.data.userId as string | undefined;

          if (!disconnectedSessionId || !disconnectedUserId) {
            return;
          }

          try {
            const userConnections = sessionUserConnections.get(disconnectedSessionId);
            if (userConnections) {
              const nextCount = (userConnections.get(disconnectedUserId) ?? 0) - 1;
              if (nextCount > 0) {
                userConnections.set(disconnectedUserId, nextCount);
                return;
              }
              userConnections.delete(disconnectedUserId);
              if (userConnections.size === 0) {
                sessionUserConnections.delete(disconnectedSessionId);
              }
            }

            const updated = await updateSessionState(disconnectedSessionId, (state) => {
              const beforeCount = state.participants.length;
              state.participants = state.participants.filter(
                (participant) => participant.userId !== disconnectedUserId,
              );
              if (beforeCount !== state.participants.length) {
                if (state.meta.facilitatorId === disconnectedUserId) {
                  const fallback = state.participants[0]?.userId;
                  if (fallback) {
                    state.meta.facilitatorId = fallback;
                  }
                }
              }
              delete state.votes[disconnectedUserId];
            });

            if (updated) {
              const updateEnvelope: RealtimeEnvelope = {
                sessionId: disconnectedSessionId,
                event: 'state_sync',
                payload: updated.state,
                version: Date.now(),
              };
              io.to(disconnectedSessionId).emit('message', updateEnvelope);
            }
          } catch (disconnectError) {
            console.error('Failed to process disconnect cleanup:', disconnectError);
          }
        });
      } catch (error) {
        console.error('Connection setup error:', error);
        const message =
          error instanceof HttpError && typeof error.message === 'string'
            ? error.message
            : 'Internal server error';
        socket.emit('error', { message });
        socket.disconnect();
      }
    });
  });

  console.log('Socket.io server initialized');
  res.status(200).json({ success: true, message: 'Socket.io server initialized' });
}
