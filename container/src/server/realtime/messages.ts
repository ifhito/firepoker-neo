export type VoteCastMessage = {
  event: 'vote_cast';
  sessionId: string;
  payload: {
    userId: string;
    point: number;
  };
  version?: number;
  nonce?: string;
};

export type RevealRequestMessage = {
  event: 'reveal_request';
  sessionId: string;
  payload: {
    userId: string;
  };
  version?: number;
  nonce?: string;
};

export type ResetVotesMessage = {
  event: 'reset_votes';
  sessionId: string;
  payload: {
    userId: string;
  };
  version?: number;
  nonce?: string;
};

export type FinalizePointMessage = {
  event: 'finalize_point';
  sessionId: string;
  payload: {
    userId: string;
    finalPoint: number;
    memo?: string | null;
  };
  version?: number;
  nonce?: string;
};

export type PingMessage = {
  event: 'ping';
  sessionId: string;
  payload: Record<string, never>;
  version?: number;
  nonce?: string;
};

export type RealtimeInboundMessage =
  | VoteCastMessage
  | RevealRequestMessage
  | ResetVotesMessage
  | FinalizePointMessage
  | PingMessage;

export const isVoteCastMessage = (message: RealtimeInboundMessage): message is VoteCastMessage =>
  message.event === 'vote_cast';

export const isRevealRequestMessage = (
  message: RealtimeInboundMessage,
): message is RevealRequestMessage => message.event === 'reveal_request';

export const isResetVotesMessage = (
  message: RealtimeInboundMessage,
): message is ResetVotesMessage => message.event === 'reset_votes';

export const isFinalizePointMessage = (
  message: RealtimeInboundMessage,
): message is FinalizePointMessage => message.event === 'finalize_point';

