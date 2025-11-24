import { DEFAULT_MAX_CONNECTIONS, getSessionAccessStore, hashJoinToken } from './store';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24;

export interface PublishSessionAccessInput {
  sessionId: string;
  joinToken: string;
  maxConnections?: number;
  expiresAt?: number;
}

export const publishSessionAccess = async (input: PublishSessionAccessInput): Promise<void> => {
  const store = getSessionAccessStore();
  const expiresAt = input.expiresAt ?? Date.now() + SESSION_TTL_MS;
  const maxConnections = input.maxConnections ?? DEFAULT_MAX_CONNECTIONS;

  await store.putSessionAccess({
    sessionId: input.sessionId,
    joinTokenHash: hashJoinToken(input.joinToken),
    maxConnections,
    expiresAt,
  });
};
