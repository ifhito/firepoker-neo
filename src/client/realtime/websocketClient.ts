'use client';

import type { RealtimeClient, RealtimeEnvelope, RealtimeHandlers } from './types';

export interface WebSocketClientOptions {
  endpoint: string;
  protocol?: string;
  WebSocketImpl?: typeof WebSocket;
}

export const createWebSocketClient = ({
  endpoint,
  protocol = 'wss',
  WebSocketImpl = WebSocket,
}: WebSocketClientOptions): RealtimeClient => {
  let socket: WebSocket | null = null;
  let currentHandlers: RealtimeHandlers | null = null;
  let currentSessionId: string | null = null;
  let currentToken: string | null = null;

  const createUrl = (sessionId: string, token: string) => {
    const url = new URL(endpoint);
    url.protocol = protocol;
    url.searchParams.set('sessionId', sessionId);
    url.searchParams.set('token', token);
    return url.toString();
  };

  const connect: RealtimeClient['connect'] = (sessionId, joinToken, handlers) => {
    currentHandlers = handlers;
    currentSessionId = sessionId;
    currentToken = joinToken;

    const url = createUrl(sessionId, joinToken);
    const ws = new WebSocketImpl(url);
    socket = ws;

    ws.addEventListener('open', () => {
      currentHandlers?.onOpen();
    });

    ws.addEventListener('message', (event) => {
      try {
        const data = typeof event.data === 'string' ? event.data : event.data.toString();
        const envelope = JSON.parse(data) as RealtimeEnvelope;
        currentHandlers?.onMessage(envelope);
      } catch (error) {
        currentHandlers?.onError(error instanceof Error ? error : new Error('Invalid message payload'));
      }
    });

    ws.addEventListener('error', (event) => {
      const error =
        event instanceof ErrorEvent
          ? new Error(event.message || 'WebSocket error')
          : new Error('WebSocket error');
      currentHandlers?.onError(error);
    });

    ws.addEventListener('close', () => {
      currentHandlers?.onClose();
    });
  };

  const disconnect: RealtimeClient['disconnect'] = () => {
    if (socket) {
      socket.close();
      socket = null;
    }
    currentSessionId = null;
    currentToken = null;
  };

  const send: RealtimeClient['send'] = (message) => {
    if (!socket || socket.readyState !== WebSocketImpl.OPEN) {
      throw new Error('WebSocket is not connected.');
    }
    socket.send(JSON.stringify(message));
  };

  const isConnected: RealtimeClient['isConnected'] = () => socket?.readyState === WebSocketImpl.OPEN;

  return {
    connect,
    disconnect,
    send,
    isConnected,
  };
};
