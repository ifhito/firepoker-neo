'use client';

import { FormEvent, useEffect, useState } from 'react';

import { usePlanningPokerSession, type PbiFilters } from '../src/hooks/usePlanningPokerSession';
import { describeConnectionError } from '../src/lib/connectionErrors';
import {
  calculateUpdateState,
  synchronizeSelection,
  type ConnectionStatus,
  type SelectionState,
} from '../src/lib/sessionUiState';

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    Backlog: '#0ea5e9',
    Ready: '#22c55e',
    InProgress: '#f97316',
    Done: '#94a3b8',
    Released: '#c084fc',
  };
  const background = colors[status] ?? '#475569';
  return (
    <span
      style={{
        background,
        color: '#0f172a',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 600,
      }}
    >
      {status}
    </span>
  );
};

export default function HomePage() {
  const [filters, setFilters] = useState<PbiFilters>({ status: '', search: '', sprint: '' });
  const [selection, setSelection] = useState<SelectionState>({ point: '', memo: '' });
  const { items, status, error, events, deployment, endpoint, lastErrorCode, requestPbis, updateStoryPoint } =
    usePlanningPokerSession();

  useEffect(() => {
    if (status === 'connected') {
      requestPbis(filters);
    }
  }, [status]);

  useEffect(() => {
    setSelection((prev) => synchronizeSelection(prev, items));
  }, [items]);

  const updateGuard = calculateUpdateState(status, selection);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    requestPbis(filters);
  };

  const handleUpdate = () => {
    if (updateGuard.disabled || !selection.target || selection.point === '' || Number.isNaN(selection.point)) {
      return;
    }
    updateStoryPoint(selection.target.id, Number(selection.point), selection.memo || undefined);
  };

  const statusAppearance = getStatusAppearance(status);
  const fetchDisabled = status !== 'connected';
  const connectionNotice = lastErrorCode ? describeConnectionError(lastErrorCode) : null;

  return (
    <>
      {connectionNotice && (
        <div
          style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            zIndex: 20,
            background: 'rgba(248, 113, 113, 0.95)',
            color: '#0f172a',
            padding: '1rem',
            borderRadius: '0.75rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            maxWidth: '320px',
          }}
        >
          <strong style={{ display: 'block', marginBottom: '0.5rem' }}>接続エラー</strong>
          <span style={{ fontSize: '0.9rem' }}>{connectionNotice}</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: '0.75rem',
              width: '100%',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.5rem 0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: '#0f172a',
              color: '#f8fafc',
            }}
          >
            ページを再読み込み
          </button>
        </div>
      )}
      <main
        style={{
          width: 'min(1080px, 100%)',
          display: 'grid',
          gap: '1.5rem',
          gridTemplateColumns: '1fr',
        }}
      >
      <section
        style={{
          padding: '1.5rem',
          borderRadius: '1rem',
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1rem',
            marginBottom: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Fire Pocker Serverless</h1>
            <p style={{ margin: 0, color: '#94a3b8' }}>API Gateway WebSocket + Lambda + S3 (CSR)</p>
          </div>
          <a
            href="/session/create"
            style={{
              border: '1px solid rgba(148, 163, 184, 0.5)',
              borderRadius: '999px',
              padding: '0.4rem 1rem',
              textDecoration: 'none',
              color: '#e2e8f0',
              fontWeight: 600,
            }}
          >
            セッションを作成
          </a>
          <div style={{ textAlign: 'right', display: 'grid', gap: '0.5rem' }}>
            <div>
              <span style={{ fontSize: '0.875rem', color: '#cbd5f5' }}>WebSocket status</span>
              <div
                style={{
                  marginTop: '0.25rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: 700,
                  fontSize: '1rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '999px',
                  color: statusAppearance.color,
                  background: statusAppearance.background,
                }}
              >
                <span
                  style={{
                    width: '0.5rem',
                    height: '0.5rem',
                    borderRadius: '999px',
                    background: statusAppearance.dot,
                    display: 'inline-block',
                  }}
                />
                {statusAppearance.label}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.875rem', color: '#cbd5f5' }}>Environment</span>
              <div style={{ fontWeight: 600 }}>{deployment.stageName}</div>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{deployment.siteUrl}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{endpoint}</div>
            </div>
            {error && (
              <div style={{ marginTop: '0.25rem', color: '#f87171', fontSize: '0.85rem', maxWidth: '240px' }}>{error}</div>
            )}
          </div>
        </header>

        <form
          onSubmit={handleSubmit}
          style={{
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            alignItems: 'end',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
            <span>Status</span>
            <input
              type="text"
              placeholder="Ready"
              value={filters.status ?? ''}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
            <span>Search keyword</span>
            <input
              type="text"
              placeholder="Search by title"
              value={filters.search ?? ''}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
            <span>Sprint</span>
            <input
              type="text"
              placeholder="Sprint 15"
              value={filters.sprint ?? ''}
              onChange={(event) => setFilters((prev) => ({ ...prev, sprint: event.target.value }))}
              style={inputStyle}
            />
          </label>
          <button
            type="submit"
            disabled={fetchDisabled}
            style={{
              border: 'none',
              borderRadius: '0.75rem',
              padding: '0.875rem 1.25rem',
              fontWeight: 700,
              background: fetchDisabled ? '#334155' : '#22d3ee',
              color: fetchDisabled ? '#94a3b8' : '#0f172a',
              cursor: fetchDisabled ? 'not-allowed' : 'pointer',
              transition: 'transform 0.15s ease',
            }}
          >
            {fetchDisabled ? 'Connecting...' : 'Fetch PBIs'}
          </button>
        </form>
      </section>

      <section
        style={{
          padding: '1.5rem',
          borderRadius: '1rem',
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Product Backlog Items</h2>
          <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{items.length} items</span>
        </header>

        <div style={{ overflow: 'auto', maxHeight: '360px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: '0.8rem', color: '#94a3b8' }}>
                <th style={tableHeaderStyle}>Title</th>
                <th style={tableHeaderStyle}>Status</th>
                <th style={tableHeaderStyle}>Story Point</th>
                <th style={tableHeaderStyle}>Sprint</th>
                <th style={tableHeaderStyle}>Assignee</th>
                <th style={tableHeaderStyle}>Last Estimated</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  style={{
                    background: selection.target?.id === item.id ? 'rgba(34, 211, 238, 0.08)' : 'transparent',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelection((prev) => ({ ...prev, target: item }))}
                >
                  <td style={tableCellStyle}>
                    <div style={{ fontWeight: 600 }}>{item.title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.id}</div>
                  </td>
                  <td style={tableCellStyle}>
                    <StatusBadge status={item.status} />
                  </td>
                  <td style={tableCellStyle}>{item.storyPoint ?? '-'}</td>
                  <td style={tableCellStyle}>{item.sprint ?? '-'}</td>
                  <td style={tableCellStyle}>{item.assignee ?? '-'}</td>
                  <td style={tableCellStyle}>
                    {item.lastEstimatedAt ? new Date(item.lastEstimatedAt).toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td style={{ ...tableCellStyle, textAlign: 'center' }} colSpan={6}>
                    No PBIs were found. Adjust the filters or verify the Lambda WebSocket endpoint.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section
        style={{
          padding: '1.5rem',
          borderRadius: '1rem',
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Finalize Story Point</h2>
          <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            {selection.target ? `Selected: ${selection.target.title}` : 'Select an item above'}
          </span>
        </header>

        <div
          style={{
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            alignItems: 'end',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
            <span>Story Point</span>
            <input
              type="number"
              placeholder="5"
              value={selection.point}
              onChange={(event) =>
                setSelection((prev) => ({
                  ...prev,
                  point: event.target.value === '' ? '' : Number(event.target.value),
                }))
              }
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
            <span>Memo (optional)</span>
            <input
              type="text"
              placeholder="Key discussions..."
              value={selection.memo}
              onChange={(event) => setSelection((prev) => ({ ...prev, memo: event.target.value }))}
              style={inputStyle}
            />
          </label>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={updateGuard.disabled}
            style={{
              border: 'none',
              borderRadius: '0.75rem',
              padding: '0.875rem 1.25rem',
              fontWeight: 700,
              background: updateGuard.disabled ? '#334155' : '#facc15',
              color: updateGuard.disabled ? '#94a3b8' : '#0f172a',
              cursor: updateGuard.disabled ? 'not-allowed' : 'pointer',
              transition: 'transform 0.15s ease',
            }}
          >
            Send Update
          </button>
          {updateGuard.message && (
            <span style={{ gridColumn: '1 / -1', color: '#f87171', fontSize: '0.85rem' }}>{updateGuard.message}</span>
          )}
        </div>
      </section>

      <section
        style={{
          padding: '1.5rem',
          borderRadius: '1rem',
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Event Log</h2>
          <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>最新 15 件を表示</span>
        </header>
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.65)',
            borderRadius: '0.75rem',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            padding: '1rem',
            display: 'grid',
            gap: '0.5rem',
          }}
        >
          {events.map((event, index) => (
            <span key={index} style={{ fontFamily: 'Menlo, Consolas, monospace', fontSize: '0.8rem' }}>
              {event}
            </span>
          ))}
          {events.length === 0 && <span style={{ color: '#64748b', fontSize: '0.8rem' }}>イベントログはまだありません。</span>}
        </div>
      </section>
      </main>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  borderRadius: '0.75rem',
  border: '1px solid rgba(148, 163, 184, 0.35)',
  padding: '0.75rem 1rem',
  background: '#0f172a',
  color: '#f8fafc',
  fontSize: '0.95rem',
};

const statusAppearanceMap: Record<ConnectionStatus, { label: string; color: string; background: string; dot: string }> = {
  connecting: {
    label: 'Connecting',
    color: '#fbbf24',
    background: 'rgba(251, 191, 36, 0.15)',
    dot: '#fbbf24',
  },
  connected: {
    label: 'Connected',
    color: '#22d3ee',
    background: 'rgba(34, 211, 238, 0.15)',
    dot: '#22d3ee',
  },
  error: {
    label: 'Error',
    color: '#f87171',
    background: 'rgba(248, 113, 113, 0.15)',
    dot: '#f87171',
  },
  closed: {
    label: 'Closed',
    color: '#94a3b8',
    background: 'rgba(148, 163, 184, 0.15)',
    dot: '#94a3b8',
  },
};

const getStatusAppearance = (status: ConnectionStatus) => statusAppearanceMap[status] ?? statusAppearanceMap.closed;

const tableHeaderStyle: React.CSSProperties = {
  padding: '0.75rem',
  borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
  position: 'sticky',
  top: 0,
  background: '#0f172a',
  zIndex: 1,
};

const tableCellStyle: React.CSSProperties = {
  padding: '0.75rem',
  borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
  fontSize: '0.9rem',
};
