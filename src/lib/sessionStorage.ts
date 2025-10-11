export interface SessionIdentity {
  userId: string;
  name: string;
  joinToken: string;
  dbId?: string | null;
}

const buildStorageKey = (sessionId: string) => `firepocker-session-${sessionId}`;

export const persistSessionIdentity = (
  sessionId: string,
  identity: SessionIdentity,
  storage?: Storage,
) => {
  const targetStorage =
    storage ?? (typeof window !== 'undefined' ? window.sessionStorage : undefined);
  if (!targetStorage) {
    return;
  }

  try {
    targetStorage.setItem(buildStorageKey(sessionId), JSON.stringify(identity));
  } catch (error) {
    console.warn('failed to persist session identity', error);
  }
};

export const buildSessionEntryPath = (sessionId: string, joinToken: string) =>
  `/session/${encodeURIComponent(sessionId)}?token=${encodeURIComponent(joinToken)}`;

export const buildSessionJoinLink = (sessionId: string, joinToken: string, origin: string) =>
  `${origin}${buildSessionEntryPath(sessionId, joinToken)}`;
