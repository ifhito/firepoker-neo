'use client';

import { useMemo } from 'react';
import { useSessionRealtimeStore } from '@/store/sessionRealtime';

export const useRealtimeSession = () => {
  const connectionStatus = useSessionRealtimeStore((state) => state.connectionStatus);
  const session = useSessionRealtimeStore((state) => state.session);
  const lastError = useSessionRealtimeStore((state) => state.lastError);
  const connect = useSessionRealtimeStore((state) => state.connect);
  const disconnect = useSessionRealtimeStore((state) => state.disconnect);
  const sendVote = useSessionRealtimeStore((state) => state.sendVote);
  const requestReveal = useSessionRealtimeStore((state) => state.requestReveal);
  const resetVotes = useSessionRealtimeStore((state) => state.resetVotes);
  const finalize = useSessionRealtimeStore((state) => state.finalize);

  return useMemo(
    () => ({
      connectionStatus,
      session,
      lastError,
      connect,
      disconnect,
      sendVote,
      requestReveal,
      resetVotes,
      finalize,
    }),
    [
      connectionStatus,
      session,
      lastError,
      connect,
      disconnect,
      sendVote,
      requestReveal,
      resetVotes,
      finalize,
    ],
  );
};
