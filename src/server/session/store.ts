import type { SessionState } from '@/domain/session';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24;

type SessionRecord = {
  state: SessionState;
  expiresAt: number;
  joinToken: string;
};

const store = new Map<string, SessionRecord>();
const tokenIndex = new Map<string, string>();

export const upsertSession = (sessionId: string, record: SessionRecord) => {
  store.set(sessionId, record);
  tokenIndex.set(record.joinToken, sessionId);
};

export const getSessionRecord = (sessionId: string): SessionRecord | null => {
  const record = store.get(sessionId);
  if (!record) {
    return null;
  }

  if (record.expiresAt < Date.now()) {
    store.delete(sessionId);
    tokenIndex.delete(record.joinToken);
    return null;
  }

  return record;
};

export const updateSessionState = (sessionId: string, reducer: (state: SessionState) => void) => {
  const record = store.get(sessionId);
  if (!record) {
    return null;
  }

  reducer(record.state);
  record.expiresAt = Date.now() + SESSION_TTL_MS;
  store.set(sessionId, record);
  return record;
};

export const listSessions = () => Array.from(store.entries());

export const countSessions = () => {
  for (const [sessionId, record] of store.entries()) {
    if (record.expiresAt < Date.now()) {
      store.delete(sessionId);
      tokenIndex.delete(record.joinToken);
    }
  }
  return store.size;
};

export const clearSessions = () => {
  store.clear();
  tokenIndex.clear();
};

export const getSessionRecordByJoinToken = (token: string): SessionRecord | null => {
  const sessionId = tokenIndex.get(token);
  if (!sessionId) {
    return null;
  }
  return getSessionRecord(sessionId);
};
