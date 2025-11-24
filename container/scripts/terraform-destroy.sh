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

select_environment() {
    print_info "削除する環境を選択してください:"
    echo "  1) dev  - 開発環境"
    echo "  2) prod - 本番環境"
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

confirm_destroy() {
    echo ""
    print_warning "警告: 以下のリソースが削除されます:"
    echo "  - VPC とネットワークリソース"
    echo "  - Application Load Balancer"
    echo "  - ECS Fargate クラスター"
    echo "  - ECR リポジトリ (イメージも削除)"
    echo "  - CloudWatch Logs"
    echo "  - Secrets Manager"
    echo ""
    
    print_error "この操作は取り消せません!"
    echo ""
    
    read -p "本当に削除しますか? 'yes' と入力してください: " confirm

    if [[ "${confirm}" != "yes" ]]; then
        print_warning "削除をキャンセルしました"
        exit 0
    fi

    # Double confirmation for production
    if [[ "${ENVIRONMENT}" == "prod" ]]; then
        print_warning "本番環境の削除には追加確認が必要です"
        read -p "本当に本番環境を削除しますか? 'DELETE_PROD' と入力してください: " prod_confirm
        
        if [[ "${prod_confirm}" != "DELETE_PROD" ]]; then
            print_warning "削除をキャンセルしました"
            exit 0
        fi
    fi
}

destroy_infrastructure() {
    cd "${TERRAFORM_DIR}"

    print_info "インフラの削除中... (数分かかります)"

    terraform destroy -var-file="${TFVARS_FILE}" -auto-approve

    print_success "削除完了!"
}

cleanup_state() {
    print_info "クリーンアップ中..."

    cd "${TERRAFORM_DIR}"

    # Remove plan files
    rm -f tfplan

    print_success "クリーンアップ完了"
}

# Main execution
main() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  FirePoker Terraform クリーンアップ"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    select_environment
    confirm_destroy
    destroy_infrastructure
    cleanup_state

    print_success "全ての処理が完了しました!"
}

# Run main function
main
