export type RealtimeEventName =
  | 'state_sync'
  | 'vote_cast'
  | 'vote_ack'
  | 'reveal_request'
  | 'reset_votes'
  | 'finalize_point'
  | 'finalized'
  | 'error';

export interface RealtimeEnvelope<T = unknown> {
  sessionId: string;
  event: RealtimeEventName;
  version?: number;
  nonce?: string;
  payload: T;
}

export interface RealtimeHandlers {
  onOpen: () => void;
  onClose: () => void;
  onError: (error: Error) => void;
  onMessage: (message: RealtimeEnvelope) => void;
}

export interface RealtimeClient {
  connect: (sessionId: string, joinToken: string, handlers: RealtimeHandlers) => void;
  disconnect: () => void;
  send: (message: RealtimeEnvelope) => void;
  isConnected: () => boolean;
}
