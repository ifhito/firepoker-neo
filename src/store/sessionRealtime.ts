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
  connect: (client: RealtimeClient, sessionId: string, joinToken: string) => void;
  disconnect: () => void;
  handleMessage: (message: RealtimeEnvelope) => void;
  sendVote: (point: number) => void;
  requestReveal: () => void;
  resetVotes: () => void;
  finalize: (finalPoint: number, memo?: string | null) => void;
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
  connect: (client, sessionId, joinToken) => {
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
  disconnect: () => {
    const { client } = get();
    client?.disconnect();
    set({ connectionStatus: 'disconnected', client: null });
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
    const { client, session } = get();
    if (!client || !session) return;
    client.send({
      ...defaultEnvelope(session.meta.sessionId),
      event: 'vote_cast',
      payload: { point },
    });
  },
  requestReveal: () => {
    const { client, session } = get();
    if (!client || !session) return;
    client.send({
      ...defaultEnvelope(session.meta.sessionId),
      event: 'reveal_request',
      payload: {},
    });
  },
  resetVotes: () => {
    const { client, session } = get();
    if (!client || !session) return;
    client.send({
      ...defaultEnvelope(session.meta.sessionId),
      event: 'reset_votes',
      payload: {},
    });
  },
  finalize: (finalPoint, memo) => {
    const { client, session } = get();
    if (!client || !session) return;
    client.send({
      ...defaultEnvelope(session.meta.sessionId),
      event: 'finalize_point',
      payload: { finalPoint, memo: memo ?? null },
    });
  },
}));
