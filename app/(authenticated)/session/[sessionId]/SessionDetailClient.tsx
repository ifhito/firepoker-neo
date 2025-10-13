'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProductBacklogItem, SimilarPBIResponse } from '@/domain/pbi';
import type { SessionState } from '@/domain/session';
import { useSessionState } from '@/hooks/session/useSessionState';
import FibonacciPanel from './components/FibonacciPanel';
import PbiSelectionPanel from './components/PbiSelectionPanel';
import { useRealtimeSession } from '@/hooks/useRealtimeSession';
import { usePbiQuery } from '@/hooks/usePbiQuery';
import { createWebSocketClient } from '@/client/realtime/websocketClient';
import { copyToClipboard } from '@/lib/clipboard';

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
  const { data, error, isFetching, refetch } = useSessionState(sessionId, joinToken);

  const {
    connectionStatus,
    session: realtimeSession,
    setCurrentUser,
    setCurrentDisplayName,
    connect,
    disconnect,
    currentUserId,
    currentDisplayName,
    setSessionSnapshot,
    addSessionPbi,
    removeSessionPbi,
    setActivePbi,
    delegateFacilitator,
  } = useRealtimeSession();
  const [sprintFilter, setSprintFilter] = useState<string>('');
  const { data: catalogData, refetch: refetchPbis, isFetching: isFetchingPbis } = usePbiQuery(
    sprintFilter ? { sprint: sprintFilter } : undefined
  );

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
  const [shareUrl, setShareUrl] = useState<string>('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivePbiIdRef = useRef<string | null>(initialState.activePbiId ?? null);
  const previousPhaseRef = useRef<SessionState['phase']>(initialState.phase);
  const [finalizedPbiId, setFinalizedPbiId] = useState<string | null>(null);
  const [completedPbiIds, setCompletedPbiIds] = useState<string[]>([]);
  const [isFetchingSimilar, setIsFetchingSimilar] = useState(false);
  const [hostSelection, setHostSelection] = useState<string>(initialState.meta.facilitatorId);
  const [isDelegatingHost, setIsDelegatingHost] = useState(false);
  const [hostDelegateError, setHostDelegateError] = useState<string | null>(null);
  const isFacilitator = sessionState.meta.facilitatorId === currentUserId;
  const canDisplaySimilar = sessionState.phase === 'REVEAL' || sessionState.phase === 'FINALIZED';

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
        setCurrentDisplayName(parsed.name);
      }
    } catch (err) {
      console.warn('failed to bootstrap session user', err);
    }
  }, [STORAGE_KEY, setCurrentUser]);

  useEffect(() => {
    setSessionState(initialState);
  }, [initialState]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const baseUrl = window.location.origin;
    const url = joinToken
      ? `${baseUrl}/session/${sessionId}/join?token=${joinToken}`
      : window.location.href;
    setShareUrl(url);
  }, [joinToken, sessionId]);

  useEffect(() => () => {
    if (copyResetRef.current) {
      clearTimeout(copyResetRef.current);
    }
  }, []);

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
      const effectiveName = displayName?.trim().length
        ? displayName.trim()
        : currentDisplayName?.trim().length
        ? currentDisplayName.trim()
        : `user_${currentUserId.slice(-4)}`;
      connect(client, sessionId, joinToken, currentUserId, effectiveName);
    };

    setup();

    return () => {
      cancelled = true;
      disconnect();
    };
  }, [connect, disconnect, joinToken, currentUserId, sessionId, displayName, currentDisplayName]);

  useEffect(() => {
    if (displayName) {
      setCurrentDisplayName(displayName);
    }
  }, [displayName, setCurrentDisplayName]);

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
    if (!joinToken) {
      return;
    }

    if (connectionStatus === 'connected' || connectionStatus === 'connecting') {
      return;
    }

    const timer = setInterval(() => {
      void refetch();
    }, 10000);

    return () => clearInterval(timer);
  }, [connectionStatus, joinToken, refetch]);

  useEffect(() => {
    if (realtimeSession) {
      setSessionState((prev) => (prev === realtimeSession ? prev : realtimeSession));
    }
  }, [realtimeSession]);

  useEffect(() => {
    setHostSelection(sessionState.meta.facilitatorId);
  }, [sessionState.meta.facilitatorId]);

  useEffect(() => {
    if (sessionState.activePbiId) {
      lastActivePbiIdRef.current = sessionState.activePbiId;
    }
  }, [sessionState.activePbiId]);

  useEffect(() => {
    if (sessionState.phase === 'FINALIZED') {
      setFinalizedPbiId(sessionState.activePbiId ?? lastActivePbiIdRef.current ?? null);
      const completedId = sessionState.activePbiId ?? lastActivePbiIdRef.current ?? null;
      if (completedId) {
        setCompletedPbiIds((prev) => (prev.includes(completedId) ? prev : [...prev, completedId]));
      }
    } else {
      setFinalizedPbiId(null);
    }
  }, [sessionState.phase, sessionState.activePbiId]);

  useEffect(() => {
    const prevPhase = previousPhaseRef.current;
    if (prevPhase !== sessionState.phase && (sessionState.phase === 'REVEAL' || sessionState.phase === 'FINALIZED')) {
      void refetchPbis();
    }
    if (!isFacilitator && prevPhase !== 'FINALIZED' && sessionState.phase === 'FINALIZED') {
      setIsFinalizingAndRemoving(true);
    }
    previousPhaseRef.current = sessionState.phase;
  }, [sessionState.phase, refetchPbis, isFacilitator, isFinalizingAndRemoving]);

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
  }, [sessionState.meta.pbiIds, availablePbiCatalog]);

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
    const isRevealPhase = sessionState.phase === 'REVEAL' || sessionState.phase === 'FINALIZED';
    const referencePbiId = sessionState.activePbiId ?? finalizedPbiId ?? null;

    if (!isRevealPhase) {
      setSimilarPbis([]);
      setIsFetchingSimilar(false);
      return;
    }

    if (!referencePbiId) {
      setActivePbiDetail(null);
      setSimilarPbis([]);
      setIsFetchingSimilar(false);
      return;
    }

    const match =
      sessionPbis.find((item) => item.id === referencePbiId) ??
      (activePbiDetail?.id === referencePbiId ? activePbiDetail : null) ??
      availablePbiCatalog.find((item) => item.id === referencePbiId) ??
      null;
    if (match && match.id !== activePbiDetail?.id) {
      setActivePbiDetail(match);
    }

    let cancelled = false;
    setIsFetchingSimilar(true);
    const fetchSimilar = async () => {
      try {
        const votedPoints = Object.values(sessionState.votes)
          .filter((vote): vote is number => vote !== null && vote !== undefined);
        const uniquePoints = Array.from(new Set(votedPoints));

        if (uniquePoints.length === 0) {
          const response = await fetch(`/api/pbis/${referencePbiId}/similar`);
          if (!response.ok) {
            throw new Error('類似 PBI を取得できませんでした。');
          }
          const payload = (await response.json()) as SimilarPBIResponse;
          if (!cancelled) {
            setSimilarPbis(payload.items ?? []);
          }
        } else {
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
      } finally {
        if (!cancelled) {
          setIsFetchingSimilar(false);
        }
      }
    };

    fetchSimilar();

    return () => {
      cancelled = true;
      setIsFetchingSimilar(false);
    };
  }, [sessionState.activePbiId, sessionState.phase, sessionState.votes, sessionPbis, activePbiDetail?.id, finalizedPbiId, availablePbiCatalog]);

  useEffect(() => {
    if (selectingId && sessionState.activePbiId === selectingId) {
      setSelectingId(null);
    }
  }, [selectingId, sessionState.activePbiId]);

  // ポイント確定ボタン押下時のハンドラー
  const handleFinalizingStart = useCallback(() => {
    setIsFinalizingAndRemoving(true);
  }, []);

  const handleFinalizeComplete = useCallback(() => {
    void refetchPbis();
  }, [refetchPbis]);

  // FINALIZED後に自動的にPBIを削除（再選択を促す）
  useEffect(() => {
    if (
      sessionState.phase !== 'FINALIZED' ||
      !sessionState.activePbiId ||
      !joinToken ||
      !isFacilitator
    ) {
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
  }, [sessionState.phase, sessionState.activePbiId, joinToken, removeSessionPbi, isFacilitator]);

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

  const handleCopyUrl = useCallback(async () => {
    if (!shareUrl) {
      return;
    }
    try {
      await copyToClipboard(shareUrl);
      setCopyStatus('copied');
      if (copyResetRef.current) {
        clearTimeout(copyResetRef.current);
      }
      copyResetRef.current = setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      console.warn('failed to copy session url', err);
      setCopyStatus('error');
      if (copyResetRef.current) {
        clearTimeout(copyResetRef.current);
      }
      copyResetRef.current = setTimeout(() => setCopyStatus('idle'), 3000);
    }
  }, [shareUrl]);


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

  const handleDelegateHost = useCallback(
    (nextHostId: string) => {
      if (!nextHostId || nextHostId === sessionState.meta.facilitatorId) {
        setHostSelection(sessionState.meta.facilitatorId);
        return;
      }
      setIsDelegatingHost(true);
      setHostDelegateError(null);
      try {
        delegateFacilitator(nextHostId);
      } catch (error) {
        const fallbackMessage = 'ホストの委譲に失敗しました。再度お試しください。';
        let message = fallbackMessage;
        if (error instanceof Error) {
          if (error.message === 'Only host can delegate') {
            message = 'ホストのみが委譲できます。';
          } else if (error.message === 'WebSocket is not connected.') {
            message = '接続が切断されています。再接続後にお試しください。';
          } else {
            message = error.message;
          }
        }
        setHostDelegateError(message);
        setHostSelection(sessionState.meta.facilitatorId);
      } finally {
        setIsDelegatingHost(false);
      }
    },
    [delegateFacilitator, sessionState.meta.facilitatorId],
  );

  const handleSprintSearch = useCallback((sprint: string) => {
    setSprintFilter(sprint);
  }, []);

  const facilitator = useMemo(
    () =>
      sessionState.participants.find(
        (participant) => participant.userId === sessionState.meta.facilitatorId,
      ) ?? null,
    [sessionState.participants, sessionState.meta.facilitatorId],
  );

  const votingProgress = useMemo(() => {
    const total = sessionState.participants.length;
    const voted = Object.values(sessionState.votes).filter(
      (vote): vote is number => vote !== null && vote !== undefined,
    ).length;
    return { total, voted };
  }, [sessionState.participants, sessionState.votes]);

  const activeIndex = useMemo(() => {
    if (!sessionState.activePbiId) {
      return -1;
    }
    return sessionState.meta.pbiIds.findIndex((id) => id === sessionState.activePbiId);
  }, [sessionState.activePbiId, sessionState.meta.pbiIds]);

  const connectionLabel = useMemo(() => {
    switch (connectionStatus) {
      case 'connected':
        return 'オンライン';
      case 'connecting':
        return '再接続中';
      default:
        return '接続なし';
    }
  }, [connectionStatus]);

  const copyButtonLabel = useMemo(() => {
    if (!joinToken) {
      return 'URLをコピー';
    }
    if (copyStatus === 'copied') {
      return 'コピー済み';
    }
    if (copyStatus === 'error') {
      return 'コピー失敗';
    }
    return 'URLをコピー';
  }, [copyStatus, joinToken]);

  const combinedPbiError = selectionError ?? pbiActionError;
  const canDelegateHost = sessionState.participants.length > 1;

  return (
    <div className="session-page">
      {isFinalizingAndRemoving && (
        <div className="session-overlay" role="status" aria-live="assertive">
          <div className="session-overlay__panel">
            <div className="session-overlay__spinner" />
            <p className="session-overlay__title">ポイントを保存中...</p>
            <p className="session-overlay__subtitle">次の PBI を選択できるようになります</p>
          </div>
        </div>
      )}
      <div className="session-page__inner">
        <header className="session-header">
          <div className="session-header__left">
            <div className="session-header__title">
              <span className="session-header__brand">Fire Pocker</span>
              <span className="session-header__room">ルーム ID: {sessionId}</span>
            </div>
            <div className="session-header__meta">
              <span className="session-chip session-chip--neutral">
                {activeIndex >= 0
                  ? `PBI ${activeIndex + 1} / ${sessionState.meta.pbiIds.length}`
                  : `PBI 数 ${sessionState.meta.pbiIds.length}`}
              </span>
              <span className="session-chip session-chip--ghost">
                {votingProgress.voted} / {votingProgress.total} 投票完了
              </span>
              <span
                className={`session-chip ${
                  connectionStatus === 'connected'
                    ? 'session-chip--online'
                    : 'session-chip--offline'
                }`}
              >
                {connectionLabel}
              </span>
            </div>
          </div>
          <div className="session-header__right">
            {facilitator && (
              <div className="session-header__host">
                <span className="session-chip session-chip--host">ホスト</span>
                {isFacilitator ? (
                  <div className="session-host-control">
                    <select
                      className="session-host-select"
                      value={hostSelection}
                      onChange={(event) => {
                        const value = event.target.value;
                        setHostSelection(value);
                        handleDelegateHost(value);
                      }}
                      disabled={!canDelegateHost || isDelegatingHost}
                      aria-label="ホストを委譲する"
                    >
                      {sessionState.participants.map((participant) => (
                        <option key={participant.userId} value={participant.userId}>
                          {participant.displayName}
                          {participant.userId === sessionState.meta.facilitatorId ? ' (現ホスト)' : ''}
                        </option>
                      ))}
                    </select>
                    <span className="session-host-hint">
                      {isDelegatingHost
                        ? '委譲中...'
                        : canDelegateHost
                        ? '選択するとホストを変更できます'
                        : '他の参加者が必要です'}
                    </span>
                    {hostDelegateError && (
                      <span className="session-host-error">{hostDelegateError}</span>
                    )}
                  </div>
                ) : (
                  <span className="session-header__host-name">{facilitator.displayName}</span>
                )}
              </div>
            )}
            {shareUrl && (
              <button
                type="button"
                className="session-button session-button--ghost"
                onClick={handleCopyUrl}
                disabled={!joinToken}
              >
                {copyButtonLabel}
              </button>
            )}
          </div>
        </header>

        <div className="session-status-messages">
          {!joinToken && (
            <p className="session-inline-alert session-inline-alert--warning">
              JoinToken が無いためリアルタイム機能を利用できません。
            </p>
          )}
          {isFetching && (
            <p className="session-inline-alert session-inline-alert--info">セッションを同期しています...</p>
          )}
          {error && (
            <p className="session-inline-alert session-inline-alert--error">
              {(error as Error).message}
            </p>
          )}
          {copyStatus === 'error' && (
            <p className="session-inline-alert session-inline-alert--error">
              クリップボードにコピーできませんでした。ブラウザ設定をご確認ください。
            </p>
          )}
        </div>

        <main className="session-page__layout">
          <div className="session-page__left">
            <PbiSelectionPanel
              pbis={sessionPbis}
              availablePbis={availablePbiCatalog}
              activePbiId={sessionState.activePbiId}
              onSelect={handleSelectPbi}
              selectingId={selectingId}
              disabled={connectionStatus !== 'connected' || !currentUserId}
              joinToken={joinToken}
              errorMessage={combinedPbiError}
              onAdd={joinToken ? handleAddSessionPbi : undefined}
              onRemove={joinToken ? handleRemoveSessionPbi : undefined}
              managingId={managingPbiId}
              isAdding={isAddingPbi}
              excludedPbiIds={completedPbiIds}
              canManage={isFacilitator}
              onSprintSearch={handleSprintSearch}
              isSearching={isFetchingPbis}
            />

            <FibonacciPanel
              session={sessionState}
              onFinalizingStart={handleFinalizingStart}
              onFinalizeComplete={handleFinalizeComplete}
              canFinalize={isFacilitator}
            />
          </div>

          <aside className="session-page__right">
            <section className="session-card session-card--similar">
              <header className="session-card__header">
                <div>
                  <h2 className="session-card__title">過去の同一ストーリーポイント PBI</h2>
                </div>
              </header>
        {!canDisplaySimilar ? (
          <p className="session-card__empty">投票後に類似 PBI を表示します。</p>
        ) : isFetchingSimilar ? (
          <p className="session-card__empty">類似 PBI を取得しています...</p>
        ) : similarPbis.length === 0 ? (
          <p className="session-card__empty">投票ポイントの過去事例はまだありません。</p>
        ) : (() => {
                const groupedByPoint = similarPbis.reduce((acc, item) => {
                  const point = item.storyPoint ?? 0;
                  if (!acc[point]) {
                    acc[point] = [];
                  }
                  acc[point].push(item);
                  return acc;
                }, {} as Record<number, typeof similarPbis>);
                const sortedPoints = Object.keys(groupedByPoint)
                  .map(Number)
                  .sort((a, b) => a - b);
                return (
                  <div className="similar-list">
                    {sortedPoints.map((point) => (
                      <div key={point} className="similar-group">
                        <div className="similar-group__header">
                          <span className="similar-group__point">{point} pt</span>
                          <span className="similar-group__count">
                            {groupedByPoint[point].length} 件
                          </span>
                        </div>
                        <ul className="similar-items">
                          {groupedByPoint[point].map((item) => (
                            <li key={item.id} className="similar-item">
                              <div className="similar-item__body">
                                <span className="similar-item__title">{item.title}</span>
                                <div className="similar-item__meta">
                                  {item.status && (
                                    <span className="similar-item__chip">{item.status}</span>
                                  )}
                                  {item.lastEstimatedAt && (
                                    <span className="similar-item__time">
                                      {new Date(item.lastEstimatedAt).toLocaleDateString('ja-JP')}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="similar-item__actions">
                                {item.notionUrl && (
                                  <a
                                    className="similar-item__notion-link"
                                    href={item.notionUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label={`${item.title} を Notion で開く`}
                                  >
                                    <img aria-hidden="true" className="notion-icon" src="/icons/notion-logo.svg" alt="" />
                                  </a>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </section>
          </aside>
        </main>
      </div>
    </div>
  );
}

export default SessionDetailClient;
