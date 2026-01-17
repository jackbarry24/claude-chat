#!/usr/bin/env bash
#
# Deployment script for Claude Chat
#
# Usage:
#   ./scripts/deploy.sh staging    # Deploy to staging and run tests
#   ./scripts/deploy.sh production # Deploy to production (requires staging first)
#   ./scripts/deploy.sh promote    # Run full staging -> production workflow
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Check wrangler is authenticated
check_auth() {
    if ! wrangler whoami &>/dev/null; then
        error "Not authenticated with Cloudflare. Run: wrangler login"
    fi
    info "Authenticated with Cloudflare"
}

# Run unit tests
run_unit_tests() {
    info "Running unit tests..."
    pnpm test || error "Unit tests failed"
    info "Unit tests passed"
}

# Deploy to staging
deploy_staging() {
    info "Deploying to staging..."
    pnpm deploy:staging || error "Staging deployment failed"
    info "Deployed to staging"
}

# Test staging
test_staging() {
    info "Running integration tests against staging..."
    sleep 2  # Brief pause for deployment to propagate
    pnpm test:integration:staging || error "Staging integration tests failed"
    info "Staging integration tests passed"
}

# Deploy to production
deploy_production() {
    info "Deploying to production..."
    pnpm deploy:production || error "Production deployment failed"
    info "Deployed to production"
}

# Test production
test_production() {
    info "Running integration tests against production..."
    sleep 2
    pnpm test:integration:production || error "Production integration tests failed"
    info "Production integration tests passed"
}

case "${1:-}" in
    staging)
        check_auth
        run_unit_tests
        deploy_staging
        test_staging
        info "Staging deployment complete!"
        ;;
    production)
        check_auth
        run_unit_tests
        deploy_production
        info "Production deployment complete!"
        echo ""
        warn "Run 'pnpm test:integration:production' to verify (creates test data)"
        ;;
    promote)
        check_auth
        run_unit_tests
        info "=== Deploying to Staging ==="
        deploy_staging
        test_staging
        echo ""
        info "=== Promoting to Production ==="
        deploy_production
        info "Full deployment complete! Staging and Production updated."
        ;;
    *)
        echo "Claude Chat Deployment Script"
        echo ""
        echo "Usage:"
        echo "  $0 staging     Deploy to staging and run integration tests"
        echo "  $0 production  Deploy to production (unit tests only)"
        echo "  $0 promote     Full workflow: staging -> test -> production"
        echo ""
        echo "Prerequisites:"
        echo "  - wrangler login (authenticate with Cloudflare)"
        echo "  - Workers Paid plan enabled"
        exit 1
        ;;
esac
