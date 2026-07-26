# Zellavora Control Center - Backend Setup Guide

**Status:** ✅ **READY TO DEPLOY**  
**Framework:** Express.js + TypeScript + Supabase  
**Port:** 3000  
**API Version:** v1

---

## 🚀 Quick Start

### Option 1: Local Development (Recommended)

```bash
# Navigate to backend directory
cd apps/backend

# Install dependencies
npm install

# Create .env.local with your Supabase credentials
cp ../../.env.example .env.local

# Start development server
npm run dev
```

The server will start on **http://localhost:3000**

### Option 2: Docker Compose (Full Stack)

```bash
cd d:/my_projects/zcc

# Start all services (PostgreSQL + Backend)
docker-compose up

# Services will be available at:
# - Backend API: http://localhost:3000
# - PostgreSQL: localhost:5432
```

---

## 📋 Environment Variables

Create `.env.local` in `apps/backend/` with your Supabase credentials:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# JWT
JWT_SECRET=your_secret_min_32_chars
REFRESH_TOKEN_SECRET=your_refresh_secret_min_32_chars

# Server
PORT=3000
NODE_ENV=development
VITE_CORS_ORIGINS=http://localhost:4200,http://localhost:3000
```

---

## 🗄️ Database Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Copy credentials to `.env.local`

### 2. Run Database Migrations

```bash
# Push schema to Supabase
npm run db:push

# Or manually run SQL from:
# supabase/migrations/0001_init_schema.sql
```

### 3. Create Demo User (Optional)

```bash
npm run db:seed
```

---

## 📚 API Endpoints

### Authentication

```
POST   /api/v1/auth/login              - Login with email/password
POST   /api/v1/auth/register           - Register new account
POST   /api/v1/auth/refresh            - Refresh access token
GET    /api/v1/auth/me                 - Get current user
POST   /api/v1/auth/forgot-password    - Request password reset
POST   /api/v1/auth/reset-password     - Reset password
```

### Projects

```
GET    /api/v1/projects                - List all projects (paginated)
GET    /api/v1/projects/:id            - Get project details
GET    /api/v1/projects/slug/:slug     - Get project by slug
POST   /api/v1/projects                - Create project (auth required)
PUT    /api/v1/projects/:id            - Update project (auth required)
DELETE /api/v1/projects/:id            - Delete project (auth required)
POST   /api/v1/projects/:id/publish    - Publish project (auth required)
POST   /api/v1/projects/:id/archive    - Archive project (auth required)
```

### Portfolio

```
GET    /api/v1/profile                 - Get profile
PUT    /api/v1/profile                 - Update profile

GET    /api/v1/skills                  - List skills
POST   /api/v1/skills                  - Create skill
PUT    /api/v1/skills/:id              - Update skill
DELETE /api/v1/skills/:id              - Delete skill

GET    /api/v1/experience              - List experience
POST   /api/v1/experience              - Create experience
PUT    /api/v1/experience/:id          - Update experience
DELETE /api/v1/experience/:id          - Delete experience

GET    /api/v1/education               - List education
POST   /api/v1/education               - Create education
PUT    /api/v1/education/:id           - Update education
DELETE /api/v1/education/:id           - Delete education

GET    /api/v1/services                - List services
POST   /api/v1/services                - Create service
PUT    /api/v1/services/:id            - Update service
DELETE /api/v1/services/:id            - Delete service

GET    /api/v1/testimonials            - List testimonials
POST   /api/v1/testimonials            - Create testimonial
PUT    /api/v1/testimonials/:id        - Update testimonial
DELETE /api/v1/testimonials/:id        - Delete testimonial
```

### Gallery

```
GET    /api/v1/projects/:projectId/gallery              - List gallery images
POST   /api/v1/projects/:projectId/gallery              - Upload image
PUT    /api/v1/projects/:projectId/gallery/:imageId     - Update image
DELETE /api/v1/projects/:projectId/gallery/:imageId     - Delete image
```

### Technologies

```
GET    /api/v1/technologies                             - List all technologies
GET    /api/v1/projects/:projectId/technologies         - List project technologies
POST   /api/v1/projects/:projectId/technologies         - Add technology
DELETE /api/v1/projects/:projectId/technologies/:techId  - Remove technology
PUT    /api/v1/projects/:projectId/technologies         - Bulk update technologies
POST   /api/v1/technologies                             - Create technology
```

---

## 🔐 Authentication

All protected endpoints require Bearer token in Authorization header:

```bash
curl -H "Authorization: Bearer <access_token>" \
     http://localhost:3000/api/v1/auth/me
