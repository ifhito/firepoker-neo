import type { SessionState } from '@/domain/session';
import { getConnectedRedisClient } from '@/lib/redis/client';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24;
const SESSION_KEY_PREFIX = 'session:';
const TOKEN_KEY_PREFIX = 'session:token:';

export type SessionRecord = {
  state: SessionState;
  expiresAt: number;
  joinToken: string;
};

const sessionKey = (sessionId: string) => `${SESSION_KEY_PREFIX}${sessionId}`;
const tokenKey = (token: string) => `${TOKEN_KEY_PREFIX}${token}`;

const parseRecord = (raw: string | null): SessionRecord | null => {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as SessionRecord;
  } catch (error) {
    console.warn('failed to parse session record', error);
    return null;
  }
};

export const upsertSession = async (sessionId: string, record: SessionRecord) => {
  const redis = await getConnectedRedisClient();
  const payload = JSON.stringify(record);
  await redis
    .multi()
    .set(sessionKey(sessionId), payload, 'PX', SESSION_TTL_MS)
    .set(tokenKey(record.joinToken), sessionId, 'PX', SESSION_TTL_MS)
    .exec();
};

const cleanupExpired = async (sessionId: string, record: SessionRecord | null) => {
  if (!record) {
    await removeSession(sessionId);
    return null;
  }

  if (record.expiresAt < Date.now()) {
    await removeSession(sessionId, record.joinToken);
    return null;
  }

  return record;
};

export const getSessionRecord = async (sessionId: string): Promise<SessionRecord | null> => {
  const redis = await getConnectedRedisClient();
  const record = parseRecord(await redis.get(sessionKey(sessionId)));
  return cleanupExpired(sessionId, record);
};

export const updateSessionState = async (
  sessionId: string,
  reducer: (state: SessionState) => void,
): Promise<SessionRecord | null> => {
  const record = await getSessionRecord(sessionId);
  if (!record) {
    return null;
  }

  reducer(record.state);
  record.expiresAt = Date.now() + SESSION_TTL_MS;
  await upsertSession(sessionId, record);
  return record;
};

export const listSessions = async (): Promise<Array<[string, SessionRecord]>> => {
  const redis = await getConnectedRedisClient();
  const keys = await redis.keys(`${SESSION_KEY_PREFIX}*`);
  if (keys.length === 0) {
    return [];
  }

  const values = await redis.mget(keys);
  const entries = await Promise.all(
    keys.map(async (key, index) => {
      const record = parseRecord(values[index]);
      const sessionId = key.replace(SESSION_KEY_PREFIX, '');
      const valid = await cleanupExpired(sessionId, record);
      return valid ? ([sessionId, valid] as [string, SessionRecord]) : null;
    })
  );

  return entries.filter((entry): entry is [string, SessionRecord] => Boolean(entry));
};

export const countSessions = async (): Promise<number> => {
  const entries = await listSessions();
  return entries.length;
};

export const clearSessions = async () => {
  const redis = await getConnectedRedisClient();
  const keys = await redis.keys(`${SESSION_KEY_PREFIX}*`);
  const tokenKeys = await redis.keys(`${TOKEN_KEY_PREFIX}*`);
  if (keys.length + tokenKeys.length > 0) {
    await redis.del(...keys, ...tokenKeys);
  }
};

export const getSessionRecordByJoinToken = async (
  token: string,
): Promise<SessionRecord | null> => {
  const redis = await getConnectedRedisClient();
  const sessionId = await redis.get(tokenKey(token));
  if (!sessionId) {
    return null;
  }
  return getSessionRecord(sessionId);
};

export const getSessionJoinToken = async (sessionId: string): Promise<string | null> => {
  const record = await getSessionRecord(sessionId);
  return record?.joinToken ?? null;
};

const removeSession = async (sessionId: string, joinToken?: string) => {
  const redis = await getConnectedRedisClient();
  const keys = [sessionKey(sessionId)];
  if (joinToken) {
    keys.push(tokenKey(joinToken));
  }
  await redis.del(...keys);
};
