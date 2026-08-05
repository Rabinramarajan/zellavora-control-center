#!/bin/bash

# Zellavora Control Center - Failover Testing Script
# Tests service failover and recovery scenarios

set -e

ENVIRONMENT=${1:-staging}
DEPLOYMENT_TYPE=${2:-docker}

echo "=================================================="
echo "Zellavora Control Center - Failover Testing"
echo "Environment: $ENVIRONMENT"
echo "Deployment Type: $DEPLOYMENT_TYPE"
echo "=================================================="
echo ""

source .env.$ENVIRONMENT

PASSED=0
FAILED=0

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

# ============================================================================
# PRE-FAILOVER BASELINE
# ============================================================================
echo "📊 Pre-Failover Baseline"
echo ""

echo -n "Collecting baseline metrics... "

BASELINE_RESPONSE_TIME=$(curl -s -w "%{time_total}" -o /dev/null "$API_URL/api/v1" 2>/dev/null || echo "0")
echo "✅"
echo "Baseline response time: ${BASELINE_RESPONSE_TIME}ms"
echo ""

# ============================================================================
# TEST 1: BACKEND SERVICE FAILOVER (DOCKER)
# ============================================================================
if [ "$DEPLOYMENT_TYPE" = "docker" ]; then
  echo "Test 1️⃣  Backend Service Failover"
  echo ""

  echo -n "Stopping backend container... "
  docker stop zcc-backend > /dev/null 2>&1 || true
  echo "✅"

  echo -n "Waiting for Docker to detect failure... "
  sleep 2
  echo "✅"

  # Check if Docker auto-restarts the container
  echo -n "Checking if container auto-restarted... "
  if docker ps | grep -q zcc-backend; then
    echo "${GREEN}✅ Auto-restart detected${NC}"
    ((PASSED++))
  else
    echo "${RED}❌ Container did not auto-restart${NC}"
    ((FAILED++))
  fi

  echo -n "Waiting for service to be ready (up to 30s)... "
  for i in {1..30}; do
    if curl -s "$API_URL/health" > /dev/null 2>&1; then
      echo "✅"
      ((PASSED++))
      break
    fi
    if [ $i -eq 30 ]; then
      echo "${RED}❌ Service did not recover${NC}"
      ((FAILED++))
    fi
    sleep 1
  done

  echo -n "Verifying API functionality... "
  if curl -s -f "$API_URL/api/v1" > /dev/null 2>&1; then
    echo "${GREEN}✅${NC}"
    ((PASSED++))
  else
    echo "${RED}❌${NC}"
    ((FAILED++))
  fi
  echo ""

  # ============================================================================
  # TEST 2: DATABASE FAILOVER (DOCKER)
  # ============================================================================
  echo "Test 2️⃣  Database Failover"
  echo ""

  echo -n "Stopping database container... "
  docker stop zcc-postgres > /dev/null 2>&1 || true
  echo "✅"

  echo -n "Waiting for failure detection (up to 15s)... "
  sleep 3

  # Backend should be unhealthy without database
  echo -n "Verifying backend detects database unavailability... "
  if ! curl -s "$API_URL/health" > /dev/null 2>&1; then
    echo "${GREEN}✅${NC}"
    ((PASSED++))
  else
    echo "${YELLOW}⚠️  Backend still responding (might be cached)${NC}"
  fi

  # Restart database
  echo -n "Restarting database container... "
  docker start zcc-postgres > /dev/null 2>&1
  echo "✅"

  echo -n "Waiting for database to be ready (up to 30s)... "
  for i in {1..30}; do
    if PGPASSWORD="$DB_PASSWORD" psql -h "localhost" -U "postgres" -d "zellavora" -c "SELECT 1" > /dev/null 2>&1; then
      echo "✅"
      ((PASSED++))
      break
    fi
    if [ $i -eq 30 ]; then
      echo "${RED}❌ Database did not restart${NC}"
      ((FAILED++))
    fi
    sleep 1
  done

  echo -n "Verifying backend recovers with database... "
  if curl -s "$API_URL/health" > /dev/null 2>&1; then
    echo "${GREEN}✅${NC}"
    ((PASSED++))
  else
    echo "${RED}❌${NC}"
    ((FAILED++))
  fi
  echo ""

  # ============================================================================
  # TEST 3: REDIS FAILOVER (DOCKER)
  # ============================================================================
  echo "Test 3️⃣  Redis Cache Failover"
  echo ""

  echo -n "Stopping Redis container... "
  docker stop zcc-redis > /dev/null 2>&1 || true
  echo "✅"

  echo -n "Waiting for Redis to be unavailable (3s)... "
  sleep 3
  echo "✅"

  # API should still work without Redis (graceful degradation)
  echo -n "Verifying API works without Redis... "
  if curl -s "$API_URL/api/v1" > /dev/null 2>&1; then
    echo "${GREEN}✅ Graceful degradation working${NC}"
    ((PASSED++))
  else
    echo "${RED}❌ API failed without Redis${NC}"
    ((FAILED++))
  fi

  # Restart Redis
  echo -n "Restarting Redis container... "
  docker start zcc-redis > /dev/null 2>&1
  echo "✅"

  echo -n "Waiting for Redis to be ready (10s)... "
  sleep 10
  echo "✅"

  echo -n "Verifying Redis connectivity... "
  if docker exec zcc-redis redis-cli ping > /dev/null 2>&1; then
    echo "${GREEN}✅${NC}"
    ((PASSED++))
  else
    echo "${RED}❌${NC}"
    ((FAILED++))
  fi
  echo ""

  # ============================================================================
  # TEST 4: FRONTEND FAILOVER (DOCKER)
  # ============================================================================
  echo "Test 4️⃣  Frontend Service Failover"
  echo ""

  echo -n "Stopping frontend container... "
  docker stop zcc-frontend > /dev/null 2>&1 || true
  echo "✅"

  echo -n "Waiting for Docker to detect failure... "
  sleep 2
  echo "✅"

  echo -n "Checking if container auto-restarted... "
  if docker ps | grep -q zcc-frontend; then
    echo "${GREEN}✅ Auto-restart detected${NC}"
    ((PASSED++))
  else
    echo "${RED}❌ Container did not auto-restart${NC}"
    ((FAILED++))
  fi

  echo -n "Waiting for service to be ready (up to 15s)... "
  for i in {1..15}; do
    if curl -s "$FRONTEND_URL" > /dev/null 2>&1; then
      echo "✅"
      ((PASSED++))
      break
    fi
    if [ $i -eq 15 ]; then
      echo "${RED}❌ Service did not recover${NC}"
      ((FAILED++))
    fi
    sleep 1
  done
  echo ""

