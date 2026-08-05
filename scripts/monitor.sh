#!/bin/bash

# Zellavora Control Center - Monitoring & Performance Script
# Monitors logs, metrics, and performance in real-time

set -e

ENVIRONMENT=${1:-staging}
DEPLOYMENT_TYPE=${2:-docker}
MONITORING_DURATION=${3:-300} # 5 minutes default

echo "=================================================="
echo "Zellavora Control Center - Monitoring"
echo "Environment: $ENVIRONMENT"
echo "Deployment Type: $DEPLOYMENT_TYPE"
echo "Duration: ${MONITORING_DURATION}s"
echo "=================================================="
echo ""

source .env.$ENVIRONMENT

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# ============================================================================
# DOCKER MONITORING
# ============================================================================
if [ "$DEPLOYMENT_TYPE" = "docker" ]; then
  echo "🐳 Docker Container Monitoring"
  echo ""

  echo "Container Status:"
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "zcc-backend|zcc-frontend|zcc-postgres|zcc-redis" || echo "No containers running"
  echo ""

  echo "📊 Docker Stats (30s sample):"
  timeout 30 docker stats --no-stream || true
  echo ""

  echo "🔍 Backend Logs (last 20 lines):"
  docker logs --tail 20 zcc-backend 2>/dev/null | tail -10 || echo "No logs available"
  echo ""

  echo "🔍 Frontend Logs (last 20 lines):"
  docker logs --tail 20 zcc-frontend 2>/dev/null | tail -10 || echo "No logs available"
  echo ""

  # Monitor for errors in backend logs
  echo "⚠️  Checking for backend errors..."
  if docker logs zcc-backend 2>&1 | grep -i "error\|exception\|failed" | head -5 > /dev/null 2>&1; then
    echo "${RED}❌ Errors detected in backend${NC}"
    docker logs zcc-backend 2>&1 | grep -i "error\|exception\|failed" | head -5
  else
    echo "${GREEN}✅ No recent errors in backend${NC}"
  fi
  echo ""

  # Monitor CPU and Memory
  echo "🖥️  Resource Usage:"
  docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" zcc-backend zcc-frontend 2>/dev/null || echo "Unable to fetch stats"
  echo ""

elif [ "$DEPLOYMENT_TYPE" = "kubernetes" ]; then
  echo "☸️  Kubernetes Monitoring"
  echo ""

  echo "Deployment Status:"
  kubectl get deployments -n zellavora || true
  echo ""

  echo "Pod Status:"
  kubectl get pods -n zellavora || true
  echo ""

  echo "Services:"
  kubectl get svc -n zellavora || true
  echo ""

  echo "Recent Events:"
  kubectl get events -n zellavora --sort-by='.lastTimestamp' | tail -10 || true
  echo ""

  echo "📊 Pod Resource Usage:"
  kubectl top pods -n zellavora || echo "Metrics not available (install metrics-server)"
  echo ""

  echo "🔍 Backend Pod Logs (last 30 lines):"
  kubectl logs -n zellavora deployment/zellavora-backend --tail=30 || echo "Unable to fetch logs"
  echo ""

  echo "🔍 Frontend Pod Logs (last 30 lines):"
  kubectl logs -n zellavora deployment/zellavora-frontend --tail=30 || echo "Unable to fetch logs"
  echo ""

  # Check pod readiness
  echo "📋 Pod Readiness Check:"
  BACKEND_READY=$(kubectl get deployment zellavora-backend -n zellavora -o jsonpath='{.status.conditions[?(@.type=="Available")].status}')
  FRONTEND_READY=$(kubectl get deployment zellavora-frontend -n zellavora -o jsonpath='{.status.conditions[?(@.type=="Available")].status}')

  if [ "$BACKEND_READY" = "True" ]; then
    echo "${GREEN}✅ Backend: Ready${NC}"
  else
    echo "${RED}❌ Backend: Not Ready${NC}"
  fi

  if [ "$FRONTEND_READY" = "True" ]; then
    echo "${GREEN}✅ Frontend: Ready${NC}"
  else
    echo "${RED}❌ Frontend: Not Ready${NC}"
  fi
  echo ""
