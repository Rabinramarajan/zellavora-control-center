# Zellavora Control Center - Deployment Runbook

**Version:** 1.0  
**Last Updated:** August 5, 2026  
**Maintained By:** DevOps Team  

---

## Table of Contents

1. [Overview](#overview)
2. [Pre-Deployment](#pre-deployment)
3. [Deployment Process](#deployment-process)
4. [Post-Deployment](#post-deployment)
5. [Monitoring](#monitoring)
6. [Rollback](#rollback)
7. [Troubleshooting](#troubleshooting)
8. [Disaster Recovery](#disaster-recovery)

---

## Overview

Zellavora Control Center is an enterprise-grade CMS and operations management platform built with:
- **Frontend:** Angular 22 with Signals, Tailwind CSS, Material Design
- **Backend:** Express.js with Node.js
- **Database:** PostgreSQL 16 with Prisma ORM
- **Cache:** Redis 7
- **Auth:** Supabase with JWT

### Deployment Options

| Option | Environment | Use Case |
|--------|-------------|----------|
| Docker Compose | Local/Staging | Development and testing |
| Docker Standalone | Staging/Production | Single server deployment |
| Kubernetes | Production | High-availability clusters |

---

## Pre-Deployment

### Prerequisites Checklist

Before deploying, ensure you have:

- [ ] Access to GitHub repository
- [ ] Docker installed (for Docker deployments)
- [ ] kubectl configured (for Kubernetes)
- [ ] Access to PostgreSQL instance
- [ ] Access to Supabase project
- [ ] SMTP credentials for email
- [ ] SSL/TLS certificates (production only)
- [ ] DNS records configured

### Step 1: Environment Configuration

1. **Copy environment template:**
   ```bash
   cp .env.example .env.staging
   cp .env.example .env.production
   ```

2. **Update staging environment:**
   ```bash
   # .env.staging
   NODE_ENV=staging
   API_URL=https://api-staging.zellavora.com
   FRONTEND_URL=https://staging.zellavora.com
   DATABASE_URL=postgresql://user:pass@db-staging:5432/zellavora
   JWT_SECRET=<generate-32-char-random-string>
   # ... other variables
   ```

3. **Update production environment:**
   ```bash
   # .env.production
   NODE_ENV=production
   API_URL=https://api.zellavora.com
   FRONTEND_URL=https://zellavora.com
   DATABASE_URL=postgresql://user:pass@db-prod:5432/zellavora
   JWT_SECRET=<generate-32-char-random-string>
   # ... other variables
   ```

### Step 2: Pre-Deployment Validation

Run the pre-deployment validation script:

```bash
./scripts/pre-deployment.sh staging
# or
./scripts/pre-deployment.sh production
```

This script validates:
- ✅ Environment variables set and formatted correctly
- ✅ Supabase credentials valid
- ✅ Database connection string valid
- ✅ Email configuration present
- ✅ SSL/TLS configured (production)
- ✅ DNS resolves correctly
- ✅ Docker/Kubernetes ready
- ✅ Build artifacts exist
- ✅ Database migrations prepared

**Expected Output:**
```
==================================================
Pre-Deployment Checklist Summary
==================================================
✅ Passed: 15
❌ Failed: 0

✅ All pre-deployment checks passed!
📄 Checklist saved to: deployment-checklist-staging.txt

Next step: ./scripts/deploy.sh staging
```

### Step 3: Backup Current State

Before deploying, backup current state:

```bash
# Backup database
pg_dump zellavora > backups/zellavora-$(date +%Y%m%d-%H%M%S).sql

# Backup Docker volumes (if using Docker)
docker run --rm -v zcc-postgres_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/postgres-$(date +%Y%m%d-%H%M%S).tar.gz -C / data

# Backup Redis data (if used)
docker run --rm -v zcc-redis_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/redis-$(date +%Y%m%d-%H%M%S).tar.gz -C / data
```

---

## Deployment Process

### Option 1: Docker Compose (Local/Staging)

**Best for:** Development, staging, or single-server deployments

```bash
# 1. Navigate to project root
cd zellavora-control-center

# 2. Run pre-deployment checks
./scripts/pre-deployment.sh staging

# 3. Start services
docker-compose up -d

# 4. Run database migrations
docker-compose exec backend npm run db:migrate

# 5. Seed initial data (optional)
docker-compose exec backend npm run db:seed

# 6. Verify deployment
./scripts/post-deployment.sh staging docker

# 7. Monitor services
./scripts/monitor.sh staging docker
```

**Services:** Frontend (4200), Backend (3000), Postgres (5432), Redis (6379), Nginx (8080)

### Option 2: Docker Standalone (Production)

**Best for:** Production single-server deployment with auto-restart

```bash
# 1. Pre-deployment checks
./scripts/pre-deployment.sh production

# 2. Build images
docker build -f Dockerfile.backend -t zellavora-backend:latest .
docker build -f Dockerfile.frontend -t zellavora-frontend:latest .

# 3. Push to registry (optional)
docker tag zellavora-backend:latest your-registry/zellavora-backend:latest
docker push your-registry/zellavora-backend:latest

# 4. Run backend
docker run -d \
  --name zellavora-backend \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env.production \
  zellavora-backend:latest

# 5. Run frontend
docker run -d \
  --name zellavora-frontend \
  --restart unless-stopped \
  -p 80:80 \
  -p 443:443 \
  -v /etc/letsencrypt:/etc/letsencrypt:ro \
  zellavora-frontend:latest

# 6. Run migrations
docker exec zellavora-backend npm run db:migrate

# 7. Verify deployment
./scripts/post-deployment.sh production docker
```

### Option 3: Kubernetes (Production HA)

**Best for:** Production high-availability deployment

```bash
# 1. Pre-deployment checks
./scripts/pre-deployment.sh production

# 2. Create namespace
kubectl create namespace zellavora

# 3. Create secrets
kubectl create secret generic zellavora-secrets \
  --from-env-file=.env.production \
  -n zellavora

# 4. Apply manifests
kubectl apply -f k8s/deployment.yaml

# 5. Wait for rollout
kubectl rollout status deployment/zellavora-backend -n zellavora
kubectl rollout status deployment/zellavora-frontend -n zellavora

# 6. Run database migrations (in pod)
kubectl exec -it deployment/zellavora-backend \
  -n zellavora -- npm run db:migrate

# 7. Verify deployment
./scripts/post-deployment.sh production kubernetes

# 8. Check status
kubectl get all -n zellavora
```

---

## Post-Deployment

### Step 1: Health Verification

```bash
# Run post-deployment health checks
./scripts/post-deployment.sh staging docker
# or
./scripts/post-deployment.sh production docker
```

Expected checks:
- ✅ Backend health endpoint responding
- ✅ Frontend accessible
- ✅ Database connected
- ✅ Migrations completed
- ✅ API authentication working
- ✅ WebSocket connections working

### Step 2: Smoke Testing

```bash
# Test critical user flows
1. User registration
2. User login
3. Project creation
4. Project publication
5. Team creation
6. Dashboard access
7. Real-time notifications
8. Permission checks
```

### Step 3: Performance Baseline

```bash
# Start monitoring
./scripts/monitor.sh staging docker 300

# Expected metrics:
# - Response time: < 200ms (p95)
# - Error rate: < 0.1%
# - CPU usage: < 70%
# - Memory usage: < 80%
```

### Step 4: Data Validation

```bash
# Verify data integrity
psql zellavora << 'EOF'
-- Check table counts
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Verify audit logs
SELECT COUNT(*) FROM audit_logs;

-- Check user count
SELECT COUNT(*) FROM users;

-- Verify organizations
SELECT COUNT(*) FROM organizations;
EOF
```

### Step 5: Endpoint Testing

Test all critical endpoints:

```bash
# Authentication endpoints
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Projects endpoints
curl http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer $TOKEN"

# Teams endpoints
curl http://localhost:3000/api/v1/teams \
  -H "Authorization: Bearer $TOKEN"

# Health check
curl http://localhost:3000/health
```

---

## Monitoring

### Real-Time Monitoring

```bash
# Start continuous monitoring
./scripts/monitor.sh staging docker

# For Kubernetes:
./scripts/monitor.sh production kubernetes
```

Monitors:
- Container/Pod status
- CPU and memory usage
- Response times
- Error rates
- Database connectivity
- Health endpoint status

### Log Aggregation

**Docker:**
```bash
# View backend logs
docker logs -f zcc-backend

# View frontend logs
docker logs -f zcc-frontend

# View with timestamps
docker logs -f --timestamps zcc-backend
```

**Kubernetes:**
```bash
# View backend logs
kubectl logs -f deployment/zellavora-backend -n zellavora

# View frontend logs
kubectl logs -f deployment/zellavora-frontend -n zellavora

# View events
kubectl get events -n zellavora --sort-by='.lastTimestamp'
```

### Key Metrics to Monitor

| Metric | Threshold | Action |
|--------|-----------|--------|
| Error Rate | > 1% | Page on-call engineer |
| Response Time (p95) | > 500ms | Investigate performance |
| CPU Usage | > 80% | Scale up or optimize |
| Memory Usage | > 85% | Scale up or investigate leak |
| Database Connections | > 80% of pool | Increase pool size |
| Disk Space | < 10% free | Archive logs, add storage |

### Alert Setup (Recommended)

Set up alerts for:

```yaml
# Prometheus alerts (example)
groups:
  - name: zellavora
    rules:
      - alert: HighErrorRate
        expr: rate(http_errors_total[5m]) > 0.01
        annotations:
          summary: "High error rate on {{ $labels.instance }}"

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_duration_seconds[5m])) > 0.5
        annotations:
          summary: "High p95 response time on {{ $labels.instance }}"

      - alert: PodCrashLooping
        expr: rate(kube_pod_container_status_restarts_total[30m]) > 0
        annotations:
          summary: "Pod {{ $labels.pod }} is crash looping"
```

---

## Rollback

### Docker Rollback

```bash
# Stop current version
docker stop zcc-backend zcc-frontend

# Remove containers
docker rm zcc-backend zcc-frontend

# Restore database from backup
pg_restore backups/zellavora-backup.sql

# Start previous image
docker run -d \
  --name zcc-backend \
  --env-file .env.staging \
  zellavora-backend:previous-tag

# Verify
docker ps
docker logs zcc-backend
```

### Kubernetes Rollback

```bash
# View rollout history
kubectl rollout history deployment/zellavora-backend -n zellavora

# Rollback to previous version
kubectl rollout undo deployment/zellavora-backend -n zellavora

# Rollback to specific revision
kubectl rollout undo deployment/zellavora-backend \
  --to-revision=2 -n zellavora

# Monitor rollback
kubectl rollout status deployment/zellavora-backend -n zellavora
```

### Database Rollback

```bash
# If migrations failed, rollback:
docker exec zellavora-backend \
  npx prisma migrate resolve --rolled-back <migration-name>

# Or manually restore from backup:
pg_restore -d zellavora backups/zellavora-backup.sql

# Verify schema
psql zellavora -c "\dt"
```

---

## Troubleshooting

### Backend Won't Start

**Symptom:** Backend container exits immediately

```bash
# Check logs
docker logs zcc-backend

# Common causes:
# 1. Database not running: docker start zcc-postgres
# 2. Invalid DATABASE_URL: check .env file
# 3. Migrations failed: docker exec zcc-backend npx prisma migrate status

# Solutions:
docker stop zcc-backend
docker rm zcc-backend
# Fix issue, then restart
docker run -d --name zcc-backend ... (see deployment steps)
```

### Database Connection Failures

**Symptom:** "Error: connect ECONNREFUSED 127.0.0.1:5432"

```bash
# Check database service
docker ps | grep postgres

# If not running, start it
docker start zcc-postgres

# Test connection
PGPASSWORD=postgres psql -h localhost -U postgres -d zellavora -c "SELECT 1"

# Check connection pool
psql zellavora -c "SELECT * FROM pg_stat_activity"

# If too many connections:
# - Increase DB_POOL_MAX in .env
# - Restart backend
```

### High Memory Usage

**Symptom:** Container/Pod using > 80% of allocated memory

```bash
# Check current usage
docker stats zcc-backend

# Kubernetes:
kubectl top pod -n zellavora

# Possible causes:
# 1. Memory leak in application
# 2. Large queries cached in memory
# 3. Too many open connections

# Solutions:
# 1. Restart service: docker restart zcc-backend
# 2. Increase memory limits
# 3. Implement caching strategy
# 4. Optimize database queries
```

### Slow API Responses

**Symptom:** API endpoints responding slowly (> 500ms)

```bash
# Check application logs
docker logs zcc-backend | grep -i slow

# Profile database queries
docker exec zcc-backend \
  psql zellavora -c "SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10"

# Solutions:
# 1. Add database indexes
# 2. Optimize N+1 queries
# 3. Implement caching
# 4. Increase backend resources
# 5. Scale horizontally
```

### WebSocket Connection Issues

**Symptom:** Real-time features not working

```bash
# Check WebSocket endpoint
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  http://localhost:3000/ws

# Check configuration
echo $VITE_WS_URL

# If using Kubernetes, check service
kubectl get svc -n zellavora

# Solutions:
# 1. Verify VITE_WS_URL in frontend .env
# 2. Check firewall allows WebSocket
# 3. Restart backend
# 4. Check Redis connection
```

### Certificate/SSL Issues

**Symptom:** HTTPS connection refused or invalid certificate

```bash
# Check certificate expiration
openssl s_client -connect api.zellavora.com:443

# For Kubernetes with cert-manager:
kubectl get certificate -n zellavora
kubectl describe certificate zellavora-tls -n zellavora

# Renew certificate:
kubectl delete certificate zellavora-tls -n zellavora
# Cert-manager will auto-recreate and renew

# For Docker, ensure ports mapped:
docker run -d \
  -p 80:80 \
  -p 443:443 \
  -v /etc/letsencrypt:/etc/letsencrypt:ro \
  zellavora-frontend:latest
```

---

## Disaster Recovery

### Complete Backup Strategy

```bash
# Daily backup script
#!/bin/bash
BACKUP_DIR="/backups/zellavora-$(date +%Y%m%d-%H%M%S)"
mkdir -p $BACKUP_DIR

# Database backup
pg_dump zellavora | gzip > $BACKUP_DIR/db.sql.gz

# Docker volumes backup (if using)
docker run --rm \
  -v zcc-postgres_data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/postgres-volume.tar.gz -C / data

# Redis backup (if used)
docker run --rm \
  -v zcc-redis_data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/redis-volume.tar.gz -C / data

# Configuration backup
cp .env.production $BACKUP_DIR/.env.backup

# Upload to remote storage
aws s3 sync $BACKUP_DIR s3://zellavora-backups/

echo "Backup complete: $BACKUP_DIR"
```

### Full Recovery from Disaster

```bash
# 1. Stop all services
docker-compose down
# or
kubectl delete namespace zellavora

# 2. Restore from backup
gunzip < backups/db.sql.gz | psql zellavora

# 3. Restore volumes
cd /
tar xzf $BACKUP_DIR/postgres-volume.tar.gz

# 4. Restore configuration
cp $BACKUP_DIR/.env.backup .env.production

# 5. Restart services
docker-compose up -d
# or
kubectl apply -f k8s/deployment.yaml

# 6. Verify recovery
./scripts/post-deployment.sh production
```

### Geo-Redundancy Setup

For multi-region deployment:

```bash
# Region 1 (Primary)
kubectl apply -f k8s/deployment.yaml -n primary

# Region 2 (Replica)
# - Use RDS read replica for database
# - Configure DNS failover
# - Set up cross-region replication for static assets

# Failover testing
# - Monthly: Test manual failover to secondary
# - Monitor replication lag
# - Document recovery time (RTO)
```

---

## Post-Deployment Checklist

After successful deployment, complete this checklist:

### Day 1

- [ ] All health checks passing
- [ ] No critical errors in logs
- [ ] Database migrations successful
- [ ] API endpoints responding correctly
- [ ] Frontend loads and functions
- [ ] User registration/login working
- [ ] Email notifications sending
- [ ] Real-time WebSocket connections active
- [ ] Monitoring and alerts configured
- [ ] Backup automation running

### Week 1

- [ ] No performance degradation observed
- [ ] Error rate stable and low
- [ ] Database query performance acceptable
- [ ] Disk space trending normally
- [ ] Memory leaks ruled out
- [ ] Failover testing completed successfully
- [ ] Documentation updated
- [ ] Team trained on runbook procedures

### Month 1

- [ ] All features thoroughly tested
- [ ] Load testing completed
- [ ] Security audit performed
- [ ] Disaster recovery plan validated
- [ ] Monitoring thresholds fine-tuned
- [ ] On-call rotation established
- [ ] Incident response plan documented

---

## Contacts & Escalation

| Role | Contact | On-Call |
|------|---------|---------|
| DevOps Lead | devops@zellavora.com | Slack: #zellavora-oncall |
| Database Admin | dba@zellavora.com | Slack: #database-oncall |
| Frontend Lead | frontend@zellavora.com | Slack: #frontend-oncall |
| Backend Lead | backend@zellavora.com | Slack: #backend-oncall |
| Security Team | security@zellavora.com | Slack: #security-oncall |

---

## Additional Resources

- [Deployment Scripts](./scripts/)
- [Docker Configuration](./docker-compose.yml)
- [Kubernetes Manifests](./k8s/)
- [Environment Template](./.env.example)
- [GitHub Actions CI/CD](./.github/workflows/)

---

**Document Version:** 1.0  
**Last Updated:** August 5, 2026  
**Next Review:** February 5, 2027
