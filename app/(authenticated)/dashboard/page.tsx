import Link from 'next/link';
import { listPbis } from '@/server/pbi/service';
import { countSessions } from '@/server/session/store';
import { ensureDemoSession } from '@/server/session/seed';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  ensureDemoSession();
  const { items } = await listPbis({ status: 'Ready' });
  const activeSessions = countSessions();

  return (
    <section className="card">
      <div className="badge">PBI 一覧</div>
      <h2>今すぐ見積もり可能な PBI</h2>
      <p>Notion から同期された Ready ステータスのアイテムを表示しています。</p>
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
                <Link className="badge" href={`/(authenticated)/session/sess_demo?pbi=${item.id}`}>
                  セッションで確認
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        現在のアクティブセッション: <strong>{activeSessions}</strong>
      </p>
    </section>
  );
}
