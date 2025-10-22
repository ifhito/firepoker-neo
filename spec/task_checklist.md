# Fire Pocker 開発タスクチェックリスト

## 必須タスク

### 0. プロジェクトセットアップ
- [x] リポジトリ初期化とブランチ運用ルール策定
- [x] pnpm/Node.js 20 環境構築とベース依存関係の追加
- [x] ESLint + Prettier + TypeScript strict 設定の適用
- [ ] CI (GitHub Actions) の雛形作成（lint・type-check・test）

### 1. Notion 連携
- [x] Notion インテグレーションと API シークレットの取得
- [x] PBI一覧DB / PBI管理DB のスキーマ定義確認と ID 収集
- [x] `@notionhq/client` を利用した共通クライアント実装 (RealNotionClient/MockNotionClient)
- [x] PBI 一覧取得・検索 API (`GET /api/pbis`)
- [x] 類似 PBI 取得 API (`GET /api/pbis/{id}/similar`)
- [x] 複数ポイントによるPBI取得 API (`GET /api/pbis/by-points`)
- [x] ストーリーポイント更新 & 履歴登録処理 (`POST /api/sessions/{id}/finalize`)
- [x] Status型プロパティ対応
- [x] ストーリーポイント未設定PBIのフィルタリング
- [x] チケット種別/ステータスがPBIのページ限定取得
- [x] ポイント数値プロパティへのストーリーポイント更新対応
- [x] Status型プロパティからの状態読み取り改善
- [x] 類似PBI参照結果を直近2スプリント以内に制限
- [x] ポイント履歴参照APIを直近2スプリント以内に制限

## 2. フロントエンド (Next.js App Router, Feature-based)
- [x] フォルダ構成 (feature-based) の scaffold：`app/page`, `app/intake`, `app/(authenticated)/session/[sessionId]`
- [x] UI コンポーネント (PBI パネル、フィボナッチカード、投票状況、類似 PBI サイドパネル)
- [x] React Query + Zustand によるデータ取得・リアルタイム状態管理
- [x] Socket.IO クライアントラッパーと `useRealtimeSession` フック
- [x] セッション作成フォームと `POST /api/sessions` 呼び出し
- [x] HTTP フォールバック用の `useSessionState` 実装
- [x] ROOM 作成フォームと URL 発行 (名前・PBI選択でセッション作成)
- [x] 参加者向け JOIN 画面 (名前入力 + joinToken 受付)
- [x] ローカル投票 UI (フィボナッチカード・リセット・自動REVEAL)
- [x] ポイント確定UI (ストーリーポイント設定・Notion保存)
- [x] 類似PBI表示 (投票されたポイントの過去事例表示)
- [x] PBI追加・削除・切り替え機能
- [x] ローディング画面表示 (ポイント確定後の自動処理)
- [x] 参加者投票状況の可視化
- [x] キーボード操作対応 (矢印キーでフィボナッチカード選択)
- [ ] ARIA 属性の完全対応
- [ ] ダークモード対応

## 3. WebSocket サーバー
- [x] Socket.IO を用いたサーバー基盤作成 (`/api/socketio`)
- [x] 認証 (`joinToken` 検証) と接続管理
- [x] Redis との連携 (接続、セッション状態管理)
- [x] イベントハンドラ実装 (`vote_cast`, `reveal_request`, `reset_votes`, `finalize_point`, `delegate_facilitator`, `pbi_add`, `pbi_remove`, `pbi_set_active`)
- [x] `state_sync` ブロードキャストおよび自動REVEAL機能
- [x] エラーハンドリング基本実装
- [ ] リトライ／Notion 更新失敗時キュー投入
- [ ] 負荷試験 (ローカルで複数クライアント) とレイテンシ測定

### Redis サイドカー
- [x] Docker イメージ選定 (redis:7-alpine) と設定 (`appendonly no`, `save ""`)
- [x] データモデル (キー管理、TTL 設定) の実装 & ユーティリティ関数
- [x] docker-compose.redis.yml によるローカル環境構築
- [ ] Redis Streams を利用した再試行ワーカーの PoC
- [ ] タスク再起動時の状態再同期手順検証

### インフラ・運用
- [x] Dockerfile 作成 (multi-stage build)
- [x] .dockerignore 作成
- [x] docker-compose.yml 作成 (app + redis)
- [x] Next.js standalone output 設定
- [x] ECS タスク定義作成 (Fargate, app + redis サイドカー)
- [x] ヘルスチェック API (`/api/health`) 実装
- [x] ECR プッシュスクリプト作成
- [x] ECS デプロイスクリプト作成
- [x] GitHub Actions ワークフロー作成 (CI/CD)
- [x] デプロイドキュメント作成
- [x] Terraform プロジェクト初期化・環境別ワークスペース構築
- [x] VPC / サブネット / セキュリティグループ定義
- [x] ALB + ターゲットグループ + リスナー（HTTP/HTTPS）の設定
- [x] ECS クラスター作成 (Fargate対応)
- [x] ECR リポジトリ作成
- [x] Secrets Manager にシークレット登録
- [x] IAM ロール設定 (Task Execution Role, Task Role)
- [x] CloudWatch Logs 設定
- [x] Auto Scaling 設定 (CPU/メモリベース)
- [x] Terraform セットアップスクリプト作成
- [x] Terraform クリーンアップスクリプト作成
- [x] Terraform ドキュメント作成 (README.md)
- [x] ARM64 アーキテクチャ対応 (Dockerビルド & ECS Fargate)
- [x] IP制限実装 (ALBセキュリティグループ)
- [x] crypto.randomUUID エラーの修正 (nanoid で代替実装)
- [x] generateUserId 関数の追加とテスト作成
- [x] Clipboard API のHTTP環境対応 (execCommand フォールバック実装)
- [x] スプリント未指定時のPBI全件取得防止（パフォーマンス対策）
- [x] 動的ルートの静的生成無効化（ECSヘルスチェック対応）
- [x] PbiSelectionPanel のスプリント検索フォーム表示条件修正
- [x] ECSヘルスチェック設定の最適化（安定性向上）
- [ ] S3 + CloudFront (静的アセット) 構築
- [ ] SNS + CloudWatch アラーム (接続失敗率、Redisメモリ、Notion失敗) 設計
- [ ] `joinToken` HMAC 署名ロジックと有効期限チェック
- [ ] HTTPS/WSS 強制、CORS/WAF 設定
- [ ] IAM ロール最小権限の確認 (CI/CD, ECS タスク)
- [ ] ログ基盤（構造化ログ + CloudWatch Insights クエリ）整備
- [ ] アラート・Runbook の作成と共有

### その他
- [ ] Swagger UI / Redoc 等のプレビュー環境整備

## 完了タスク