```

### Login Example

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@zellavora.com",
    "password": "password123"
  }'
```

Response:

```json
{
  "user": {
    "id": "uuid",
    "email": "admin@zellavora.com",
    "fullName": "Admin User",
    "role": "admin"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "expiresIn": 900
}
```

---

## 📊 Database Schema

### Users Table

```
id              UUID (Primary Key)
email           VARCHAR (Unique)
full_name       VARCHAR
avatar_url      TEXT
role            ENUM (admin, editor, viewer)
is_active       BOOLEAN
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

### Projects Table

```
id              UUID (Primary Key)
user_id         UUID (FK to users)
title           VARCHAR
slug            VARCHAR (Unique)
description     TEXT
content         TEXT
status          ENUM (draft, published, archived)
category        VARCHAR
cover_image_url TEXT
view_count      INTEGER
created_at      TIMESTAMPTZ
published_at    TIMESTAMPTZ
```

### Project Gallery

```
id              UUID (Primary Key)
project_id      UUID (FK to projects)
media_url       TEXT
caption         TEXT
order_index     INTEGER
created_at      TIMESTAMPTZ
```

### Technologies

```
id              UUID (Primary Key)
name            VARCHAR (Unique)
category        VARCHAR
description     TEXT
icon_url        TEXT
created_at      TIMESTAMPTZ
```

---

## 🧪 Testing

### Health Check

```bash
curl http://localhost:3000/health
# Response: { "status": "ok", "timestamp": "..." }
```

### Test with Frontend

1. Start frontend: `npm run dev` (port 4200)
2. Start backend: `npm run dev` (port 3000)
3. Frontend auto-connects to backend API
4. Login with demo credentials:
   - Email: `admin@zellavora.com`
   - Password: `password123`

---

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Supabase Connection Error

- Verify `VITE_SUPABASE_URL` and keys in `.env.local`
- Check Supabase project is active
- Ensure CORS is enabled in Supabase settings

### Database Migration Failed

```bash
# Check migrations status
supabase db push --dry-run

# Manually run SQL:
# Connect to Supabase and paste content of:
# supabase/migrations/0001_init_schema.sql
```

---

## 📝 Development

### Project Structure

```
apps/backend/
├── src/
│   ├── config/          - Configuration files
│   ├── middleware/      - Express middleware
│   ├── routes/          - API route handlers
│   └── index.ts         - Main server file
├── supabase/
│   └── migrations/      - Database migrations
├── package.json
└── tsconfig.json
```

### TypeScript

All code is written in TypeScript with strict mode enabled:

```bash
# Build TypeScript
npm run build

# Watch mode
npx tsc --watch
```

### Linting

```bash
npm run lint
```

---

## 🚢 Production Deployment

### Environment Variables (Production)

```env
NODE_ENV=production
PORT=3000
VITE_SUPABASE_URL=https://your-prod-project.supabase.co
VITE_SUPABASE_ANON_KEY=prod_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=prod_service_key_here
JWT_SECRET=prod_secret_min_32_chars
REFRESH_TOKEN_SECRET=prod_refresh_secret_min_32_chars
VITE_CORS_ORIGINS=https://yourdomain.com
```

### Deploy to Heroku

```bash
# Login to Heroku
heroku login

# Create app
heroku create zcc-backend

# Set environment variables
heroku config:set NODE_ENV=production VITE_SUPABASE_URL=... JWT_SECRET=...

# Deploy
git push heroku main
```

### Deploy to AWS EC2

1. Create EC2 instance (Node.js AMI)
2. Clone repository
3. Install dependencies: `npm install`
4. Set environment variables
5. Build: `npm run build`
6. Start: `npm start`

---

## 📞 Support

- **Frontend:** http://localhost:4200
- **Backend API:** http://localhost:3000
- **Supabase Docs:** https://supabase.com/docs
- **Express Docs:** https://expressjs.com

---

Built with ❤️ by Zellavora
