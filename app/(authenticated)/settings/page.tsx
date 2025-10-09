import { notionEnv, notionPropertyConfig } from '@/server/notion/config';

export const dynamic = 'force-static';

const baseItems = [
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
    description: '見積もり結果を記録する履歴用 DB。指定が無ければ Notion には追記されません。',
  },
];

const propertyItems = [
  { name: 'Title property', value: notionPropertyConfig.title ?? 'Title' },
  { name: 'Status property', value: notionPropertyConfig.status ?? 'Status' },
  { name: 'StoryPoint property', value: notionPropertyConfig.storyPoint ?? 'StoryPoint' },
  { name: 'Assignee property', value: notionPropertyConfig.assignee ?? 'Assignee' },
  { name: 'Epic property', value: notionPropertyConfig.epic ?? 'Epic' },
  {
    name: 'LastEstimatedAt property',
    value: notionPropertyConfig.lastEstimatedAt ?? 'LastEstimatedAt',
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
          {baseItems.map((item) => (
            <tr key={item.name}>
              <td>{item.name}</td>
              <td>{item.value}</td>
              <td>{item.description}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>使用中の PBI プロパティ名</h3>
      <p>未設定の場合は括弧内のデフォルト値が利用されます。</p>
      <ul>
        {propertyItems.map((item) => (
          <li key={item.name}>
            {item.name}: <code>{item.value}</code>
          </li>
        ))}
      </ul>
    </section>
  );
}
