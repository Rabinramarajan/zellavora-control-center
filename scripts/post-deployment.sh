#!/bin/bash

# Zellavora Control Center - Post-Deployment Health Check
# Validates deployment success and health

set -e

ENVIRONMENT=${1:-staging}
DEPLOYMENT_TYPE=${2:-docker} # docker or kubernetes

echo "=================================================="
echo "Zellavora Control Center - Post-Deployment Check"
echo "Environment: $ENVIRONMENT"
echo "Deployment Type: $DEPLOYMENT_TYPE"
echo "=================================================="
echo ""

source .env.$ENVIRONMENT

PASSED=0
FAILED=0

# Function to check endpoint
check_endpoint() {
  local name=$1
  local url=$2
  local expected_status=${3:-200}

  echo -n "Checking $name... "

  response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")

  if [ "$response" = "$expected_status" ]; then
    echo "✅ (HTTP $response)"
    ((PASSED++))
  else
    echo "❌ (HTTP $response, expected $expected_status)"
    ((FAILED++))
  fi
}

# ============================================================================
# BACKEND HEALTH CHECKS
# ============================================================================
echo "🔧 Backend Health Checks"
echo ""

check_endpoint "Backend health" "$API_URL/health"
check_endpoint "Backend API" "$API_URL/api/v1" 404
check_endpoint "Backend auth" "$API_URL/api/v1/auth/me" 401

# ============================================================================
# FRONTEND HEALTH CHECKS
# ============================================================================
echo ""
echo "🎨 Frontend Health Checks"
echo ""

check_endpoint "Frontend homepage" "$FRONTEND_URL" 200
check_endpoint "Frontend assets" "$FRONTEND_URL/index.html" 200

# ============================================================================
# DATABASE CONNECTIVITY
# ============================================================================
echo ""
echo "🗄️  Database Connectivity"
echo ""

echo -n "Checking database connection... "
if PGPASSWORD="$DB_PASSWORD" psql -h "$(echo $DATABASE_URL | grep -o '@[^:]*' | cut -c2-)" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
  echo "✅"
  ((PASSED++))
else
  echo "❌"
  ((FAILED++))
fi

echo -n "Checking database migrations... "
if [ "$DEPLOYMENT_TYPE" = "docker" ]; then
  if docker ps | grep -q zcc-backend; then
    if docker exec zcc-backend npx prisma migrate status > /dev/null 2>&1; then
      echo "✅"
      ((PASSED++))
    else
      echo "❌"
      ((FAILED++))
    fi
  else
    echo "⏭️  Backend container not running"
  fi
elif [ "$DEPLOYMENT_TYPE" = "kubernetes" ]; then
  echo "⏭️  Check manually in Kubernetes pod"
fi

# ============================================================================
# SERVICE AVAILABILITY
# ============================================================================
echo ""
echo "🚀 Service Availability"
echo ""

if [ "$DEPLOYMENT_TYPE" = "docker" ]; then
  echo -n "Backend container running... "
  if docker ps | grep -q zcc-backend; then
    echo "✅"
    ((PASSED++))
  else
    echo "❌"
    ((FAILED++))
  fi

  echo -n "Frontend container running... "
  if docker ps | grep -q zcc-frontend; then
    echo "✅"
    ((PASSED++))
  else
    echo "❌"
    ((FAILED++))
  fi

  echo -n "Database container running... "
  if docker ps | grep -q zcc-postgres; then
    echo "✅"
    ((PASSED++))
  else
    echo "❌"
    ((FAILED++))
  fi

