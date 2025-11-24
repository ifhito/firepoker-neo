import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionRealtimeStore } from '@/store/sessionRealtime';
import type { RealtimeClient, RealtimeEnvelope, RealtimeHandlers } from '@/client/realtime/types';
import type { SessionState } from '@/domain/session';

class FakeRealtimeClient implements RealtimeClient {
  public handlers: RealtimeHandlers | null = null;
  public sentMessages: RealtimeEnvelope[] = [];
  public connected = false;
  connect = (_sessionId: string, _token: string, handlers: RealtimeHandlers, _userId: string) => {
    this.handlers = handlers;
    this.connected = true;
    handlers.onOpen();
  };
  disconnect = () => {
    this.connected = false;
    this.handlers?.onClose();
  };
  send = (message: RealtimeEnvelope) => {
    this.sentMessages.push(message);
  };
  isConnected = () => this.connected;
}

const demoState: SessionState = {
  meta: {
    sessionId: 'sess_test',
    title: 'Demo',
    facilitatorId: 'fac_demo',
    createdAt: new Date().toISOString(),
    pbiIds: ['pbi_001'],
  },
  phase: 'VOTING',
  votes: {},
  participants: [
    { userId: 'fac_demo', displayName: 'Host User', joinedAt: new Date().toISOString() },
    { userId: 'member_1', displayName: 'Member 1', joinedAt: new Date().toISOString() },
  ],
  activePbiId: 'pbi_001',
};

describe('sessionRealtime store', () => {
  beforeEach(() => {
    useSessionRealtimeStore.setState({
      connectionStatus: 'idle',
      session: null,
      client: null,
      lastError: undefined,
      localVote: null,
    } as any);
  });

  it('connects and updates state on state_sync message', () => {
    const client = new FakeRealtimeClient();
    useSessionRealtimeStore.getState().setCurrentUser('user_test');
    useSessionRealtimeStore.getState().connect(client, 'sess_test', 'token_123');
    expect(useSessionRealtimeStore.getState().connectionStatus).toBe('connected');

    client.handlers?.onMessage({
      sessionId: 'sess_test',
      event: 'state_sync',
      payload: demoState,
    });

    expect(useSessionRealtimeStore.getState().session?.meta.sessionId).toBe('sess_test');
  });

  it('handles errors and updates connection status', () => {
    const client = new FakeRealtimeClient();
    useSessionRealtimeStore.getState().setCurrentUser('user_test');
    useSessionRealtimeStore.getState().connect(client, 'sess_test', 'token_123');
    client.handlers?.onError(new Error('test error'));
    const state = useSessionRealtimeStore.getState();
    expect(state.connectionStatus).toBe('error');
    expect(state.lastError).toBe('test error');
  });

  it('sends vote_cast message via client', () => {
    const client = new FakeRealtimeClient();
    const store = useSessionRealtimeStore.getState();
    store.setCurrentUser('user_test');
    store.connect(client, 'sess_test', 'token_123');
    client.handlers?.onMessage({
      sessionId: 'sess_test',
      event: 'state_sync',
      payload: demoState,
    });
    useSessionRealtimeStore.getState().sendVote(5);
    expect(client.sentMessages).toHaveLength(1);
    expect(client.sentMessages[0].event).toBe('vote_cast');
    expect(client.sentMessages[0].payload).toEqual({ point: 5, userId: 'user_test' });
  });

  it('stores and clears local vote selection', () => {
    const store = useSessionRealtimeStore.getState();
    store.setLocalVote(8);
    expect(useSessionRealtimeStore.getState().localVote).toBe(8);
    store.clearLocalVote();
    expect(useSessionRealtimeStore.getState().localVote).toBeNull();
  });

  it('resetVotes clears local vote even when not connected', () => {
    const store = useSessionRealtimeStore.getState();
    store.setLocalVote(3);
    store.resetVotes();
    expect(useSessionRealtimeStore.getState().localVote).toBeNull();
  });

  it('sends delegate_facilitator message when current user is host', () => {
    const client = new FakeRealtimeClient();
    const store = useSessionRealtimeStore.getState();
    store.setCurrentUser('fac_demo');
    store.connect(client, 'sess_test', 'token_123');
    client.handlers?.onMessage({
      sessionId: 'sess_test',
      event: 'state_sync',
      payload: demoState,
    });

    store.delegateFacilitator('member_1');

    expect(client.sentMessages).toHaveLength(1);
    expect(client.sentMessages[0]).toMatchObject({
      event: 'delegate_facilitator',
      payload: { userId: 'fac_demo', delegateTo: 'member_1' },
    });
  });

  it('throws when non-host attempts to delegate facilitator', () => {
    const client = new FakeRealtimeClient();
    const store = useSessionRealtimeStore.getState();
    store.setCurrentUser('member_1');
    store.connect(client, 'sess_test', 'token_123');
    client.handlers?.onMessage({
      sessionId: 'sess_test',
      event: 'state_sync',
      payload: demoState,
    });

    expect(() => store.delegateFacilitator('fac_demo')).toThrow('Only host can delegate');
  });
});
