'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { CreateSessionForm } from './components/CreateSessionForm';
import { usePbiQuery } from '@/hooks/usePbiQuery';

interface DashboardContentProps {
  initialActiveSessions: number;
}

export function DashboardContent({ initialActiveSessions }: DashboardContentProps) {
  const { data, isLoading, error } = usePbiQuery();
  const items = data?.items ?? [];

  const statusSummary = useMemo(() => {
    return items.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [items]);

  return (
    <div className="dashboard-grid">
      <section className="card">
        <div className="badge">PBI 一覧</div>
        <h2>見積もり候補</h2>
        {isLoading && <p>読み込み中...</p>}
        {error && <p className="feedback error">{(error as Error).message}</p>}
        {!isLoading && !error && items.length === 0 && (
          <p className="feedback warning">登録された PBI がありません。</p>
        )}
        {!isLoading && !error && items.length > 0 && (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>タイトル</th>
                  <th>担当</th>
                  <th>ストーリーポイント</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div>{item.title}</div>
                      <div className="tag-list">
                        <span className="tag">{item.status}</span>
                        {item.epic ? <span className="tag">{item.epic}</span> : null}
                      </div>
                    </td>
                    <td>{item.assignee ?? '未割り当て'}</td>
                    <td>{item.storyPoint ?? '未設定'}</td>
                    <td>
                      <Link className="badge" href={`/session/sess_demo?pbi=${item.id}`}>
                        セッションで確認
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="tag-list">
              {Object.entries(statusSummary).map(([status, count]) => (
                <span key={status} className="tag">
                  {status}: {count}
                </span>
              ))}
            </div>
            <p>
              現在のアクティブセッション: <strong>{initialActiveSessions}</strong>
            </p>
          </>
        )}
      </section>
      <CreateSessionForm pbis={items} />
    </div>
  );
}

export default DashboardContent;