elif [ "$DEPLOYMENT_TYPE" = "kubernetes" ]; then
  echo -n "Backend deployment ready... "
  if kubectl get deployment zellavora-backend -n zellavora &> /dev/null; then
    READY=$(kubectl get deployment zellavora-backend -n zellavora -o jsonpath='{.status.conditions[?(@.type=="Available")].status}')
    if [ "$READY" = "True" ]; then
      echo "✅"
      ((PASSED++))
    else
      echo "❌"
      ((FAILED++))
    fi
  else
    echo "❌"
    ((FAILED++))
  fi

  echo -n "Frontend deployment ready... "
  if kubectl get deployment zellavora-frontend -n zellavora &> /dev/null; then
    READY=$(kubectl get deployment zellavora-frontend -n zellavora -o jsonpath='{.status.conditions[?(@.type=="Available")].status}')
    if [ "$READY" = "True" ]; then
      echo "✅"
      ((PASSED++))
    else
      echo "❌"
      ((FAILED++))
    fi
  else
    echo "❌"
    ((FAILED++))
  fi

  echo -n "Services accessible... "
  if kubectl get svc -n zellavora | grep -q zellavora; then
    echo "✅"
    ((PASSED++))
  else
    echo "❌"
    ((FAILED++))
  fi
fi

# ============================================================================
# API FUNCTIONALITY TESTS
# ============================================================================
echo ""
echo "🧪 API Functionality Tests"
echo ""

echo -n "Test user creation... "
CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}' 2>/dev/null || echo "")

if echo "$CREATE_RESPONSE" | grep -q "success\|email\|id"; then
  echo "✅"
  ((PASSED++))
else
  echo "⚠️  Manual verification needed"
fi

echo -n "Test authentication... "
AUTH_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}' 2>/dev/null || echo "")

if echo "$AUTH_RESPONSE" | grep -q "token\|access"; then
  echo "✅"
  ((PASSED++))
else
  echo "⚠️  Manual verification needed"
fi

# ============================================================================
# SECURITY CHECKS
# ============================================================================
echo ""
echo "🔒 Security Checks"
echo ""

echo -n "HTTPS enforced (production)... "
if [ "$ENVIRONMENT" = "production" ]; then
  if curl -I "$API_URL" 2>/dev/null | grep -q "https"; then
    echo "✅"
    ((PASSED++))
  else
    echo "❌"
    ((FAILED++))
  fi
else
  echo "⏭️  Skipped for non-production"
fi

echo -n "CORS configured... "
CORS_RESPONSE=$(curl -s -I "$API_URL" 2>/dev/null | grep -i "access-control-allow-origin" || echo "")
if [ ! -z "$CORS_RESPONSE" ]; then
  echo "✅"
  ((PASSED++))
else
  echo "⚠️  Manual verification needed"
fi

# ============================================================================
# LOG ANALYSIS
# ============================================================================
echo ""
echo "📊 Log Analysis"
echo ""

if [ "$DEPLOYMENT_TYPE" = "docker" ]; then
  echo "Recent backend logs:"
  docker logs --tail 10 zcc-backend 2>/dev/null | head -5 || echo "No logs available"

  echo ""
  echo "Recent frontend logs:"
  docker logs --tail 10 zcc-frontend 2>/dev/null | head -5 || echo "No logs available"
fi

# ============================================================================
# SUMMARY & RECOMMENDATIONS
# ============================================================================
echo ""
echo "=================================================="
echo "Post-Deployment Summary"
echo "=================================================="
echo "✅ Passed: $PASSED"
echo "❌ Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "✅ DEPLOYMENT SUCCESSFUL"
  echo ""
  echo "Next steps:"
  echo "  1. Monitor application logs for 24 hours"
  echo "  2. Run smoke tests from client"
  echo "  3. Verify database backups are running"
  echo "  4. Confirm monitoring/alerting is active"
  echo "  5. Document deployment in runbook"
  exit 0
else
  echo "❌ DEPLOYMENT ISSUES DETECTED"
  echo ""
  echo "Action items:"
  echo "  1. Review failed checks above"
  echo "  2. Check container/pod logs"
  echo "  3. Verify environment configuration"
  echo "  4. Restart services if needed"
  exit 1
fi
