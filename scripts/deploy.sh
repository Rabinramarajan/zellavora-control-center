#!/bin/bash

# Zellavora Control Center - Deployment Script
# Usage: ./scripts/deploy.sh [staging|production]

set -e

ENVIRONMENT=${1:-staging}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Deploying Zellavora Control Center to $ENVIRONMENT"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env.$ENVIRONMENT" ]; then
  export $(cat "$PROJECT_ROOT/.env.$ENVIRONMENT" | grep -v '#' | xargs)
  echo "✓ Loaded environment variables from .env.$ENVIRONMENT"
else
  echo "✗ Environment file .env.$ENVIRONMENT not found"
  exit 1
fi

# Build step
echo "📦 Building application..."
npm run build

# Docker build
echo "🐳 Building Docker images..."
docker build -t "zellavora-control-center:backend-latest" -f Dockerfile.backend .
docker build -t "zellavora-control-center:frontend-latest" -f Dockerfile.frontend .

# Tag for registry
if [ ! -z "$DOCKER_REGISTRY" ]; then
  docker tag "zellavora-control-center:backend-latest" "$DOCKER_REGISTRY/zellavora/backend:latest"
  docker tag "zellavora-control-center:frontend-latest" "$DOCKER_REGISTRY/zellavora/frontend:latest"

  echo "📤 Pushing to registry..."
  docker push "$DOCKER_REGISTRY/zellavora/backend:latest"
  docker push "$DOCKER_REGISTRY/zellavora/frontend:latest"
fi

# Database migrations
echo "🗄️  Running database migrations..."
docker run --rm \
  -e DATABASE_URL="$DATABASE_URL" \
  "zellavora-control-center:backend-latest" \
  npm run db:migrate

# Deployment
if [ "$ENVIRONMENT" = "staging" ]; then
  echo "🌐 Deploying to staging..."
  # Add your staging deployment commands here
  # Example: heroku deploy --app zellavora-staging
elif [ "$ENVIRONMENT" = "production" ]; then
  echo "🌐 Deploying to production..."
  # Add your production deployment commands here
  # Example: kubectl apply -f k8s/production.yaml
fi

echo "✅ Deployment complete!"
echo "📊 Frontend: $FRONTEND_URL"
echo "🔧 Backend: $API_URL"
