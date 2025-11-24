# Product Overview

Fire Pocker Neo は Notion に蓄積されたプロダクトバックログアイテム(PBI)をリアルタイム見積もりへ持ち込み、チームのプランニングポーカーを支援する実験用プラットフォームです。Next.js 14 の App Router アプリ (container/) と API Gateway + Lambda + CSR Next.js (serverless/) を 1 つのモノレポで比較検証できるように設計されています。

## Core Capabilities

- **Notion 連携**: `getNotionClient` が環境変数を検証し、実 Notion API かモックデータかを自動的に切り替えて PBI を提供します。
- **リアルタイム見積もり**: Socket.IO と API Gateway WebSocket の 2 系統で `session` 状態と投票イベントを即時同期し、ファシリテーター委譲や reveal/reset 操作を届けます。
- **デュアルデプロイ**: ECS/Fargate で動くコンテナアプリと、S3+CloudFront 配信の CSR フロント＋Lambda を同時にメンテし、チームが要件に応じて構成を選べます。
- **セッション自動化**: `ensureDemoSession` によるデモデータ投入、類似 PBI 提案(`listSimilarPbis`)など、見積もり準備をコードで再現します。
- **安全なフォールバック**: Redis を用意できない場合は `USE_REDIS_MOCK` で `ioredis-mock` に切り替わり、環境差を吸収した検証が行えます。

## Target Use Cases

- Notion を単一のバックログ基盤として使うスクラムチームが、オンライン/リモートで計画ミーティングを回す。
- コンテナ常駐アプリとフルサーバーレス構成を比較し、どちらがチームや組織に適しているかを検証する PoC。
- 既存の Notion DB を壊さずに、モックで UI/リアルタイム挙動を社内デモする。
- ファシリテーター交代やメモ付き確定など、運営上のワークフローを事前に練習する。

## Value Proposition

- Notion のスキーマや PBI 状態を直接参照しつつ、軽量な UI とリアルタイム基盤で「会議の摩擦」を減らす。
- 同じドメインモデルを共有したまま、サーバーフル機能版とサーバーレス版を切り替えられるため、将来の移行コストを最小化できる。
- App Router / Lambda いずれも TypeScript で書かれており、ドメイン型を共有することで推論しやすいコードベースを維持する。
- Redis・Notion・WebSocket など外部依存の有無を環境変数だけで制御し、デモ～本番まで同じ操作で進行できる。

---
_軽量なパターンと価値に集中し、詳細機能一覧は別途 README/Specs に委ねます_
