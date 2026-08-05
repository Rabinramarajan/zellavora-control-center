#!/bin/bash

# Zellavora Control Center - Pre-Deployment Checklist
# This script validates all pre-deployment requirements

set -e

ENVIRONMENT=${1:-staging}
PROJECT_ROOT="$(dirname "$(dirname "${BASH_SOURCE[0]}")")"
CHECKLIST_FILE="deployment-checklist-$ENVIRONMENT.txt"

echo "=================================================="
echo "Zellavora Control Center - Pre-Deployment Check"
echo "Environment: $ENVIRONMENT"
echo "=================================================="
echo ""

PASSED=0
FAILED=0

# Function to check requirement
check_requirement() {
  local name=$1
  local command=$2
  local error_msg=$3

  if eval "$command" > /dev/null 2>&1; then
    echo "✅ $name"
    ((PASSED++))
  else
    echo "❌ $name"
    echo "   Error: $error_msg"
    ((FAILED++))
  fi
}

# ============================================================================
# 1. ENVIRONMENT VARIABLES
# ============================================================================
echo "🔐 Checking Environment Variables..."
echo ""

if [ ! -f "$PROJECT_ROOT/.env.$ENVIRONMENT" ]; then
  echo "❌ Missing .env.$ENVIRONMENT file"
  echo "   Create .env.$ENVIRONMENT from .env.example"
  exit 1
fi

check_requirement "Environment file exists" \
  "test -f $PROJECT_ROOT/.env.$ENVIRONMENT" \
  "Environment file not found"

source "$PROJECT_ROOT/.env.$ENVIRONMENT"

check_requirement "DATABASE_URL set" \
  "test ! -z \$DATABASE_URL" \
  "DATABASE_URL environment variable not set"

check_requirement "JWT_SECRET set" \
  "test ! -z \$JWT_SECRET && test \${#JWT_SECRET} -gt 32" \
  "JWT_SECRET not set or too short (min 32 chars)"

check_requirement "API_URL set" \
  "test ! -z \$API_URL" \
  "API_URL environment variable not set"

check_requirement "FRONTEND_URL set" \
  "test ! -z \$FRONTEND_URL" \
  "FRONTEND_URL environment variable not set"

check_requirement "CORS_ORIGIN set" \
  "test ! -z \$CORS_ORIGIN" \
  "CORS_ORIGIN environment variable not set"

# ============================================================================
# 2. SUPABASE CREDENTIALS
# ============================================================================
echo ""
echo "🔑 Checking Supabase Credentials..."
echo ""

check_requirement "SUPABASE_URL configured" \
  "test ! -z \$SUPABASE_URL && [[ \$SUPABASE_URL == https* ]]" \
  "SUPABASE_URL not set or invalid"

check_requirement "SUPABASE_ANON_KEY set" \
  "test ! -z \$SUPABASE_ANON_KEY" \
  "SUPABASE_ANON_KEY not set"

check_requirement "SUPABASE_SERVICE_ROLE_KEY set" \
  "test ! -z \$SUPABASE_SERVICE_ROLE_KEY" \
  "SUPABASE_SERVICE_ROLE_KEY not set"

# ============================================================================
# 3. DATABASE CREDENTIALS
# ============================================================================
echo ""
echo "🗄️  Checking Database Credentials..."
echo ""

check_requirement "Database connection string valid" \
  "[[ \$DATABASE_URL == postgresql* ]]" \
  "DATABASE_URL not in valid PostgreSQL format"

# ============================================================================
# 4. EMAIL CONFIGURATION
# ============================================================================
echo ""
echo "📧 Checking Email Configuration..."
echo ""

check_requirement "Email sender configured" \
  "test ! -z \$SMTP_FROM" \
  "SMTP_FROM not set"

check_requirement "SMTP host configured" \
  "test ! -z \$SMTP_HOST" \
  "SMTP_HOST not set"

check_requirement "SMTP credentials set" \
  "test ! -z \$SMTP_USER && test ! -z \$SMTP_PASSWORD" \
  "SMTP_USER or SMTP_PASSWORD not set"

