# Zellavora Control Center - Deployment Guide

## Overview

This guide covers deploying the Zellavora Control Center to production using Docker, Kubernetes, or traditional server deployment.

## Prerequisites

- Docker & Docker Compose (v3.8+)
- Node.js 18+
- npm/yarn package manager
- SSL certificates (Let's Encrypt recommended)
- Backend API running (see backend documentation)

## Local Development

### Quick Start with Docker Compose

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f frontend

# Stop services
docker-compose down
```

**Access Points:**
- Frontend: `http://localhost:4200`
- Backend API: `http://localhost:3000`
- Database: `localhost:5432`
- Redis: `localhost:6379`
- MinIO Console: `http://localhost:9001`

## Production Deployment

### Option 1: Docker (Recommended)

#### 1. Build Docker Image

```bash
# Build the image
docker build -t zellavora-admin:latest .

# Tag for registry
docker tag zellavora-admin:latest registry.example.com/zellavora-admin:latest

# Push to registry
docker push registry.example.com/zellavora-admin:latest
```

#### 2. Deploy with Docker Compose

```bash
# Create production compose file
cp docker-compose.yml docker-compose.prod.yml

# Edit with production settings
nano docker-compose.prod.yml

# Deploy
docker-compose -f docker-compose.prod.yml up -d

# Check health
docker-compose -f docker-compose.prod.yml ps
```

#### 3. Configure Environment Variables

Create `.env.production`:

```env
# Application
NODE_ENV=production
APP_URL=https://zellavora.com
API_URL=https://api.zellavora.com/api/v1

# Authentication
AUTH_ENABLED=true
JWT_SECRET=your-production-secret-key
REFRESH_TOKEN_SECRET=your-refresh-secret-key

# File Upload
MAX_FILE_SIZE=52428800
UPLOAD_ENDPOINT=/api/v1/media/upload
STORAGE_TYPE=s3

# AWS S3
S3_BUCKET=zellavora-media-prod
S3_REGION=us-east-1
S3_ACCESS_KEY=${S3_ACCESS_KEY}
S3_SECRET_KEY=${S3_SECRET_KEY}

# Logging
LOG_LEVEL=info
SENTRY_DSN=${SENTRY_DSN}

# Security
ENABLE_HTTPS=true
CORS_ORIGINS=https://zellavora.com,https://app.zellavora.com
```

### Option 2: Kubernetes

#### 1. Install Prerequisites

```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

#### 2. Create Kubernetes Manifests

Create `k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: zellavora-admin
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: zellavora-admin
  template:
    metadata:
      labels:
        app: zellavora-admin
    spec:
      containers:
      - name: admin
        image: registry.example.com/zellavora-admin:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: API_URL
          value: "https://api.zellavora.com/api/v1"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: zellavora-admin-service
  namespace: production
spec:
  selector:
    app: zellavora-admin
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

#### 3. Deploy to Kubernetes

```bash
# Create namespace
kubectl create namespace production

# Apply manifests
kubectl apply -f k8s/deployment.yaml

# Check deployment
kubectl get deployments -n production
kubectl get pods -n production

# View logs
kubectl logs -f deployment/zellavora-admin -n production
```

### Option 3: Traditional Server (Ubuntu/Debian)

#### 1. Setup Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Nginx
sudo apt install -y nginx

# Install SSL certificates
sudo apt install -y certbot python3-certbot-nginx
sudo certbot certonly --nginx -d zellavora.com -d www.zellavora.com
```

#### 2. Setup Application

```bash
# Clone repository
cd /var/www
git clone https://github.com/zellavora/control-center.git
cd control-center

# Install dependencies
npm ci

# Build application
npm run build

# Create service user
sudo useradd -m zellavora

# Change ownership
sudo chown -R zellavora:zellavora /var/www/control-center
```

#### 3. Configure Systemd Service

Create `/etc/systemd/system/zellavora-admin.service`:

```ini
[Unit]
Description=Zellavora Admin Frontend
After=network.target

[Service]
Type=simple
User=zellavora
WorkingDirectory=/var/www/control-center
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### 4. Enable and Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable zellavora-admin
sudo systemctl start zellavora-admin
sudo systemctl status zellavora-admin
```

#### 5. Configure Nginx

```bash
# Copy nginx config
sudo cp nginx.conf /etc/nginx/sites-available/zellavora

# Enable site
sudo ln -s /etc/nginx/sites-available/zellavora /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

## Environment Variables

Create `.env` file with the following variables:

```env
# Application
NODE_ENV=production
APP_NAME=Zellavora Control Center
APP_VERSION=2.0.0

# API Configuration
API_URL=https://api.zellavora.com/api/v1
API_TIMEOUT=30000

# Authentication
AUTH_ENABLED=true
JWT_SECRET=${RANDOM_SECRET_KEY}
REFRESH_TOKEN_SECRET=${RANDOM_REFRESH_KEY}

# File Upload
MAX_FILE_SIZE=52428800
ALLOWED_TYPES=image/jpeg,image/png,image/gif,video/mp4,application/pdf
STORAGE_TYPE=s3

# AWS S3
S3_BUCKET=zellavora-media
S3_REGION=us-east-1
S3_ACCESS_KEY=${SECRET}
S3_SECRET_KEY=${SECRET}

# Security
ENABLE_HTTPS=true
CORS_ORIGINS=https://zellavora.com

# Monitoring
SENTRY_DSN=${SENTRY_DSN}
LOG_LEVEL=info
```

## Health Checks

### Endpoint Monitoring

```bash
# Frontend health
curl https://zellavora.com/health

# API health
curl https://api.zellavora.com/health

# Database connection
curl -X POST https://api.zellavora.com/api/v1/health/db
```

### Automated Monitoring

Configure monitoring with Prometheus/Grafana:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'zellavora-admin'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

## SSL/TLS Configuration

### Auto-renew SSL Certificates

```bash
# Setup certbot auto-renewal
sudo certbot renew --dry-run

# Create renewal hook
sudo nano /etc/letsencrypt/renewal-hooks/post/nginx.sh
#!/bin/bash
systemctl reload nginx

chmod +x /etc/letsencrypt/renewal-hooks/post/nginx.sh
```

## CI/CD Pipeline

### GitHub Actions

The workflow in `.github/workflows/deploy.yml` automatically:

1. **Tests** the code
2. **Builds** Docker image
3. **Pushes** to registry
4. **Deploys** to production
5. **Runs** smoke tests

Configure secrets in GitHub:
- `DEPLOY_KEY`: SSH private key
- `DEPLOY_HOST`: Deployment server
- `DEPLOY_USER`: Deployment user
- `SLACK_WEBHOOK`: Notification webhook

## Monitoring & Logging

### Logs

```bash
# Docker logs
docker logs zellavora-admin-frontend

# Docker Compose logs
docker-compose logs -f frontend

# Kubernetes logs
kubectl logs -f deployment/zellavora-admin -n production

# System logs
sudo journalctl -u zellavora-admin -f
```

### Performance Monitoring

```bash
# CPU and Memory usage
docker stats zellavora-admin-frontend

# Resource limits
docker inspect zellavora-admin-frontend | grep -A 5 MemoryLimit
```

## Backup & Recovery

### Database Backup

```bash
# Backup PostgreSQL
docker exec zcc-postgres pg_dump -U postgres zcc_db > backup.sql

# Restore
docker exec -i zcc-postgres psql -U postgres zcc_db < backup.sql
```

### Application Backup

```bash
# Backup volume
docker run --rm -v postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz /data
```

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>
```

#### Database Connection Failed
```bash
# Check database status
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Restart database
docker-compose restart postgres
```

#### High Memory Usage
```bash
# Check memory
free -h

# Clear Docker cache
docker system prune -a
```

## Performance Optimization

### Frontend Optimization

```bash
# Build with production optimizations
npm run build:prod

# Check bundle size
npm run analyze
```

### Caching Strategy

- Static assets: 30 days
- API responses: 1 hour (configurable)
- Service worker: no-cache

### CDN Configuration

```bash
# Cloudflare or similar
- Cache level: Cache Everything
- Browser cache TTL: 1 month
- Minimum TLS version: 1.2
```

## Security Best Practices

1. **Secrets Management**
   - Use environment variables for secrets
   - Rotate secrets regularly
   - Never commit secrets to version control

2. **SSL/TLS**
   - Enable HSTS header
   - Use TLS 1.2+
   - Implement OCSP stapling

3. **CORS**
   - Restrict to trusted origins only
   - Use specific headers, not '*'

4. **Authentication**
   - Enforce strong passwords
   - Enable 2FA
   - Implement rate limiting

## Support & Maintenance

### Regular Updates

```bash
# Update dependencies
npm update

# Update Docker images
docker pull node:18-alpine
docker-compose pull

# Restart services
docker-compose restart
```

### Monitoring Dashboard

Access monitoring at:
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001`
- Sentry: `https://sentry.io/organizations/zellavora/`

---

**Last Updated**: July 27, 2026  
**Version**: 2.0.0
