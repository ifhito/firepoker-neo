'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProductBacklogItem, SimilarPBIResponse } from '@/domain/pbi';
import type { SessionState } from '@/domain/session';
import { useSessionState } from '@/hooks/session/useSessionState';
import FibonacciPanel from './components/FibonacciPanel';
import PbiSelectionPanel from './components/PbiSelectionPanel';
import { useRealtimeSession } from '@/hooks/useRealtimeSession';
import { usePbiQuery } from '@/hooks/usePbiQuery';
import { createWebSocketClient } from '@/client/realtime/websocketClient';

interface SessionDetailClientProps {
  sessionId: string;
  joinToken: string | null;
  initialState: SessionState;
  pbis: ProductBacklogItem[];
  activePbi: ProductBacklogItem | null;
  similar: ProductBacklogItem[];
}

export function SessionDetailClient({
  sessionId,
  joinToken,
  initialState,
  pbis,
  activePbi,
  similar,
}: SessionDetailClientProps) {
  const { data, error, isFetching } = useSessionState(sessionId, joinToken, {
    enabled: Boolean(joinToken),
    refetchInterval: joinToken ? 10000 : false,
  });

  const {
    connectionStatus,
    setCurrentUser,
    connect,
    disconnect,
    currentUserId,
    setSessionSnapshot,
    addSessionPbi,
    removeSessionPbi,
    setActivePbi,
  } = useRealtimeSession();
  const { data: catalogData } = usePbiQuery();

  const STORAGE_KEY = `firepocker-session-${sessionId}`;
  const [displayName, setDisplayName] = useState<string | null>(null);

  const [sessionState, setSessionState] = useState<SessionState>(initialState);
  const [sessionPbis, setSessionPbis] = useState<ProductBacklogItem[]>(pbis);
  const [activePbiDetail, setActivePbiDetail] = useState<ProductBacklogItem | null>(activePbi);
  const [similarPbis, setSimilarPbis] = useState<ProductBacklogItem[]>(similar);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [managingPbiId, setManagingPbiId] = useState<string | null>(null);
  const [pbiActionError, setPbiActionError] = useState<string | null>(null);
  const [isAddingPbi, setIsAddingPbi] = useState(false);
  const [isFinalizingAndRemoving, setIsFinalizingAndRemoving] = useState(false);

  const availablePbiCatalog = useMemo(() => catalogData?.items ?? [], [catalogData?.items]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { userId?: string; name?: string };
      if (parsed.userId) {
        setCurrentUser(parsed.userId);
      }
      if (parsed.name) {
        setDisplayName(parsed.name);
      }
    } catch (err) {
      console.warn('failed to bootstrap session user', err);
    }
  }, [STORAGE_KEY, setCurrentUser]);

  useEffect(() => {
    setSessionState(initialState);
  }, [initialState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!joinToken || !currentUserId) return;

    let cancelled = false;

    const setup = async () => {
      try {
        // Initialize Socket.IO server
        await fetch('/api/socketio');
      } catch (error) {
        console.warn('failed to initialize Socket.IO endpoint', error);
      }

      if (cancelled) return;

      const client = createWebSocketClient({
        endpoint: '/api/socketio',
      });
      connect(client, sessionId, joinToken, currentUserId);
    };

    setup();

    return () => {
      cancelled = true;
      disconnect();
    };
  }, [connect, disconnect, joinToken, currentUserId, sessionId]);

  useEffect(() => {
    setSessionPbis(pbis);
  }, [pbis]);

  useEffect(() => {
    setActivePbiDetail(activePbi);
  }, [activePbi]);

  useEffect(() => {
    setSimilarPbis(similar);
  }, [similar]);

  useEffect(() => {
    if (data) {
      setSessionState(data);
      setSessionSnapshot(data);
    }
  }, [data, setSessionSnapshot]);

  useEffect(() => {
    setSessionPbis((prev) => {
      const ids = sessionState.meta.pbiIds;
      const map = new Map(prev.map((item) => [item.id, item]));

      ids.forEach((id) => {
        if (!map.has(id)) {
          const fromCatalog = availablePbiCatalog.find((item) => item.id === id);
          if (fromCatalog) {
            map.set(id, fromCatalog);
          }
        }
      });

      const ordered = ids
        .map((id) => map.get(id))
        .filter((item): item is ProductBacklogItem => Boolean(item));

      return ordered;
    });
    setSessionSnapshot({ ...sessionState, meta: { ...sessionState.meta } });
  }, [sessionState.meta.pbiIds, availablePbiCatalog, sessionState, setSessionSnapshot]);

  useEffect(() => {
    if (activePbiDetail) {
      setSessionPbis((prev) => {
        if (prev.some((item) => item.id === activePbiDetail.id)) {
          return prev;
        }
        return [...prev, activePbiDetail];
      });
    }
  }, [activePbiDetail]);

  useEffect(() => {
    const targetId = sessionState.activePbiId;
    if (!targetId) {
      setActivePbiDetail(null);
      setSimilarPbis([]);
      return;
    }

    const match = sessionPbis.find((item) => item.id === targetId) ?? null;
    if (match && match.id !== activePbiDetail?.id) {
      setActivePbiDetail(match);
    }

    let cancelled = false;
    const fetchSimilar = async () => {
      try {
        // 投票されたポイントを取得（nullを除外）
        const votedPoints = Object.values(sessionState.votes)
          .filter((vote): vote is number => vote !== null && vote !== undefined);
        
        // ユニークなポイントのみ取得
        const uniquePoints = Array.from(new Set(votedPoints));
        
        if (uniquePoints.length === 0) {
          // 投票がない場合は従来通り
          const response = await fetch(`/api/pbis/${targetId}/similar`);
          if (!response.ok) {
            throw new Error('類似 PBI を取得できませんでした。');
          }
          const payload = (await response.json()) as SimilarPBIResponse;
          if (!cancelled) {
            setSimilarPbis(payload.items ?? []);
          }
        } else {
          // 投票されたポイントで類似PBIを取得
          const pointsParam = uniquePoints.join(',');
          const url = `/api/pbis/by-points?points=${encodeURIComponent(pointsParam)}`;
          
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error('類似 PBI を取得できませんでした。');
          }
          const payload = (await response.json()) as SimilarPBIResponse;
          
          if (!cancelled) {
            setSimilarPbis(payload.items ?? []);
          }
        }
      } catch (err) {
        console.warn('failed to fetch similar PBIs', err);
      }
    };

    fetchSimilar();

    return () => {
      cancelled = true;
    };
  }, [sessionState.activePbiId, sessionState.votes, sessionPbis, activePbiDetail?.id]);

  useEffect(() => {
    if (selectingId && sessionState.activePbiId === selectingId) {
      setSelectingId(null);
    }
  }, [selectingId, sessionState.activePbiId]);

  // ポイント確定ボタン押下時のハンドラー
  const handleFinalizingStart = useCallback(() => {
    setIsFinalizingAndRemoving(true);
  }, []);

  // FINALIZED後に自動的にPBIを削除（再選択を促す）
  useEffect(() => {
    if (sessionState.phase !== 'FINALIZED' || !sessionState.activePbiId || !joinToken) {
      return;
    }

    const pbiIdToRemove = sessionState.activePbiId;

    // 少し遅延を入れてからPBIを削除（ユーザーが確定を確認できるように）
    const timer = setTimeout(async () => {
      try {
        removeSessionPbi(pbiIdToRemove);
        // PBI削除後もローディング状態を維持（activePbiIdがnullになるまで）
      } catch (error) {
        console.error('Failed to remove PBI:', error);
        setIsFinalizingAndRemoving(false);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  }, [sessionState.phase, sessionState.activePbiId, joinToken, removeSessionPbi]);

  // activePbiIdがnullになったらローディングを解除
  useEffect(() => {
    if (!sessionState.activePbiId && isFinalizingAndRemoving) {
      // さらに少し待ってからローディングを解除（サーバー処理完了を確実にする）
      const timer = setTimeout(() => {
        setIsFinalizingAndRemoving(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [sessionState.activePbiId, isFinalizingAndRemoving]);


  const handleSelectPbi = useCallback(
    (pbiId: string) => {
      if (pbiId === sessionState.activePbiId) {
        return;
      }
      setSelectingId(pbiId);
      setSelectionError(null);
      try {
        setActivePbi(pbiId);
      } catch (err) {
        setSelectionError(err instanceof Error ? err.message : 'PBI を切り替えられませんでした。');
        setSelectingId(null);
      }
    },
    [sessionState.activePbiId, setActivePbi],
  );

  const handleAddSessionPbi = useCallback(
    (pbiId: string) => {
      // 既に追加済みの場合はスキップ
      if (sessionState.meta.pbiIds.includes(pbiId)) {
        setPbiActionError('この PBI は既に追加されています。');
        return;
      }

      setIsAddingPbi(true);
      setPbiActionError(null);
      try {
        addSessionPbi(pbiId);
        
        // 追加後すぐにローカル状態を更新（楽観的更新）
        const pbiToAdd = availablePbiCatalog.find(item => item.id === pbiId);
        if (pbiToAdd) {
          setSessionPbis(prev => [...prev, pbiToAdd]);
        }
      } catch (err) {
        setPbiActionError(err instanceof Error ? err.message : 'PBI を追加できませんでした。');
      } finally {
        setIsAddingPbi(false);
      }
    },
    [addSessionPbi, sessionState.meta.pbiIds, availablePbiCatalog],
  );

  const handleRemoveSessionPbi = useCallback(
    (pbiId: string) => {
      setManagingPbiId(pbiId);
      setPbiActionError(null);
      try {
        removeSessionPbi(pbiId);
      } catch (err) {
        setPbiActionError(err instanceof Error ? err.message : 'PBI を削除できませんでした。');
      } finally {
        setManagingPbiId(null);
      }
    },
    [removeSessionPbi],
  );

  return (
    <div className="card-grid">
      {/* ローディングオーバーレイ */}
      {isFinalizingAndRemoving && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '8px',
            textAlign: 'center',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #2196f3',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem',
            }} />
            <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#333' }}>
              ポイントを保存中...
            </p>
            <p style={{ margin: '0.5rem 0 0', fontSize: '14px', color: '#666' }}>
              次のPBIを選択できるようになります
            </p>
          </div>
        </div>
      )}
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <section className="card">
        <div className="badge">セッション</div>
        <h2>{sessionState.meta.title}</h2>
        {joinToken ? (
          <p className="badge">Join Token: {joinToken}</p>
        ) : (
          <p className="feedback warning">JoinToken が無いためリアルタイム機能を利用できません。</p>
        )}
        {displayName && <p>あなたの表示名: {displayName}</p>}
        {error && <p className="feedback error">{(error as Error).message}</p>}
        {isFetching && <p>同期中...</p>}
        <p>進行状況: {sessionState.phase}</p>
        <p>ファシリテーター: {sessionState.participants[0]?.displayName}</p>
        <p>
          対象 PBI 数: <strong>{sessionState.meta.pbiIds.length}</strong>
        </p>
        <p>
          アクティブ PBI:{' '}
          {activePbiDetail ? (
            <a className="badge" href={activePbiDetail.notionUrl ?? '#'} target="_blank" rel="noreferrer">
              {activePbiDetail.title}
            </a>
          ) : (
            '未選択'
          )}
        </p>
        <div>
          <h3>参加者</h3>
          <ul>
            {sessionState.participants.map((participant) => (
              <li key={participant.userId}>
                {participant.displayName} — 参加: {new Date(participant.joinedAt).toLocaleString('ja-JP')}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <PbiSelectionPanel
        pbis={sessionPbis}
        availablePbis={availablePbiCatalog}
        activePbiId={sessionState.activePbiId}
        onSelect={handleSelectPbi}
        selectingId={selectingId}
        disabled={connectionStatus !== 'connected' || !currentUserId}
        joinToken={joinToken}
        errorMessage={selectionError}
        onAdd={joinToken ? handleAddSessionPbi : undefined}
        onRemove={joinToken ? handleRemoveSessionPbi : undefined}
        managingId={managingPbiId}
        isAdding={isAddingPbi}
      />

      {pbiActionError && <p className="feedback error">{pbiActionError}</p>}

      <FibonacciPanel session={sessionState} onFinalizingStart={handleFinalizingStart} />

      <section className="card">
        <div className="badge">類似 PBI</div>
        <h2>投票されたポイントの過去事例</h2>
        {similarPbis.length === 0 ? (
          <p>投票されたポイントの完了済み PBI はまだありません。</p>
        ) : (() => {
          // ポイント別にグループ化
          const groupedByPoint = similarPbis.reduce((acc, item) => {
            const point = item.storyPoint ?? 0;
            if (!acc[point]) {
              acc[point] = [];
            }
            acc[point].push(item);
            return acc;
          }, {} as Record<number, typeof similarPbis>);

          // ポイントの順にソート
          const sortedPoints = Object.keys(groupedByPoint)
            .map(Number)
            .sort((a, b) => a - b);

          return (
            <div>
              {sortedPoints.map((point) => (
                <div key={point} style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ 
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#333',
                    marginBottom: '0.5rem',
                    padding: '0.5rem',
                    backgroundColor: '#e3f2fd',
                    borderRadius: '4px',
                    border: '1px solid #2196f3',
                  }}>
                    {point} pt の過去事例 ({groupedByPoint[point].length}件)
                  </h3>
                  <ul style={{ 
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                  }}>
                    {groupedByPoint[point].map((item) => (
                      <li key={item.id} style={{
                        padding: '0.5rem',
                        marginBottom: '0.25rem',
                        backgroundColor: '#f5f5f5',
                        borderRadius: '4px',
                        border: '1px solid #ddd',
                      }}>
                        <a 
                          href={item.notionUrl ?? '#'} 
                          target="_blank" 
                          rel="noreferrer"
                          style={{
                            textDecoration: 'none',
                            color: '#1976d2',
                            fontWeight: '500',
                          }}
                        >
                          {item.title}
                        </a>
                        {item.status && (
                          <span style={{
                            marginLeft: '0.5rem',
                            fontSize: '12px',
                            color: '#666',
                            padding: '0.125rem 0.375rem',
                            backgroundColor: '#e0e0e0',
                            borderRadius: '3px',
                          }}>
                            {item.status}
                          </span>
                        )}
                        {item.lastEstimatedAt && (
                          <span style={{
                            marginLeft: '0.5rem',
                            fontSize: '12px',
                            color: '#999',
                          }}>
                            ({new Date(item.lastEstimatedAt).toLocaleDateString('ja-JP')})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          );
        })()}
      </section>
    </div>
  );
}

export default SessionDetailClient;
