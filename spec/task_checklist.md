# Fire Pocker 開発タスクチェックリスト

## 必須タスク

### 0. プロジェクトセットアップ
- [ ] リポジトリ初期化とブランチ運用ルール策定
- [x] pnpm/Node.js 20 環境構築とベース依存関係の追加
- [x] ESLint + Prettier + TypeScript strict 設定の適用
- [ ] CI (GitHub Actions) の雛形作成（lint・type-check・test）

### 1. Notion 連携
- [x] Notion インテグレーションと API シークレットの取得
- [x] PBI一覧DB / PBI管理DB のスキーマ定義確認と ID 収集
- [x] `@notionhq/client` を利用した共通クライアント実装
- [x] PBI 一覧取得・検索 API (`GET /api/pbis`)
- [x] 類似 PBI 取得 API (`GET /api/pbis/{id}/similar`)
- [x] ストーリーポイント更新 & 履歴登録処理 (`POST /api/sessions/{id}/finalize`)

### 2. フロントエンド (必須機能)
- [x] フォルダ構成 (feature-based) の scaffold：`app/page`, `app/(authenticated)/session/[sessionId]`
- [x] UI コンポーネント (PBI パネル、フィボナッチカード、投票状況、類似 PBI サイドパネル)
- [x] React Query + Zustand によるデータ取得・リアルタイム状態管理
- [x] WebSocket クライアントラッパーと `useRealtimeSession` フック
- [x] セッション作成フォームと `POST /api/sessions` 呼び出し
- [x] HTTP フォールバック用の `useSessionState` 実装
- [x] ROOM 作成フォームと URL 発行 (名前・Notion DB を入力してセッション作成)
- [x] 参加者向け JOIN 画面 (名前入力 + joinToken 受付)
- [x] ローカル投票 UI (フィボナッチカード・リセットなど)
- [ ] アクセシビリティ対応 (キーボード操作、ARIA 属性、ダークモード差分確認)

### 3. WebSocket / Realtime (必須分)
- [x] Next.js API + ws を用いたローカル WebSocket サーバー整備 (`/api/ws`)
- [x] `state_sync` ブロードキャスト実装
- [x] 投票系イベントハンドラ実装 (`vote_cast`, `reveal_request`, `reset_votes`, `finalize_point`)

### 4. テスト・品質保証
- [x] テストランナー (Vitest) 導入とスクリプト整備
- [x] 単体テスト (Notion/PBI サービス)
- [x] 単体テスト (セッションサービス)
- [x] API ルートテスト (GET `/api/sessions/{sessionId}`)
- [ ] 統合テスト (Docker Compose で Next.js + WS + Redis を起動)
- [ ] E2E テスト (Playwright) で主要ユーザーフローを検証

## オプションタスク

### WebSocket 拡張
- [ ] WebSocket 認証強化（joinToken 署名・TTL・多重接続制御など）
- [ ] `vote_ack` 応答を含む詳細なリアルタイム通知
- [ ] 負荷試験 (ローカルで複数クライアント) とレイテンシ測定

### Redis サイドカー
- [ ] Docker イメージ選定 (Bitnami/Redis 等) と設定 (`appendonly no`, `save ""`)
- [x] データモデル (キー管理、TTL 設定) の実装 & ユーティリティ関数
- [ ] Redis Streams を利用した再試行ワーカーの PoC
- [ ] タスク再起動時の状態再同期手順検証

### インフラ・運用
- [ ] Terraform プロジェクト初期化・環境別ワークスペース構築
- [ ] VPC / サブネット / セキュリティグループ定義
- [ ] ALB + ターゲットグループ + リスナー（HTTPS/WSS）の設定
- [ ] ECS クラスター & Fargate サービス (単一タスク) 定義
- [ ] ECR リポジトリ & CI からの push セットアップ
- [ ] S3 + CloudFront (静的アセット) 構築
- [ ] Parameter Store / Secrets Manager に値投入
- [ ] SNS + CloudWatch アラーム (接続失敗率、Redisメモリ、Notion失敗) 設計
- [ ] `joinToken` HMAC 署名ロジックと有効期限チェック
- [ ] HTTPS/WSS 強制、CORS/WAF 設定
- [ ] IAM ロール最小権限の確認 (CI/CD, ECS タスク)
- [ ] ログ基盤（構造化ログ + CloudWatch Insights クエリ）整備
- [ ] アラート・Runbook の作成と共有

### その他
- [ ] Swagger UI / Redoc 等のプレビュー環境整備

## 完了タスク