# ============================================================================
# 5. SSL/TLS CONFIGURATION
# ============================================================================
echo ""
echo "🔒 Checking SSL/TLS Configuration..."
echo ""

if [ "$ENVIRONMENT" = "production" ]; then
  check_requirement "API URL uses HTTPS" \
    "[[ \$API_URL == https* ]]" \
    "Production API_URL must use HTTPS"

  check_requirement "Frontend URL uses HTTPS" \
    "[[ \$FRONTEND_URL == https* ]]" \
    "Production FRONTEND_URL must use HTTPS"
else
  echo "⏭️  Skipping SSL checks for non-production environment"
fi

# ============================================================================
# 6. DNS CONFIGURATION
# ============================================================================
echo ""
echo "🌐 Checking DNS Configuration..."
echo ""

if command -v dig &> /dev/null; then
  API_HOST=$(echo $API_URL | sed 's|https://||;s|http://||;s|/.*||')
  check_requirement "API DNS resolves" \
    "dig +short $API_HOST | grep -q ." \
    "API host DNS does not resolve"

  FRONTEND_HOST=$(echo $FRONTEND_URL | sed 's|https://||;s|http://||;s|/.*||')
  check_requirement "Frontend DNS resolves" \
    "dig +short $FRONTEND_HOST | grep -q ." \
    "Frontend host DNS does not resolve"
else
  echo "⏭️  dig not available, skipping DNS checks"
fi

# ============================================================================
# 7. DOCKER SETUP
# ============================================================================
echo ""
echo "🐳 Checking Docker Setup..."
echo ""

check_requirement "Docker installed" \
  "command -v docker" \
  "Docker not installed"

check_requirement "Docker daemon running" \
  "docker ps > /dev/null 2>&1" \
  "Docker daemon not running"

check_requirement "Docker Compose installed" \
  "command -v docker-compose" \
  "Docker Compose not installed"

# ============================================================================
# 8. BUILD ARTIFACTS
# ============================================================================
echo ""
echo "📦 Checking Build Artifacts..."
echo ""

check_requirement "Frontend build output exists" \
  "test -d $PROJECT_ROOT/dist/apps/admin" \
  "Frontend not built - run: npm run build:admin"

check_requirement "Backend compiled" \
  "test -d $PROJECT_ROOT/apps/backend/dist" \
  "Backend not compiled - run: npm run build:backend"

# ============================================================================
# 9. DATABASE MIGRATIONS
# ============================================================================
echo ""
echo "📋 Checking Database Migrations..."
echo ""

check_requirement "Prisma migrations exist" \
  "test -d $PROJECT_ROOT/apps/backend/prisma/migrations" \
  "No Prisma migrations found"

check_requirement "Schema.prisma configured" \
  "test -f $PROJECT_ROOT/apps/backend/prisma/schema.prisma" \
  "Prisma schema not found"

# ============================================================================
# SUMMARY
# ============================================================================
echo ""
echo "=================================================="
echo "Pre-Deployment Checklist Summary"
echo "=================================================="
echo "✅ Passed: $PASSED"
echo "❌ Failed: $FAILED"
echo ""

# Save checklist
{
  echo "Pre-Deployment Checklist - $ENVIRONMENT"
  echo "Generated: $(date)"
  echo ""
  echo "Environment: $ENVIRONMENT"
  echo "Passed: $PASSED"
  echo "Failed: $FAILED"
  echo ""
  if [ $FAILED -eq 0 ]; then
    echo "Status: ✅ READY TO DEPLOY"
  else
    echo "Status: ❌ FIX ISSUES BEFORE DEPLOYMENT"
  fi
} > "$CHECKLIST_FILE"

if [ $FAILED -eq 0 ]; then
  echo "✅ All pre-deployment checks passed!"
  echo "📄 Checklist saved to: $CHECKLIST_FILE"
  echo ""
  echo "Next step: ./scripts/deploy.sh $ENVIRONMENT"
  exit 0
else
  echo "❌ Pre-deployment checks failed!"
  echo "📄 Checklist saved to: $CHECKLIST_FILE"
  echo ""
  echo "Fix the above issues and try again."
  exit 1
fi
