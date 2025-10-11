'use client';

import { useQuery } from '@tanstack/react-query';
import type { SessionState } from '@/domain/session';

const fetchSessionState = async (sessionId: string, joinToken: string) => {
  const response = await fetch(`/api/sessions/${sessionId}`, {
    headers: {
      Authorization: `Bearer ${joinToken}`,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = typeof payload?.message === 'string' ? payload.message : 'Failed to load session';
    throw new Error(message);
  }

  return (await response.json()) as SessionState;
};

interface UseSessionStateOptions {
  enabled?: boolean;
  refetchInterval?: number | false;
}

export const useSessionState = (
  sessionId: string | null,
  joinToken: string | null,
  options?: UseSessionStateOptions,
) => {
  return useQuery({
    queryKey: ['session-state', sessionId, joinToken],
    queryFn: () => fetchSessionState(sessionId as string, joinToken as string),
    enabled: Boolean(sessionId && joinToken && (options?.enabled ?? true)),
    refetchInterval: options?.refetchInterval ?? false,
  });
};

export default useSessionState;
