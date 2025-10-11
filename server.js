const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');
const { getSessionRecord, getSessionJoinToken, updateSessionState } = require('./dist/server/session/store');
const { getSessionState, finalizeSession, updateSessionPbis, selectActivePbi } = require('./dist/server/session/service');
const { HttpError } = require('./dist/server/http/error');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const sessionConnections = new Map();

const handleMessage = async (sessionId, joinToken, message) => {
  switch (message.event) {
    case 'ping':
      return;
    case 'vote_cast': {
      const { userId, point } = message.payload ?? {};
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
      const { pbiId } = message.payload ?? {};
      if (!pbiId) {
        throw new HttpError(400, 'ValidationError', 'pbi_add requires pbiId');
      }
      await updateSessionPbis(sessionId, joinToken, 'add', pbiId);
      return;
    }
    case 'pbi_remove': {
      const { pbiId } = message.payload ?? {};
      if (!pbiId) {
        throw new HttpError(400, 'ValidationError', 'pbi_remove requires pbiId');
      }
      await updateSessionPbis(sessionId, joinToken, 'remove', pbiId);
      return;
    }
    case 'pbi_set_active': {
      const { pbiId } = message.payload ?? {};
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
      const payload = message.payload ?? {};
      if (typeof payload.finalPoint !== 'number') {
        throw new HttpError(400, 'ValidationError', 'finalPoint is required');
      }
      await finalizeSession(sessionId, {
        finalPoint: payload.finalPoint,
        memo: payload.memo,
      });
      return;
    }
    default:
      return;
  }
};

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url);

    if (pathname === '/api/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', async (socket, request) => {
    try {
      const url = new URL(request.url, 'http://localhost');
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

      let connections = sessionConnections.get(sessionId);
      if (!connections) {
        connections = new Set();
        sessionConnections.set(sessionId, connections);
      }
      connections.add(socket);

      const broadcastState = async () => {
        try {
          const state = await getSessionState(sessionId);
          const envelope = {
            sessionId,
            event: 'state_sync',
            payload: state,
            version: Date.now(),
          };
          const data = JSON.stringify(envelope);

          for (const client of connections) {
            if (client.readyState === 1) { // WebSocket.OPEN
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
          const message = JSON.parse(raw.toString());
          console.log('Received message:', message.event);
          await handleMessage(sessionId, joinToken, message);
          await broadcastState();
        } catch (error) {
          console.error('Message handling error:', error);
          const envelope = {
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
        connections.delete(socket);
        if (connections.size === 0) {
          sessionConnections.delete(sessionId);
        }
      });

      socket.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    } catch (error) {
      console.error('Connection setup error:', error);
      socket.close(4500, 'Internal server error');
    }
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
