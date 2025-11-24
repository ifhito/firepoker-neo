# FirePoker クイックスタートガイド

最速でFirePokerをAWSにデプロイするための簡易ガイドです。

## ⚡ 5分でデプロイ

### 前提条件

- AWS CLIがインストール・設定済み
- Dockerがインストール済み
- Notion Integrationトークンを取得済み

### 手順

#### 1. Notion認証情報を環境変数に設定

```bash
export TF_VAR_notion_token="secret_YOUR_NOTION_TOKEN"
export TF_VAR_notion_pbi_db_id="YOUR_DATABASE_ID"
```

#### 2. インフラをデプロイ

```bash
cd terraform
terraform init
terraform apply -var-file="dev.tfvars"  # "yes" を入力
```

#### 3. Dockerイメージをビルド＆デプロイ

```bash
cd ..
./scripts/build-and-push.sh
./scripts/deploy-ecs.sh
```

#### 4. アクセス

```bash
# URLを確認
cd terraform
terraform output alb_url

# ブラウザで開く
open $(terraform output -raw alb_url)
```

完了！ 🎉

---

## 📊 コスト

- **開発環境**: 約 $30/月
- **本番環境**: 約 $46/月

---

## 🗑️ クリーンアップ

```bash
./scripts/terraform-destroy.sh
```

---

詳細は [infrastructure.md](./infrastructure.md) を参照してください。
