# FirePoker ドキュメント

FirePokerの各種ドキュメントへのインデックスです。

## 📚 ドキュメント一覧

### 🚀 開始する

- **[README.md](../README.md)** - プロジェクト概要と基本的な使い方
- **[quick-start.md](./quick-start.md)** - 5分でAWSにデプロイ ⚡

### 🏗️ インフラ

- **[infrastructure.md](./infrastructure.md)** - 完全インフラ構築ガイド 📖
  - アーキテクチャ図
  - 詳細なセットアップ手順
  - 運用・トラブルシューティング
  - コスト管理
  - セキュリティベストプラクティス

- **[terraform/README.md](../terraform/README.md)** - Terraform使用ガイド
  - Terraformの基本操作
  - 環境別設定（dev/prod）
  - 変数とカスタマイズ

- **[ecs-deployment.md](./ecs-deployment.md)** - ECS デプロイメントガイド
  - Docker イメージのビルドとプッシュ
  - GitHub Actions による CI/CD

### 📐 設計

- **[spec/fire_pocker_spec.md](../spec/fire_pocker_spec.md)** - システム仕様書
- **[spec/system_design.md](../spec/system_design.md)** - システム設計書
- **[spec/task_checklist.md](../spec/task_checklist.md)** - 開発タスクチェックリスト
- **[spec/api/openapi.yaml](../spec/api/openapi.yaml)** - OpenAPI 仕様

### 🔧 アーキテクチャ決定記録 (ADR)

- **[spec/adr/0001-websocket-architecture-on-aws.md](../spec/adr/0001-websocket-architecture-on-aws.md)**
- **[spec/adr/0002-realtime-protocol-choice.md](../spec/adr/0002-realtime-protocol-choice.md)**

### 🌊 ユーザーフロー

- **[user_flow.md](./user_flow.md)** - ユーザー操作フロー
- **[realtime_architecture.md](./realtime_architecture.md)** - リアルタイム通信アーキテクチャ

## 🎯 目的別ガイド

### 初めてデプロイする

1. [quick-start.md](./quick-start.md) で概要を把握
2. [infrastructure.md](./infrastructure.md) の「前提条件」セクションで準備
3. [infrastructure.md](./infrastructure.md) の「初回セットアップ」でデプロイ

### Terraformを理解する

1. [terraform/README.md](../terraform/README.md) で基本を学習
2. [infrastructure.md](./infrastructure.md) の「アーキテクチャ」でリソース構成を確認
3. [terraform/main.tf](../terraform/main.tf) のコードを確認

### トラブルシューティング

1. [infrastructure.md](./infrastructure.md) の「トラブルシューティング」セクション
2. [ecs-deployment.md](./ecs-deployment.md) の「デプロイ確認」セクション
3. CloudWatch Logs でエラーログを確認

### コストを最適化する

1. [infrastructure.md](./infrastructure.md) の「コスト管理」セクション
2. [terraform/README.md](../terraform/README.md) の「コスト見積もり」セクション
3. AWS Cost Explorer で実際のコストを確認

## 💰 コスト早見表

| 環境 | vCPU/メモリ | 月額 | 用途 |
|-----|------------|------|------|
| dev | 0.25 vCPU / 512 MB | **$30** | 開発・検証 |
| prod | 0.5 vCPU / 1 GB | **$46** | 本番環境 |

*ALB、CloudWatch Logs、Secrets Manager含む*

## 🛠️ よく使うコマンド

```bash
# === ローカル開発 ===
pnpm dev                    # 開発サーバー起動
pnpm test                   # テスト実行
docker compose -f docker-compose.redis.yml up -d  # Redis起動

# === インフラデプロイ ===
./scripts/terraform-setup.sh   # 対話型セットアップ
cd terraform && terraform apply -var-file="dev.tfvars"  # 手動デプロイ

# === アプリデプロイ ===
./scripts/build-and-push.sh    # ECRにプッシュ
./scripts/deploy-ecs.sh         # ECSデプロイ

# === 運用 ===
aws logs tail /ecs/firepoker --follow  # ログ確認
terraform output alb_url               # URL確認
curl $(terraform output -raw alb_url)/api/health  # ヘルスチェック

# === クリーンアップ ===
./scripts/terraform-destroy.sh  # インフラ削除
```

## 🔗 関連リンク

- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Notion API Documentation](https://developers.notion.com/)

## 📞 サポート

問題が発生した場合：

1. [infrastructure.md トラブルシューティング](./infrastructure.md#トラブルシューティング)
2. [GitHub Issues](https://github.com/ifhito/firepoker-neo/issues)
3. CloudWatch Logs でエラー確認

---

**最終更新**: 2025-10-12  
**バージョン**: 1.0.0
