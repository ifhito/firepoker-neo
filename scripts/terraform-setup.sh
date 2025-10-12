#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="${SCRIPT_DIR}/../terraform"

# Functions
print_info() {
    echo -e "${BLUE}ℹ ${1}${NC}"
}

print_success() {
    echo -e "${GREEN}✓ ${1}${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ ${1}${NC}"
}

print_error() {
    echo -e "${RED}✗ ${1}${NC}"
}

check_prerequisites() {
    print_info "前提条件のチェック中..."

    # Check Terraform
    if ! command -v terraform &> /dev/null; then
        print_error "Terraformがインストールされていません"
        print_info "インストール: https://www.terraform.io/downloads"
        exit 1
    fi
    print_success "Terraform $(terraform version -json | jq -r '.terraform_version') が見つかりました"

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLIがインストールされていません"
        print_info "インストール: https://aws.amazon.com/cli/"
        exit 1
    fi
    print_success "AWS CLI $(aws --version) が見つかりました"

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS認証情報が設定されていません"
        print_info "設定: aws configure"
        exit 1
    fi
    local account_id=$(aws sts get-caller-identity --query Account --output text)
    print_success "AWS認証成功 (Account: ${account_id})"
}

setup_terraform() {
    print_info "Terraformの初期化中..."

    cd "${TERRAFORM_DIR}"

    # Initialize Terraform
    terraform init

    print_success "Terraform初期化完了"
}

select_environment() {
    print_info "デプロイ環境を選択してください:"
    echo "  1) dev  - 開発環境 (0.5 vCPU / 1 GB, 1タスク)"
    echo "  2) prod - 本番環境 (1 vCPU / 2 GB, 2タスク)"
    echo ""
    read -p "選択 (1 or 2): " env_choice

    case $env_choice in
        1)
            ENVIRONMENT="dev"
            TFVARS_FILE="dev.tfvars"
            ;;
        2)
            ENVIRONMENT="prod"
            TFVARS_FILE="prod.tfvars"
            ;;
        *)
            print_error "無効な選択です"
            exit 1
            ;;
    esac

    print_success "環境: ${ENVIRONMENT}"
}

check_secrets() {
    print_info "Notion認証情報のチェック中..."

    if [[ -z "${TF_VAR_notion_token}" ]]; then
        print_warning "TF_VAR_notion_token が設定されていません"
        read -sp "Notion Token を入力してください: " notion_token
        echo ""
        export TF_VAR_notion_token="${notion_token}"
    else
        print_success "Notion Token が設定されています"
    fi

    if [[ -z "${TF_VAR_notion_pbi_db_id}" ]]; then
        print_warning "TF_VAR_notion_pbi_db_id が設定されていません"
        read -p "Notion PBI Database ID を入力してください: " pbi_db_id
        export TF_VAR_notion_pbi_db_id="${pbi_db_id}"
    else
        print_success "Notion PBI Database ID が設定されています"
    fi
}

plan_infrastructure() {
    print_info "インフラプランの作成中..."

    terraform plan -var-file="${TFVARS_FILE}" -out=tfplan

    print_success "プラン作成完了"
}

apply_infrastructure() {
    print_warning "以下のインフラをデプロイします:"
    echo "  - VPC, サブネット, NAT Gateway"
    echo "  - Application Load Balancer"
    echo "  - ECS Fargate クラスター"
    echo "  - ECR リポジトリ"
    echo "  - CloudWatch Logs"
    echo "  - Secrets Manager"
    echo ""
    
    # Cost estimation
    if [[ "${ENVIRONMENT}" == "dev" ]]; then
        print_info "推定コスト: 約 $136/月"
    else
        print_info "推定コスト: 約 $202/月"
    fi
    echo ""
    
    read -p "デプロイを実行しますか? (yes/no): " confirm

    if [[ "${confirm}" != "yes" ]]; then
        print_warning "デプロイをキャンセルしました"
        exit 0
    fi

    print_info "インフラのデプロイ中... (数分かかります)"

    terraform apply tfplan

    print_success "デプロイ完了!"
}

show_outputs() {
    print_info "デプロイ情報:"
    echo ""

    # Get outputs
    local alb_url=$(terraform output -raw alb_url 2>/dev/null || echo "N/A")
    local ecr_url=$(terraform output -raw ecr_repository_url 2>/dev/null || echo "N/A")
    local cluster_name=$(terraform output -raw ecs_cluster_name 2>/dev/null || echo "N/A")

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  アプリケーションURL: ${alb_url}"
    echo "  ECRリポジトリ: ${ecr_url}"
    echo "  ECSクラスター: ${cluster_name}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    print_info "次のステップ:"
    echo "  1. Dockerイメージをビルド: docker build -t firepoker ."
    echo "  2. ECRにプッシュ: ./scripts/build-and-push.sh"
    echo "  3. ECSにデプロイ: ./scripts/deploy-ecs.sh"
    echo ""
    print_info "ヘルスチェック:"
    echo "  curl ${alb_url}/api/health"
}

# Main execution
main() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  FirePoker Terraform セットアップ"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    check_prerequisites
    setup_terraform
    select_environment
    check_secrets
    plan_infrastructure
    apply_infrastructure
    show_outputs

    print_success "全ての処理が完了しました!"
}

# Run main function
main
