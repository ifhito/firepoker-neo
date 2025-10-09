import Link from 'next/link';

const checklist = [
  {
    title: 'セッション管理',
    description: 'Notion の PBI を選択して見積もりセッションを開始。参加者は招待コードで参加します。',
    href: '/(authenticated)/dashboard',
    items: ['対象 PBI の検索', 'セッション作成と進行ステータス', '投票完了後の結果共有'],
  },
  {
    title: 'リアルタイム投票',
    description:
      'WebSocket サーバーと連携してフィボナッチカードでの投票・開示・再投票を制御します。',
    href: '/(authenticated)/session/sess_demo',
    items: ['匿名投票と開示リクエスト', 'reset/reveal/finalize の状態遷移', 'Notion への書き戻しフロー'],
  },
  {
    title: '設定 & ナレッジ',
    description:
      'Notion 連携設定や過去セッションの履歴確認、類似 PBI 推薦アルゴリズムを調整します。',
    href: '/(authenticated)/settings',
    items: ['Notion DB ID の管理', 'ストーリーポイント候補設定', '監査ログのエクスポート'],
  },
];

export default function Home() {
  return (
    <div className="card-grid">
      {checklist.map((section) => (
        <article key={section.title} className="card">
          <div className="badge">設計ガイド</div>
          <h2>{section.title}</h2>
          <p>{section.description}</p>
          <ul>
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Link className="badge" href={section.href}>
            プロトタイプを見る
          </Link>
        </article>
      ))}
    </div>
  );
}