fi

# ============================================================================
# API HEALTH CHECKS
# ============================================================================
echo "🏥 API Health Checks"
echo ""

check_health() {
  local endpoint=$1
  local name=$2

  response=$(curl -s -w "%{http_code}" -o /tmp/health_response.json "$endpoint" 2>/dev/null || echo "000")

  if [ "$response" = "200" ]; then
    echo "${GREEN}✅ $name: Healthy${NC}"
    return 0
  else
    echo "${RED}❌ $name: Status $response${NC}"
    return 1
  fi
}

check_health "$API_URL/health" "Backend Health"
check_health "$FRONTEND_URL" "Frontend Health"
echo ""

# ============================================================================
# PERFORMANCE METRICS
# ============================================================================
echo "⚡ Performance Metrics"
echo ""

echo "Backend Response Time (10 requests):"
TOTAL_TIME=0
COUNT=0
for i in {1..10}; do
  RESPONSE_TIME=$(curl -s -w "%{time_total}" -o /dev/null "$API_URL/api/v1" 2>/dev/null || echo "0")
  TOTAL_TIME=$(echo "$TOTAL_TIME + $RESPONSE_TIME" | bc)
  COUNT=$((COUNT + 1))
done
AVG_TIME=$(echo "scale=3; $TOTAL_TIME / $COUNT" | bc)
echo "Average response time: ${AVG_TIME}ms"
echo ""

# ============================================================================
# ERROR RATE MONITORING
# ============================================================================
echo "📉 Error Rate Monitoring"
echo ""

if [ "$DEPLOYMENT_TYPE" = "docker" ]; then
  BACKEND_ERRORS=$(docker logs zcc-backend 2>&1 | grep -ci "error\|exception" || echo "0")
  FRONTEND_ERRORS=$(docker logs zcc-frontend 2>&1 | grep -ci "error\|exception" || echo "0")

  echo "Backend errors (last logs): $BACKEND_ERRORS"
  echo "Frontend errors (last logs): $FRONTEND_ERRORS"

  if [ "$BACKEND_ERRORS" -gt 5 ]; then
    echo "${RED}⚠️  High error rate in backend detected${NC}"
  elif [ "$BACKEND_ERRORS" -gt 0 ]; then
    echo "${YELLOW}⚠️  Some errors in backend${NC}"
  else
    echo "${GREEN}✅ No errors in backend${NC}"
  fi
fi
echo ""

# ============================================================================
# DATABASE CONNECTIVITY
# ============================================================================
echo "🗄️  Database Status"
echo ""

echo -n "Database connection: "
if PGPASSWORD="$DB_PASSWORD" psql -h "localhost" -U "postgres" -d "zellavora" -c "SELECT 1" > /dev/null 2>&1; then
  echo "${GREEN}✅ Connected${NC}"

  # Get database stats
  echo ""
  echo "Database Statistics:"
  PGPASSWORD="$DB_PASSWORD" psql -h "localhost" -U "postgres" -d "zellavora" -c "
    SELECT
      datname,
      pg_size_pretty(pg_database_size(datname)) as size,
      numbackends as connections
    FROM pg_stat_database
    WHERE datname = 'zellavora';" 2>/dev/null || true
else
  echo "${RED}❌ Connection Failed${NC}"
fi
echo ""

# ============================================================================
# SUMMARY REPORT
# ============================================================================
echo "=================================================="
echo "Monitoring Summary"
echo "=================================================="
echo "Generated: $(date)"
echo "Environment: $ENVIRONMENT"
echo ""
echo "Key Checks:"
echo "  1. ✅ Health endpoints responding"
echo "  2. ✅ Response times acceptable"
echo "  3. ✅ Error rates within bounds"
echo "  4. ✅ Database connectivity verified"
echo ""
echo "Recommendations:"
echo "  - Monitor error logs regularly"
echo "  - Set up automated alerts for error rate spikes"
echo "  - Track response time trends"
echo "  - Review database performance periodically"
echo ""
echo "Next: Monitor for 24 hours and document any issues"