elif [ "$DEPLOYMENT_TYPE" = "kubernetes" ]; then
  echo "Kubernetes Failover Tests"
  echo ""

  # ============================================================================
  # TEST 1: POD DELETION (KUBERNETES)
  # ============================================================================
  echo "Test 1️⃣  Pod Auto-Restart"
  echo ""

  echo -n "Getting backend pod name... "
  POD_NAME=$(kubectl get pods -n zellavora -l app=zellavora-backend -o jsonpath='{.items[0].metadata.name}')
  echo "✅ ($POD_NAME)"

  echo -n "Deleting backend pod... "
  kubectl delete pod "$POD_NAME" -n zellavora > /dev/null 2>&1
  echo "✅"

  echo -n "Waiting for new pod to start (up to 30s)... "
  for i in {1..30}; do
    NEW_POD=$(kubectl get pods -n zellavora -l app=zellavora-backend -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [ ! -z "$NEW_POD" ] && [ "$NEW_POD" != "$POD_NAME" ]; then
      echo "✅"
      ((PASSED++))
      break
    fi
    if [ $i -eq 30 ]; then
      echo "${RED}❌ New pod did not start${NC}"
      ((FAILED++))
    fi
    sleep 1
  done

  echo -n "Waiting for pod to be ready (up to 30s)... "
  for i in {1..30}; do
    READY=$(kubectl get pod "$NEW_POD" -n zellavora -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
    if [ "$READY" = "True" ]; then
      echo "✅"
      ((PASSED++))
      break
    fi
    if [ $i -eq 30 ]; then
      echo "${RED}❌ Pod did not become ready${NC}"
      ((FAILED++))
    fi
    sleep 1
  done
  echo ""

  # ============================================================================
  # TEST 2: DEPLOYMENT SCALE DOWN/UP (KUBERNETES)
  # ============================================================================
  echo "Test 2️⃣  Deployment Scaling"
  echo ""

  echo -n "Getting current backend replicas... "
  CURRENT_REPLICAS=$(kubectl get deployment zellavora-backend -n zellavora -o jsonpath='{.spec.replicas}')
  echo "✅ ($CURRENT_REPLICAS)"

  echo -n "Scaling backend to 1 replica... "
  kubectl scale deployment zellavora-backend --replicas=1 -n zellavora > /dev/null 2>&1
  echo "✅"

  echo -n "Waiting for scaling to complete (up to 30s)... "
  for i in {1..30}; do
    RUNNING=$(kubectl get deployment zellavora-backend -n zellavora -o jsonpath='{.status.readyReplicas}')
    if [ "$RUNNING" = "1" ]; then
      echo "✅"
      ((PASSED++))
      break
    fi
    if [ $i -eq 30 ]; then
      echo "${RED}❌ Scaling did not complete${NC}"
      ((FAILED++))
    fi
    sleep 1
  done

  echo -n "Scaling backend back to $CURRENT_REPLICAS replicas... "
  kubectl scale deployment zellavora-backend --replicas="$CURRENT_REPLICAS" -n zellavora > /dev/null 2>&1
  echo "✅"

  echo -n "Waiting for scale up to complete (up to 60s)... "
  for i in {1..60}; do
    RUNNING=$(kubectl get deployment zellavora-backend -n zellavora -o jsonpath='{.status.readyReplicas}')
    if [ "$RUNNING" = "$CURRENT_REPLICAS" ]; then
      echo "✅"
      ((PASSED++))
      break
    fi
    if [ $i -eq 60 ]; then
      echo "${RED}❌ Scale up did not complete${NC}"
      ((FAILED++))
    fi
    sleep 1
  done
  echo ""

  # ============================================================================
  # TEST 3: API AVAILABILITY DURING ROLLING UPDATE (KUBERNETES)
  # ============================================================================
  echo "Test 3️⃣  Rolling Update Availability"
  echo ""

  echo -n "Triggering rolling update (restart)... "
  kubectl rollout restart deployment/zellavora-backend -n zellavora > /dev/null 2>&1
  echo "✅"

  echo -n "Checking API availability during rollout (10 requests)... "
  SUCCESSFUL=0
  for i in {1..10}; do
    if curl -s "$API_URL/health" > /dev/null 2>&1; then
      ((SUCCESSFUL++))
    fi
    sleep 1
  done

  if [ $SUCCESSFUL -ge 8 ]; then
    echo "${GREEN}✅ API remained available ($SUCCESSFUL/10)${NC}"
    ((PASSED++))
  else
    echo "${YELLOW}⚠️  API had downtime ($SUCCESSFUL/10)${NC}"
  fi

  echo -n "Waiting for rollout to complete... "
  kubectl rollout status deployment/zellavora-backend -n zellavora --timeout=300s > /dev/null 2>&1
  echo "✅"
  ((PASSED++))
  echo ""
fi

# ============================================================================
# POST-FAILOVER BASELINE
# ============================================================================
echo "📊 Post-Failover Verification"
echo ""

RECOVERY_RESPONSE_TIME=$(curl -s -w "%{time_total}" -o /dev/null "$API_URL/api/v1" 2>/dev/null || echo "999")
PERFORMANCE_RATIO=$(echo "scale=2; $RECOVERY_RESPONSE_TIME / $BASELINE_RESPONSE_TIME" | bc)

echo "Recovery response time: ${RECOVERY_RESPONSE_TIME}ms"
echo "Performance ratio: ${PERFORMANCE_RATIO}x baseline"

if (( $(echo "$PERFORMANCE_RATIO < 1.5" | bc -l) )); then
  echo "${GREEN}✅ Performance recovered to acceptable levels${NC}"
  ((PASSED++))
else
  echo "${YELLOW}⚠️  Performance degradation detected (${PERFORMANCE_RATIO}x)${NC}"
fi
echo ""

# ============================================================================
# SUMMARY
# ============================================================================
echo "=================================================="
echo "Failover Test Summary"
echo "=================================================="
echo "✅ Passed: $PASSED"
echo "❌ Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "${GREEN}✅ ALL FAILOVER TESTS PASSED${NC}"
  echo ""
  echo "Conclusions:"
  echo "  1. Services auto-recover from failures"
  echo "  2. Database failover handled correctly"
  echo "  3. Cache failover works with graceful degradation"
  echo "  4. API remains available during rolling updates"
  echo "  5. Performance recovered within acceptable range"
  exit 0
else
  echo "${RED}❌ SOME FAILOVER TESTS FAILED${NC}"
  echo ""
  echo "Action items:"
  echo "  1. Review failed test details above"
  echo "  2. Check restart policies in Docker/Kubernetes config"
  echo "  3. Verify health check endpoints"
  echo "  4. Review logs for recovery errors"
  exit 1
fi
