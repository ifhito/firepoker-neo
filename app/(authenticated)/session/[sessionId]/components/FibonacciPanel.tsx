'use client';

import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import type { SessionState } from '@/domain/session';
import { useRealtimeSession } from '@/hooks/useRealtimeSession';

const FIBONACCI_POINTS = [0, 1, 2, 3, 5, 8, 13, 21, 34];

type FibonacciPanelProps = {
  session: SessionState;
  onFinalizingStart?: () => void;
};

export default function FibonacciPanel({ session: propsSession, onFinalizingStart }: FibonacciPanelProps) {
  const {
    sendVote,
    requestReveal,
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

  // リアルタイムセッションが利用可能な場合はそれを使用、そうでなければpropsから
  const session = realtimeSession ?? propsSession;

  // ポイント確定のためのローカル状態
  const [finalPoint, setFinalPoint] = useState<number | null>(null);
  const [memo, setMemo] = useState<string>('');
  const [isFinalizing, setIsFinalizing] = useState(false);

  const resolvedVote = (() => {
    if (localVote !== null) {
      return localVote;
    }
    if (!currentUserId) {
      return null;
    }
    const remoteVote = session.votes[currentUserId];
    return typeof remoteVote === 'number' ? remoteVote : null;
  })();

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

  const disabled = connectionStatus !== 'connected' || !currentUserId;
  const offline = connectionStatus !== 'connected';

  const handleSelect = useCallback(
    (point: number) => {
      setLocalVote(point);
      sendVote(point);
    },
    [sendVote, setLocalVote],
  );

  const handleReset = useCallback(() => {
    clearLocalVote();
    resetVotes();
  }, [clearLocalVote, resetVotes]);

  const handleFinalize = useCallback(() => {
    if (finalPoint === null) return;
    setIsFinalizing(true);
    
    // 親コンポーネントにローディング開始を通知
    if (onFinalizingStart) {
      onFinalizingStart();
    }
    
    try {
      finalize(finalPoint, memo.trim() || null);
      // 確定後に状態をリセット
      setFinalPoint(null);
      setMemo('');
    } catch (error) {
      console.error('Failed to finalize:', error);
    } finally {
      setIsFinalizing(false);
    }
  }, [finalPoint, memo, finalize, onFinalizingStart]);

  // REVEAL時に最頻値を自動計算
  useEffect(() => {
    if (session.phase === 'REVEAL' && finalPoint === null) {
      const votes = Object.values(session.votes).filter((v): v is number => v !== null);
      if (votes.length > 0) {
        // 最頻値を計算
        const frequency = votes.reduce((acc, vote) => {
          acc[vote] = (acc[vote] || 0) + 1;
          return acc;
        }, {} as Record<number, number>);
        
        const maxFreq = Math.max(...Object.values(frequency));
        const mostFrequent = Number(Object.keys(frequency).find(k => frequency[Number(k)] === maxFreq));
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

  // 投票状況を計算
  const votingStatus = (() => {
    const allParticipants = session.participants.length;
    const votedCount = Object.keys(session.votes).filter(
      uid => session.votes[uid] !== null && session.votes[uid] !== undefined
    ).length;
    return { total: allParticipants, voted: votedCount };
  })();

  // 参加者ごとの投票状況
  const participantVotes = session.participants.map(participant => {
    const vote = session.votes[participant.userId];
    const hasVoted = vote !== null && vote !== undefined;
    return {
      userId: participant.userId,
      displayName: participant.displayName,
      vote: hasVoted ? vote : null,
      hasVoted,
    };
  });

  return (
    <section className="card">
      <div className="badge">投票</div>
      <h2>フィボナッチカード</h2>
      
      {/* 投票状況の表示 */}
      <div style={{ 
        marginBottom: '1rem',
        padding: '0.75rem',
        backgroundColor: '#f5f5f5',
        borderRadius: '4px',
        border: '1px solid #ddd',
      }}>
        <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>
          <strong>投票状況:</strong> {votingStatus.voted} / {votingStatus.total} 人
          {votingStatus.voted === votingStatus.total && votingStatus.total > 0 && (
            <span style={{ 
              marginLeft: '0.5rem', 
              color: '#2e7d32', 
              fontWeight: 'bold',
              backgroundColor: '#c8e6c9',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
            }}>
              ✓ 全員投票済み
            </span>
          )}
        </p>
      </div>

      <div
        className="fibonacci-card-grid"
        role="radiogroup"
        aria-label="ストーリーポイントの選択"
        aria-disabled={disabled}
      >
        {FIBONACCI_POINTS.map((point, index) => {
          const isSelected = resolvedVote === point;
          const tabIndex = isSelected || (resolvedVote === null && index === 0) ? 0 : -1;
          return (
            <button
              key={point}
              className={`fibonacci-card${isSelected ? ' is-selected' : ''}`}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`ポイント ${point}`}
              tabIndex={tabIndex}
              data-selected={isSelected ? 'true' : undefined}
              onClick={() => handleSelect(point)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              disabled={disabled}
            >
              {point}
            </button>
          );
        })}
      </div>
      <div className="button-row">
        <button
          className="button-secondary"
          type="button"
          onClick={requestReveal}
          disabled={disabled || session.phase !== 'VOTING'}
        >
          開示
        </button>
        <button className="button-secondary" type="button" onClick={handleReset} disabled={disabled}>
          リセット
        </button>
      </div>
      {resolvedVote !== null && (
        <p role="status" className="feedback info">
          あなたの選択: {resolvedVote} pt
        </p>
      )}

      {/* 各参加者の投票状況を表示 */}
      <div style={{ marginTop: '1.5rem' }}>
        <h3 style={{ 
          fontSize: '16px', 
          marginBottom: '0.75rem',
          color: '#333',
          fontWeight: '600',
        }}>
          参加者の投票状況
        </h3>
        {participantVotes.length === 0 ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>
            参加者がいません（デバッグ: participants={session.participants.length}, votes={Object.keys(session.votes).length}）
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {participantVotes.map(({ userId, displayName, vote, hasVoted }) => (
              <li
                key={userId}
                style={{
                  padding: '0.75rem',
                  marginBottom: '0.5rem',
                  borderRadius: '4px',
                  backgroundColor: hasVoted ? '#e8f5e9' : '#fff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: hasVoted ? '2px solid #4caf50' : '1px solid #ccc',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
              >
                <span style={{ fontSize: '14px', color: '#333', fontWeight: '500' }}>
                  {displayName}
                  {userId === currentUserId && ' (あなた)'}
                </span>
                <span style={{ 
                  fontWeight: 'bold', 
                  fontSize: '14px',
                  color: hasVoted ? '#2e7d32' : '#999',
                  padding: '0.25rem 0.5rem',
                  backgroundColor: hasVoted ? '#c8e6c9' : '#f5f5f5',
                  borderRadius: '4px',
                }}>
                  {session.phase === 'REVEAL' || session.phase === 'FINALIZED' ? (
                    // 開示後は具体的なポイントを表示
                    hasVoted ? `${vote} pt` : '未投票'
                  ) : (
                    // 投票中は投票済みかどうかのみ表示
                    hasVoted ? '✓ 投票済み' : '未投票'
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ポイント確定フォーム（REVEAL時のみ表示） */}
      {session.phase === 'REVEAL' && (
        <div style={{ 
          marginTop: '1.5rem',
          padding: '1rem',
          backgroundColor: '#e3f2fd',
          borderRadius: '8px',
          border: '2px solid #2196f3',
        }}>
          <h3 style={{ 
            fontSize: '16px', 
            marginBottom: '1rem',
            color: '#1565c0',
            fontWeight: '600',
          }}>
            ストーリーポイントを確定
          </h3>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333', fontWeight: '500' }}>
              確定ポイント:
            </label>
            <select
              value={finalPoint ?? ''}
              onChange={(e) => setFinalPoint(e.target.value ? Number(e.target.value) : null)}
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '14px',
                borderRadius: '4px',
                border: '1px solid #ccc',
              }}
              disabled={isFinalizing}
            >
              <option value="">選択してください</option>
              {FIBONACCI_POINTS.map(point => (
                <option key={point} value={point}>{point} pt</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333', fontWeight: '500' }}>
              メモ（任意）:
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="議論の内容や決定理由などを記録..."
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '14px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                minHeight: '80px',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
              disabled={isFinalizing}
            />
          </div>

          <button
            className="button-primary"
            type="button"
            onClick={handleFinalize}
            disabled={finalPoint === null || disabled || isFinalizing}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
          >
            {isFinalizing ? '確定中...' : 'ポイントを確定してNotionに保存'}
          </button>

          {session.activePbiId && (
            <p style={{ 
              marginTop: '0.5rem', 
              fontSize: '12px', 
              color: '#666',
              textAlign: 'center',
            }}>
              このポイントがNotionのPBIページに保存されます
            </p>
          )}
        </div>
      )}

      {/* 確定済み表示 */}
      {session.phase === 'FINALIZED' && (
        <div style={{ 
          marginTop: '1.5rem',
          padding: '1rem',
          backgroundColor: '#e8f5e9',
          borderRadius: '8px',
          border: '2px solid #4caf50',
        }}>
          <h3 style={{ 
            fontSize: '16px', 
            marginBottom: '0.5rem',
            color: '#2e7d32',
            fontWeight: '600',
          }}>
            ✓ ポイント確定済み
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>
            このPBIのポイントが確定し、Notionに保存されました。
          </p>
        </div>
      )}

      {lastError && <p className="feedback error">{lastError}</p>}
    </section>
  );
}
