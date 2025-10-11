'use client';

import { io, Socket } from 'socket.io-client';
import type { RealtimeClient, RealtimeEnvelope, RealtimeHandlers } from './types';

export interface SocketIOClientOptions {
  endpoint?: string;
}

export const createWebSocketClient = ({
  endpoint = '/api/socketio',
}: SocketIOClientOptions = {}): RealtimeClient => {
  let socket: Socket | null = null;
  let currentHandlers: RealtimeHandlers | null = null;
  let currentSessionId: string | null = null;
  let currentToken: string | null = null;

  const connect: RealtimeClient['connect'] = (sessionId, joinToken, handlers) => {
    currentHandlers = handlers;
    currentSessionId = sessionId;
    currentToken = joinToken;

    // Create Socket.IO client
    socket = io({
      path: endpoint,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('Socket.IO connected:', socket?.id);
      
      // Join the session
      socket?.emit('join_session', { sessionId, joinToken });
      
      currentHandlers?.onOpen();
    });

    socket.on('message', (envelope: RealtimeEnvelope) => {
      try {
        currentHandlers?.onMessage(envelope);
      } catch (error) {
        currentHandlers?.onError(error instanceof Error ? error : new Error('Invalid message payload'));
      }
    });

    socket.on('error', (data: { message: string }) => {
      console.error('Socket.IO error:', data);
      const error = new Error(data.message || 'Socket.IO error');
      currentHandlers?.onError(error);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected:', reason);
      currentHandlers?.onClose();
    });

    socket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
      currentHandlers?.onError(error);
    });
  };

  const disconnect: RealtimeClient['disconnect'] = () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    currentSessionId = null;
    currentToken = null;
  };

  const send: RealtimeClient['send'] = (message) => {
    if (!socket || !socket.connected) {
      throw new Error('Socket.IO is not connected.');
    }
    socket.emit('message', message);
  };

  const isConnected: RealtimeClient['isConnected'] = () => socket?.connected ?? false;

  return {
    connect,
    disconnect,
    send,
    isConnected,
  };
};
