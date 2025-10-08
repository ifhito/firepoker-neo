# Fire Pocker 開発タスクチェックリスト

## 0. プロジェクトセットアップ
- [ ] リポジトリ初期化とブランチ運用ルール策定
- [ ] pnpm/Node.js 20 環境構築とベース依存関係の追加
- [ ] ESLint + Prettier + TypeScript strict 設定の適用
- [ ] CI (GitHub Actions) の雛形作成（lint・type-check・test）

## 1. Notion 連携
- [ ] Notion インテグレーションと API シークレットの取得
- [ ] PBI一覧DB / PBI管理DB のスキーマ定義確認と ID 収集
- [ ] `@notionhq/client` を利用した共通クライアント実装
- [ ] PBI 一覧取得・検索 API (`GET /api/pbis`) の実装
- [ ] 類似 PBI 取得 API (`GET /api/pbis/{id}/similar`) の実装
- [ ] ストーリーポイント更新 & 履歴登録処理の実装 (`POST /api/sessions/{id}/finalize`)

## 2. フロントエンド (Next.js App Router, Feature-based)
- [ ] フォルダ構成 (feature-based) の scaffold：`app/(authenticated)/dashboard`, `session/[sessionId]`, `settings`
- [ ] UI コンポーネント (PBI パネル、フィボナッチカード、投票状況、類似 PBI サイドパネル)
- [ ] React Query + Zustand によるデータ取得・リアルタイム状態管理
- [ ] WebSocket クライアントラッパーと `useRealtimeSession` フック
- [ ] セッション作成フォームと `POST /api/sessions` 呼び出し
- [ ] HTTP フォールバック用の `useSessionState` 実装
- [ ] アクセシビリティ対応 (キーボード操作、ARIA 属性、ダークモード差分確認)

## 3. WebSocket サーバー
- [ ] Fastify/Express + ws を用いたサーバー基盤作成 (`/ws`)
- [ ] 認証 (`joinToken` 検証) と接続管理
- [ ] Redis との連携 (接続、WATCH/MULTI 或いは Lua)
- [ ] イベントハンドラ実装 (`vote_cast`, `reveal_request`, `reset_votes`, `finalize_point`)
- [ ] `state_sync` ブロードキャストおよび `vote_ack` 応答
- [ ] エラーハンドリング／リトライ／Notion 更新失敗時キュー投入
- [ ] 負荷試験 (ローカルで複数クライアント) とレイテンシ測定

## 4. Redis サイドカー
- [ ] Docker イメージ選定 (Bitnami/Redis 等) と設定 (`appendonly no`, `save ""`)
- [ ] データモデル (キー管理、TTL 設定) の実装 & ユーティリティ関数
- [ ] Redis Streams を利用した再試行ワーカーの PoC
- [ ] タスク再起動時の状態再同期手順検証

## 5. API 層
- [ ] App Router Route Handlers (`/api/*`) の実装とバリデーション (Zod 等)
- [ ] 共通レスポンス (`{ code, message, retryable }`) の実装
- [ ] OpenAPI (`spec/api/openapi.yaml`) と実装の同期（自動生成・検証フロー検討）
- [ ] Swagger UI / Redoc 等のプレビュー環境整備

## 6. インフラ (AWS)
- [ ] Terraform プロジェクト初期化・環境別ワークスペース構築
- [ ] VPC / サブネット / セキュリティグループ定義
- [ ] ALB + ターゲットグループ + リスナー（HTTPS/WSS）の設定
- [ ] ECS クラスター & Fargate サービス (単一タスク) 定義
- [ ] ECR リポジトリ & CI からの push セットアップ
- [ ] S3 + CloudFront (静的アセット) 構築
- [ ] Parameter Store / Secrets Manager に値投入
- [ ] SNS + CloudWatch アラーム (接続失敗率、Redisメモリ、Notion失敗) 設計

## 7. セキュリティ・オペレーション
- [ ] `joinToken` HMAC 署名ロジックと有効期限チェック
- [ ] HTTPS/WSS 強制、CORS/WAF 設定
- [ ] IAM ロール最小権限の確認 (CI/CD, ECS タスク)
- [ ] ログ基盤（構造化ログ + CloudWatch Insights クエリ）整備
- [ ] アラート・Runbook の作成と共有

## 8. テスト・品質保証
- [ ] 単体テスト (Notion リポジトリ、WebSocket ハンドラ、Redis ユーティリティ)
- [ ] 統合テスト (Docker Compose で Next.js + WS + Redis を起動)
- [ ] E2E テスト (Playwright) で主要ユーザーフローを検証
- [ ] パフォーマンステスト（Locust/K6 等で WebSocket/REST の負荷確認）
- [ ] セキュリティチェック (依存関係監査、OWASP cheat sheet の確認)

## 9. デプロイ・リリース
- [ ] GitHub Actions → ECR/ECS デプロイパイプライン構築
- [ ] ブルー/グリーン またはロールアウト戦略の定義
- [ ] 環境別設定 (dev/stg/prod) のドキュメント化
- [ ] ロールバック手順とサイト公開手順書の作成

## 10. ドキュメント・ナレッジ共有
- [ ] README / CONTRIBUTING 更新 (セットアップ、コマンド一覧、アーキテクチャ概要)
- [ ] Notion 連携手順書・API キー管理ポリシー作成
- [ ] 運用 Runbook (アラート対応、障害時再起動手順)
- [ ] 開発完了後のふりかえりミーティングと改善記録
