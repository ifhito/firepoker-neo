import { notionEnv } from '@/server/notion/config';

export const dynamic = 'force-static';

const settingItems = [
  {
    name: 'Notion Token',
    value: notionEnv.NOTION_TOKEN ? '設定済み' : '未設定 (モックデータ使用中)',
    description: '本番環境では AWS Secrets Manager から提供されます。',
  },
  {
    name: 'PBI Database ID',
    value: notionEnv.NOTION_PBI_DB_ID ?? '未設定',
    description: '対象の Notion データベース ID。App Router のルートハンドラーで利用します。',
  },
  {
    name: 'Session Database ID',
    value: notionEnv.NOTION_SESSION_DB_ID ?? '未設定',
    description: '見積もり結果を記録する履歴用 DB。Notion API 経由で書き込みます。',
  },
];

export default function SettingsPage() {
  return (
    <section className="card">
      <div className="badge">システム設定</div>
      <h2>インテグレーション設定の確認</h2>
      <p>Notion 連携やセッション管理に必要な環境変数の状態を表示します。</p>
      <table className="table">
        <thead>
          <tr>
            <th>項目</th>
            <th>値</th>
            <th>説明</th>
          </tr>
        </thead>
        <tbody>
          {settingItems.map((item) => (
            <tr key={item.name}>
              <td>{item.name}</td>
              <td>{item.value}</td>
              <td>{item.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
