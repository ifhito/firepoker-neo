'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ProductBacklogItem } from '../domain/pbi';
import { resolveDeploymentMetadata, resolveWebSocketEndpoint } from '../config/websocket';
import type { ConnectionStatus } from '../lib/sessionUiState';

export interface PbiFilters {
  status?: string;
  search?: string;
  sprint?: string;
}

interface PlanningPokerSession {
  items: ProductBacklogItem[];
  status: ConnectionStatus;
  error: string | null;
  events: string[];
  endpoint: string;
  deployment: { stageName: string; siteUrl: string };
  lastErrorCode: string | null;
  requestPbis(filters: PbiFilters): boolean;
  updateStoryPoint(pbiId: string, point: number, memo?: string): boolean;
}

const pushEvent = (prev: string[], message: string) => [message, ...prev].slice(0, 15);

export const usePlanningPokerSession = (): PlanningPokerSession => {
  const [items, setItems] = useState<ProductBacklogItem[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [lastErrorCode, setLastErrorCode] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const latestFiltersRef = useRef<PbiFilters>({});
  const endpoint = useMemo(() => resolveWebSocketEndpoint(), []);
  const deployment = useMemo(() => resolveDeploymentMetadata(), []);

  useEffect(() => {
    const websocket = new WebSocket(endpoint);
    wsRef.current = websocket;
    setStatus('connecting');
    setError(null);
    setLastErrorCode(null);
    setEvents((prev) => pushEvent(pushEvent(prev, `環境: ${deployment.stageName} @ ${deployment.siteUrl}`), `Connecting to ${endpoint}`));

    websocket.onopen = () => {
      setStatus('connected');
      setEvents((prev) => pushEvent(prev, `WebSocket connected (${deployment.stageName})`));
      setLastErrorCode(null);
      if (latestFiltersRef.current) {
        send(websocket, { action: 'listPbis', ...normalizeFilters(latestFiltersRef.current) });
      }
    };

    websocket.onerror = () => {
      setStatus('error');
      setError('接続エラーが発生しました。エンドポイント設定を確認してください。');
      setEvents((prev) => pushEvent(prev, 'WebSocket error'));
      setLastErrorCode('NETWORK_ERROR');
    };

    websocket.onclose = () => {
      setStatus('closed');
      setEvents((prev) => pushEvent(prev, 'WebSocket closed'));
    };

    websocket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data as string);
        setEvents((prev) =>
          pushEvent(prev, `← ${payload.type ?? 'message'}${payload.message ? `: ${payload.message}` : ''}`),
        );
        switch (payload.type) {
          case 'listPbisResult':
            setItems(Array.isArray(payload.items) ? payload.items : []);
            setLastErrorCode(null);
            break;
          case 'updateStoryPointResult':
            setItems((current) =>
              current.map((item) =>
                item.id === payload.pbiId ? { ...item, storyPoint: payload.point ?? item.storyPoint } : item,
              ),
            );
            setLastErrorCode(null);
            break;
          case 'error':
            if (typeof payload.message === 'string') {
              setError(payload.message);
            }
            setLastErrorCode(typeof payload.code === 'string' ? payload.code : null);
            break;
          default:
            break;
        }
      } catch (parseError) {
        console.warn('Failed to parse WebSocket payload', parseError);
      }
    };

    return () => {
      websocket.close();
      if (wsRef.current === websocket) {
        wsRef.current = null;
      }
    };
  }, [deployment, endpoint]);

  const requestPbis = useCallback(
    (filters: PbiFilters) => {
      latestFiltersRef.current = filters;

      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setError('WebSocket が接続されていません');
        return false;
      }

      setEvents((prev) => pushEvent(prev, '→ listPbis'));
      return send(wsRef.current, { action: 'listPbis', ...normalizeFilters(filters) });
    },
    [],
  );

  const updateStoryPoint = useCallback((pbiId: string, point: number, memo?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('WebSocket が接続されていません');
      return false;
    }

    setEvents((prev) => pushEvent(prev, `→ updateStoryPoint (${pbiId})`));
    return send(wsRef.current, { action: 'updateStoryPoint', pbiId, point, memo });
  }, []);

  return {
    items,
    status,
    error,
    events,
    endpoint,
    deployment,
    lastErrorCode,
    requestPbis,
    updateStoryPoint,
  };
};

const normalizeFilters = (filters: PbiFilters) => {
  const trimmed = (value?: string) => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined);
  return {
    status: trimmed(filters.status),
    search: trimmed(filters.search),
    sprint: trimmed(filters.sprint),
  };
};

const send = (socket: WebSocket, payload: unknown) => {
  try {
    socket.send(JSON.stringify(payload));
    return true;
  } catch (error) {
    console.error('Failed to send message', error);
    return false;
  }
};
