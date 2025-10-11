'use client';

import { useMemo } from 'react';
import { useSessionRealtimeStore } from '@/store/sessionRealtime';

export const useRealtimeSession = () => {
  const connectionStatus = useSessionRealtimeStore((state) => state.connectionStatus);
  const session = useSessionRealtimeStore((state) => state.session);
  const lastError = useSessionRealtimeStore((state) => state.lastError);
  const localVote = useSessionRealtimeStore((state) => state.localVote);
  const currentUserId = useSessionRealtimeStore((state) => state.currentUserId);
  const currentDisplayName = useSessionRealtimeStore((state) => state.currentDisplayName);
  const connect = useSessionRealtimeStore((state) => state.connect);
  const setCurrentUser = useSessionRealtimeStore((state) => state.setCurrentUser);
  const setCurrentDisplayName = useSessionRealtimeStore((state) => state.setCurrentDisplayName);
  const setSessionSnapshot = useSessionRealtimeStore((state) => state.setSessionSnapshot);
  const disconnect = useSessionRealtimeStore((state) => state.disconnect);
  const sendVote = useSessionRealtimeStore((state) => state.sendVote);
  const requestReveal = useSessionRealtimeStore((state) => state.requestReveal);
  const resetVotes = useSessionRealtimeStore((state) => state.resetVotes);
  const finalize = useSessionRealtimeStore((state) => state.finalize);
  const setLocalVote = useSessionRealtimeStore((state) => state.setLocalVote);
  const clearLocalVote = useSessionRealtimeStore((state) => state.clearLocalVote);
  const addSessionPbi = useSessionRealtimeStore((state) => state.addSessionPbi);
  const removeSessionPbi = useSessionRealtimeStore((state) => state.removeSessionPbi);
  const setActivePbi = useSessionRealtimeStore((state) => state.setActivePbi);
  const delegateFacilitator = useSessionRealtimeStore((state) => state.delegateFacilitator);

  return useMemo(
    () => ({
      connectionStatus,
      session,
      lastError,
      connect,
      disconnect,
      setCurrentUser,
      setSessionSnapshot,
      sendVote,
      requestReveal,
      resetVotes,
      finalize,
      localVote,
      setLocalVote,
      clearLocalVote,
      currentUserId,
      currentDisplayName,
      setCurrentDisplayName,
      addSessionPbi,
      removeSessionPbi,
      setActivePbi,
      delegateFacilitator,
    }),
    [
      connectionStatus,
      session,
      lastError,
      connect,
      disconnect,
      setCurrentUser,
      setSessionSnapshot,
      sendVote,
      requestReveal,
      resetVotes,
      finalize,
      localVote,
      setLocalVote,
      clearLocalVote,
      currentUserId,
      currentDisplayName,
      setCurrentDisplayName,
      addSessionPbi,
      removeSessionPbi,
      setActivePbi,
      delegateFacilitator,
    ],
  );
};
