import type { SessionAccessStore } from './store';
import { DEFAULT_MAX_CONNECTIONS, getSessionAccessStore, hashJoinToken } from './store';

export type ValidationFailureReason = 'MISSING_TOKEN' | 'INVALID_TOKEN' | 'LIMIT_REACHED';

export type AccessDecision =
  | { allowed: true; sessionId: string; activeConnections: number }
  | { allowed: false; reason: ValidationFailureReason; statusCode: number };

interface ValidatorOptions {
  store?: SessionAccessStore;
  now?: () => number;
}

export const createSessionAccessValidator = (options: ValidatorOptions = {}) => {
  const store = options.store ?? getSessionAccessStore();
  const now = options.now ?? (() => Date.now());

  const validate = async ({
    sessionId,
    joinToken,
  }: {
    sessionId?: string | null;
    joinToken?: string | null;
  }): Promise<AccessDecision> => {
    if (!sessionId || !joinToken) {
      return { allowed: false, reason: 'MISSING_TOKEN', statusCode: 400 };
    }

    const record = await store.getSessionAccess(sessionId);
    if (!record) {
      return { allowed: false, reason: 'INVALID_TOKEN', statusCode: 401 };
    }

    if (record.expiresAt < now()) {
      return { allowed: false, reason: 'INVALID_TOKEN', statusCode: 401 };
    }

    const expectedHash = hashJoinToken(joinToken);
    if (expectedHash !== record.joinTokenHash) {
      return { allowed: false, reason: 'INVALID_TOKEN', statusCode: 401 };
    }

    const maxConnections = record.maxConnections ?? DEFAULT_MAX_CONNECTIONS;
    const incrementResult = await store.incrementActiveConnections(sessionId, maxConnections);
    if (!incrementResult.allowed) {
      return { allowed: false, reason: 'LIMIT_REACHED', statusCode: 429 };
    }

    return { allowed: true, sessionId, activeConnections: incrementResult.activeConnections };
  };

  const release = async (sessionId?: string | null) => {
    if (!sessionId) {
      return 0;
    }
    return store.decrementActiveConnections(sessionId);
  };

  return { validate, release };
};
