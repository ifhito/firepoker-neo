'use client';

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import type { SessionState } from '@/domain/session';
import { useRealtimeSession } from '@/hooks/useRealtimeSession';

const FIBONACCI_POINTS = [0, 1, 2, 3, 5, 8, 13, 21, 34];

type FibonacciPanelProps = {
  session: SessionState;
  onFinalizingStart?: () => void;
  onFinalizeComplete?: () => void;
  canFinalize?: boolean;
};

export default function FibonacciPanel({ session: propsSession, onFinalizingStart, onFinalizeComplete, canFinalize = true }: FibonacciPanelProps) {
  const {
    sendVote,
    resetVotes,
    connectionStatus,
    lastError,
    localVote,
    setLocalVote,
    clearLocalVote,
    currentUserId,
    session: realtimeSession,
    finalize,
  } = useRealtimeSession();

  const session = realtimeSession ?? propsSession;

  const [finalPoint, setFinalPoint] = useState<number | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const resolvedVote = useMemo(() => {
    if (localVote !== null) {
      return localVote;
    }
    if (!currentUserId) {
      return null;
    }
    const remoteVote = session.votes[currentUserId];
    return typeof remoteVote === 'number' ? remoteVote : null;
  }, [localVote, currentUserId, session.votes]);

  useEffect(() => {
    if (!currentUserId) return;
    const remoteVote = session.votes[currentUserId];
    if (remoteVote == null && localVote !== null) {
      clearLocalVote();
      return;
    }
    if (typeof remoteVote === 'number' && remoteVote !== localVote) {
      setLocalVote(remoteVote);
    }
  }, [session.votes, currentUserId, localVote, clearLocalVote, setLocalVote]);

  const baseDisabled = connectionStatus !== 'connected' || !currentUserId;
  const noActivePbi = !session.activePbiId;
  const voteDisabled = baseDisabled || session.phase !== 'VOTING' || noActivePbi;
  const finalizeDisabled = baseDisabled || !canFinalize || noActivePbi;
  const resetDisabled = baseDisabled || noActivePbi;

  const handleSelect = useCallback(
    (point: number) => {
      if (voteDisabled) {
        return;
      }
      setLocalVote(point);
      sendVote(point);
    },
    [sendVote, setLocalVote, voteDisabled],
  );

  const handleReset = useCallback(() => {
    if (resetDisabled) {
      return;
    }
    clearLocalVote();
    resetVotes();
  }, [clearLocalVote, resetVotes, resetDisabled]);

  const handleFinalize = useCallback(() => {
    if (finalPoint === null) return;
    setIsFinalizing(true);
    if (onFinalizingStart) {
      onFinalizingStart();
    }
    try {
      finalize(finalPoint, null);
      if (onFinalizeComplete) {
        onFinalizeComplete();
      }
      setFinalPoint(null);
    } catch (error) {
      console.error('Failed to finalize:', error);
    } finally {
      setIsFinalizing(false);
    }
  }, [finalPoint, finalize, onFinalizingStart, onFinalizeComplete]);

  useEffect(() => {
    if (session.phase === 'REVEAL' && finalPoint === null) {
      const votes = Object.values(session.votes).filter((v): v is number => v !== null);
      if (votes.length > 0) {
        const frequency = votes.reduce((acc, vote) => {
          acc[vote] = (acc[vote] || 0) + 1;
          return acc;
        }, {} as Record<number, number>);
        const maxFreq = Math.max(...Object.values(frequency));
        const mostFrequent = Number(
          Object.keys(frequency).find((key) => frequency[Number(key)] === maxFreq) ?? votes[0],
        );
        setFinalPoint(mostFrequent);
      }
    }
  }, [session.phase, session.votes, finalPoint]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        const nextIndex = (index + 1) % FIBONACCI_POINTS.length;
        handleSelect(FIBONACCI_POINTS[nextIndex]);
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        const prevIndex = (index - 1 + FIBONACCI_POINTS.length) % FIBONACCI_POINTS.length;
        handleSelect(FIBONACCI_POINTS[prevIndex]);
        return;
      }
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        handleSelect(FIBONACCI_POINTS[index]);
      }
    },
    [handleSelect],
  );

  const votingStatus = useMemo(() => {
    const total = session.participants.length;
    const votedCount = Object.keys(session.votes).filter(
      (uid) => session.votes[uid] !== null && session.votes[uid] !== undefined,
    ).length;
    return { total, voted: votedCount };
  }, [session.participants.length, session.votes]);

  const participantVotes = useMemo(
    () =>
      session.participants.map((participant) => {
        const vote = session.votes[participant.userId];
        const hasVoted = vote !== null && vote !== undefined;
        return {
          userId: participant.userId,
          displayName: participant.displayName,
          vote: hasVoted ? vote : null,
          hasVoted,
        };
      }),
    [session.participants, session.votes],
  );

  return (
    <section className="session-card vote-panel">
      <header className="vote-panel__header">
        <div>
          <span className="session-card__eyebrow">参加者</span>
          <h2 className="session-card__title">投票状況</h2>
        </div>
        <span className="vote-panel__tally">
          {votingStatus.voted} / {votingStatus.total} 投票完了
        </span>
      </header>

      <div className="participant-grid" role="list">
        {participantVotes.map(({ userId, displayName, vote, hasVoted }) => {
          const isSelf = currentUserId === userId;
          const revealVote = session.phase === 'REVEAL' || session.phase === 'FINALIZED';
          const showVoteValue = revealVote || isSelf;
          const cardClasses = [
            'participant-card',
            hasVoted ? 'participant-card--voted' : 'participant-card--pending',
            isSelf ? 'participant-card--self' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div key={userId} className={cardClasses} role="listitem">
              <div className="participant-card__header">
                <span className="participant-card__name">{displayName}</span>
                {isSelf && <span className="participant-card__tag">あなた</span>}
              </div>
              <div className="participant-card__vote">
                {hasVoted ? (showVoteValue && vote !== null ? vote : '✓') : '–'}
              </div>
              <span className="participant-card__status">
                {hasVoted ? (showVoteValue ? '投票済み' : '投票完了') : '未投票'}
              </span>
            </div>
          );
        })}
      </div>

      {connectionStatus !== 'connected' && (
        <p className="session-inline-alert session-inline-alert--warning" role="status">
          WebSocket が{connectionStatus === 'connecting' ? '再接続中です。' : '切断されています。'}
        </p>
      )}

      {lastError && (
        <p className="session-inline-alert session-inline-alert--error" role="alert">
          {lastError}
        </p>
      )}

      <div className="vote-panel__section">
        <span className="session-card__eyebrow">ストーリーポイントを選択</span>
        <div
          className="point-grid"
          role="radiogroup"
          aria-label="ストーリーポイントの選択"
          aria-disabled={voteDisabled}
        >
          {FIBONACCI_POINTS.map((point, index) => {
            const isSelected = resolvedVote === point;
            const tabIndex = isSelected || (resolvedVote === null && index === 0) ? 0 : -1;
            return (
              <button
                key={point}
                className={`point-button${isSelected ? ' is-selected' : ''}`}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`ポイント ${point}`}
                tabIndex={tabIndex}
                onClick={() => handleSelect(point)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                disabled={voteDisabled}
              >
                {point}
              </button>
            );
          })}
        </div>
        {resolvedVote !== null && (
          <p className="vote-panel__feedback" role="status">
            あなたの選択: {resolvedVote} pt
          </p>
        )}
      </div>

      <div className="vote-panel__actions">
        <button
          className="session-button session-button--ghost"
          type="button"
          onClick={handleReset}
          disabled={resetDisabled}
        >
          リセット
        </button>
      </div>

      {session.phase === 'REVEAL' && (
        <div className="vote-panel__finalize">
          <h3>ストーリーポイントを確定</h3>
          {canFinalize ? (
            <>
              <div className="vote-panel__finalize-grid">
                <label className="vote-panel__field">
                  <span>確定ポイント</span>
                  <select
                    value={finalPoint ?? ''}
                    onChange={(event) => setFinalPoint(event.target.value ? Number(event.target.value) : null)}
                    className="vote-panel__select"
                    disabled={finalizeDisabled}
                  >
                    <option value="">ポイントを選択...</option>
                    {FIBONACCI_POINTS.map((point) => (
                      <option key={point} value={point}>
                        {point} pt
                      </option>
                    ))}
                  </select>
                </label>
                <div className="vote-panel__finalize-actions">
                  <button
                    className="session-button session-button--primary"
                    type="button"
                    onClick={handleFinalize}
                    disabled={finalPoint === null || isFinalizing || finalizeDisabled}
                  >
                    {isFinalizing ? '反映中…' : '確定して Notion に反映'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="vote-panel__finalize-note">ホストが確定するまでお待ちください。</p>
          )}
        </div>
      )}
    </section>
  );
}
