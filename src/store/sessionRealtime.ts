'use client';

import { create } from 'zustand';
import type { SessionState } from '@/domain/session';
import type { RealtimeClient, RealtimeEnvelope } from '@/client/realtime/types';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

interface SessionRealtimeStore {
  connectionStatus: ConnectionStatus;
  lastError?: string;
  session: SessionState | null;
  client: RealtimeClient | null;
  currentUserId: string | null;
  localVote: number | null;
  connect: (client: RealtimeClient, sessionId: string, joinToken: string, userId: string) => void;
  setCurrentUser: (userId: string) => void;
  setSessionSnapshot: (session: SessionState) => void;
  disconnect: () => void;
  handleMessage: (message: RealtimeEnvelope) => void;
  sendVote: (point: number) => void;
  requestReveal: () => void;
  resetVotes: () => void;
  finalize: (finalPoint: number, memo?: string | null) => void;
  setLocalVote: (point: number) => void;
  clearLocalVote: () => void;
  addSessionPbi: (pbiId: string) => void;
  removeSessionPbi: (pbiId: string) => void;
  setActivePbi: (pbiId: string) => void;
}

const defaultEnvelope = (sessionId: string) => ({
  sessionId,
  version: Date.now(),
  nonce: crypto.randomUUID(),
});

export const useSessionRealtimeStore = create<SessionRealtimeStore>((set, get) => ({
  connectionStatus: 'idle',
  session: null,
  client: null,
  currentUserId: null,
  localVote: null,
  connect: (client, sessionId, joinToken, userIdOverride) => {
    const userId = userIdOverride ?? get().currentUserId;
    if (!userId) {
      throw new Error('currentUserId is not set');
    }
    const handlers = {
      onOpen: () => set({ connectionStatus: 'connected', lastError: undefined }),
      onClose: () => set({ connectionStatus: 'disconnected' }),
      onError: (error: Error) =>
        set({
          connectionStatus: 'error',
          lastError: error.message ?? 'WebSocket error',
        }),
      onMessage: (message: RealtimeEnvelope) => {
        get().handleMessage(message);
      },
    };

    set({ connectionStatus: 'connecting', client, lastError: undefined });
    client.connect(sessionId, joinToken, handlers);
  },
  setCurrentUser: (userId) => set({ currentUserId: userId }),
  setSessionSnapshot: (session) => set({ session }),
  disconnect: () => {
    const { client } = get();
    client?.disconnect();
    set({ connectionStatus: 'disconnected', client: null, localVote: null });
  },
  handleMessage: (message) => {
    switch (message.event) {
      case 'state_sync':
        set({ session: message.payload as SessionState });
        break;
      case 'finalized':
        set((state) => ({
          session: state.session
            ? {
                ...state.session,
                phase: 'FINALIZED',
              }
            : state.session,
        }));
        break;
      case 'error':
        set({
          connectionStatus: 'error',
          lastError:
            typeof message.payload === 'object' && message.payload !== null && 'message' in message.payload
              ? String((message.payload as { message?: string }).message)
              : 'リアルタイム通信でエラーが発生しました。',
        });
        break;
      default:
        // それ以外のイベントは現在のところストア状態に反映しない
        break;
    }
  },
  sendVote: (point) => {
    set({ localVote: point });
    const { client, session, currentUserId } = get();
    if (!client || !session || !client.isConnected()) {
      set({ lastError: 'WebSocket is not connected.' });
      return;
    }
    if (!currentUserId) return;
    client.send({
      ...defaultEnvelope(session.meta.sessionId),
      event: 'vote_cast',
      payload: { userId: currentUserId, point },
    });
  },
  requestReveal: () => {
    const { client, session, currentUserId } = get();
    if (!client || !session) return;
    if (!currentUserId) return;
    client.send({
      ...defaultEnvelope(session.meta.sessionId),
      event: 'reveal_request',
      payload: { userId: currentUserId },
    });
  },
  resetVotes: () => {
    set({ localVote: null });
    const { client, session, currentUserId } = get();
    if (!client || !session) return;
    if (!currentUserId) return;
    client.send({
      ...defaultEnvelope(session.meta.sessionId),
      event: 'reset_votes',
      payload: { userId: currentUserId },
    });
  },
  finalize: (finalPoint, memo) => {
    const { client, session, currentUserId } = get();
    if (!client || !session) return;
    if (!currentUserId) return;
    client.send({
      ...defaultEnvelope(session.meta.sessionId),
      event: 'finalize_point',
      payload: { finalPoint, memo: memo ?? null, userId: currentUserId },
    });
  },
  setLocalVote: (point) => set({ localVote: point }),
  clearLocalVote: () => set({ localVote: null }),
  addSessionPbi: (pbiId) => {
    const { client, session, currentUserId } = get();
    if (!client || !session || !client.isConnected()) {
      set({ lastError: 'WebSocket is not connected.' });
      throw new Error('WebSocket is not connected.');
    }
    if (!currentUserId) {
      throw new Error('currentUserId is not set');
    }
    client.send({
      ...defaultEnvelope(session.meta.sessionId),
      event: 'pbi_add',
      payload: { userId: currentUserId, pbiId },
    });
  },
  removeSessionPbi: (pbiId) => {
    const { client, session, currentUserId } = get();
    if (!client || !session || !client.isConnected()) {
      set({ lastError: 'WebSocket is not connected.' });
      throw new Error('WebSocket is not connected.');
    }
    if (!currentUserId) {
      throw new Error('currentUserId is not set');
    }
    client.send({
      ...defaultEnvelope(session.meta.sessionId),
      event: 'pbi_remove',
      payload: { userId: currentUserId, pbiId },
    });
  },
  setActivePbi: (pbiId) => {
    const { client, session, currentUserId } = get();
    if (!client || !session || !client.isConnected()) {
      set({ lastError: 'WebSocket is not connected.' });
      throw new Error('WebSocket is not connected.');
    }
    if (!currentUserId) {
      throw new Error('currentUserId is not set');
    }
    client.send({
      ...defaultEnvelope(session.meta.sessionId),
      event: 'pbi_set_active',
      payload: { userId: currentUserId, pbiId },
    });
  },
}));
