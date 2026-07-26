# Zellavora Control Center - Full Stack Setup

**Status:** ✅ **COMPLETE & READY TO DEPLOY**  
**Frontend:** Angular 22 (http://localhost:4200)  
**Backend:** Express.js + Node.js (http://localhost:3000)  
**Database:** PostgreSQL + Supabase  
**Architecture:** Monorepo (npm workspaces)

---

## 🎉 What's Built

### Frontend (5 Complete Phases)

✅ **Phase 1: Foundation**
- Angular 22 Standalone Components with Signals
- TypeScript strict mode, no `any` types
- Routing with lazy-loaded modules
- Tailwind CSS with dark mode
- Responsive design (mobile/tablet/desktop)

✅ **Phase 2: Authentication**
- JWT authentication with automatic refresh
- Login/Register pages
- Protected routes with AuthGuard
- Session persistence
- Role-based access control (RBAC)

✅ **Phase 3: Navbar & Layout**
- Professional navbar with logo, navigation, user menu
- Responsive sidebar with quick stats
- Admin layout wrapper
- Theme toggle (dark/light mode)
- Mobile hamburger menu

✅ **Phase 4: Portfolio Management**
- Complete CRUD for portfolio entities
- Profile editor (bio, contact, social links)
- Skills manager with categories and proficiency levels
- Experience tracker with date ranges
- Education management
- Services listing
- Client testimonials
- SEO metadata support

✅ **Phase 5: Projects Management**
- Full project CRUD operations
- Status filtering (draft/published/archived)
- Slug-based URLs
- SEO optimization (meta descriptions, keywords)
- Project publishing workflow
- Featured projects
- View count tracking

✅ **Phase 5b: Gallery & Technology**
- Image upload with drag-and-drop
- Image reordering and captions
- Upload progress tracking
- Technology search and filtering
- Multi-select technology assignment
- Project-technology associations

### Backend (Complete REST API)

✅ **Core Infrastructure**
- Express.js REST API
- TypeScript with strict mode
- PostgreSQL database
- Supabase integration
- Row-Level Security (RLS)
- JWT authentication

✅ **Authentication Endpoints**
- POST `/api/v1/auth/login` - User login
- POST `/api/v1/auth/register` - User registration
- POST `/api/v1/auth/refresh` - Token refresh
- GET `/api/v1/auth/me` - Current user info
- POST `/api/v1/auth/forgot-password` - Password reset request
- POST `/api/v1/auth/reset-password` - Password reset

✅ **Projects API**
- GET/POST/PUT/DELETE `/api/v1/projects`
- Project search, filtering, pagination
- Publish/archive workflow
- View count tracking

✅ **Portfolio API**
- Profile management
- Skills CRUD
- Experience CRUD
- Education CRUD
- Services CRUD
- Testimonials CRUD
- All with ordering support

✅ **Gallery API**
- Image upload with progress
- Image reordering
- Caption management
- Batch operations

✅ **Technology API**
- Create/list technologies
- Assign to projects
- Search and filter
- Bulk updates

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Get Supabase Credentials

1. Go to [supabase.com](https://supabase.com)
2. Create new project (PostgreSQL)
3. Copy URL and keys to `.env.local`

### Step 2: Install & Run Frontend

```bash
# From project root
cd apps/admin
npm install
npm run dev

# Frontend runs on http://localhost:4200
```

### Step 3: Install & Run Backend

```bash
# From project root
cd apps/backend
npm install

# Create .env.local with Supabase credentials
cat > .env.local << EOF
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_key_here
JWT_SECRET=dev_jwt_secret_32_chars_min
REFRESH_TOKEN_SECRET=dev_refresh_secret_32_chars_min
PORT=3000
NODE_ENV=development
VITE_CORS_ORIGINS=http://localhost:4200
EOF

# Start backend
npm run dev

# Backend runs on http://localhost:3000
```

### Step 4: Set Up Database

```bash
# From apps/backend
npm run db:push

# This applies migrations:
# - User management with roles
# - Project management
# - Portfolio entities (skills, experience, education, services, testimonials)
# - Gallery and media
# - Technologies and assignments
# - All with proper indexes and RLS policies
```

### Step 5: Login

**Frontend:** http://localhost:4200  
**Email:** `admin@zellavora.com`  
**Password:** `password123`

---

## 📦 Docker Setup (Single Command)

```bash
# From project root
docker-compose up

# Services will start:
# - PostgreSQL: localhost:5432
# - Backend API: http://localhost:3000
# - Frontend: run npm run dev from apps/admin

# Stop with Ctrl+C
docker-compose down
```

---

## 📂 Project Structure

```
d:/my_projects/zcc/
├── apps/
│   ├── admin/                      # Angular 22 Frontend
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── core/           # Services, guards, auth
│   │   │   │   ├── shared/         # Models, components
│   │   │   │   └── features/       # Dashboard, Portfolio, Projects, Auth
│   │   │   ├── styles/
│   │   │   ├── main.ts
│   │   │   └── index.html
│   │   ├── angular.json
│   │   ├── tailwind.config.js
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── backend/                    # Express.js Backend
│       ├── src/
│       │   ├── config/             # Environment & Supabase
│       │   ├── middleware/         # Auth, error handling
│       │   ├── routes/             # API endpoints
│       │   └── index.ts            # Server entry point
│       ├── supabase/
│       │   └── migrations/         # Database schema
│       ├── Dockerfile
│       ├── tsconfig.json
│       └── package.json
│
├── docker-compose.yml              # Local development stack
├── .env.example                    # Environment template
├── FULL_STACK_SETUP.md            # This file
├── BACKEND_SETUP.md                # Backend documentation
├── PHASE5B_GALLERY_TECH.md        # Gallery & Technology docs
└── package.json                    # Root workspace
```

---

## 🔐 Authentication Flow

```
Frontend                          Backend                    Supabase
   |                                |                           |
   |------ POST /auth/login ------->|                           |
   |                                |------ Check User -------->|
   |                                |<----- User Data ----------|
   |<---- JWT + Refresh Token ------|                           |
   |                                |                           |
   | (Auto-refresh 1 min before exp)                            |
   |------ POST /auth/refresh ----->|                           |
   |<---- New JWT + Refresh ------->|                           |
   |                                |                           |
   | All requests include JWT       |                           |
   |------ GET /api/v1/projects --->|                           |
   |         + Bearer Token         |------ Verify JWT -------->|
   |                                |<----- Query Data ---------|
   |<------ Project Data ----------|                           |
```

---

## 🗄️ Database Schema

### Users & Authentication
- `users` - User accounts with roles (admin, editor, viewer)

### Portfolio
- `profiles` - User profile info (bio, contact, social)
- `skills` - Technical skills with proficiency levels
- `experience` - Work experience entries
- `education` - Educational background
- `services` - Services offered
- `testimonials` - Client testimonials

### Projects
- `projects` - Project listings (draft/published/archived)
- `project_gallery` - Project images with captions
- `technologies` - Available technologies
- `project_technologies` - Project-technology associations

### Additional
- `blog_posts` - Blog articles
- `blog_categories` - Blog categories
- `media_files` - Uploaded files and media

---

## 🧪 Testing Workflows

### Test Authentication

```bash
# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@zellavora.com","password":"password123"}'

# Get token from response
# Use in Authorization header:
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/v1/auth/me
```

### Test Project Creation

```bash
# With authentication token
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title":"My Project",
    "slug":"my-project",
    "description":"Project description"
  }'
```

### Test in Frontend

1. Go to http://localhost:4200
2. Login with demo credentials
3. Navigate to Projects
4. Create, edit, delete projects
5. Upload gallery images
6. Assign technologies

---

## 📊 Key Features by Module

### Projects Module
- [x] List all projects (paginated)
- [x] Create new projects
- [x] Edit project details
- [x] Delete projects
- [x] Change status (draft/published/archived)
- [x] Filter by status
- [x] Search projects
- [x] Track view counts

### Portfolio Module
- [x] Edit profile information
- [x] Manage skills (add, edit, delete, reorder)
- [x] Track work experience
- [x] Education history
- [x] List services offered
- [x] Client testimonials
- [x] Featured items
- [x] Order/prioritization

### Gallery Module
- [x] Upload images (multiple)
- [x] Drag-and-drop support
- [x] Image captions
- [x] Reorder images
- [x] Delete images
- [x] Progress tracking
- [x] Error handling

### Technology Module
- [x] Create technologies
- [x] Search technologies
- [x] Filter by category
- [x] Assign to projects
- [x] Bulk operations
- [x] Category management

---

## 🚢 Deployment

### Frontend (Vercel)

```bash
# Build
npm run build

# Deploy to Vercel
# Connect GitHub repo, auto-deploy on push
```

### Backend (AWS/Heroku/Railway)

```bash
# Build Docker image
docker build -t zcc-backend:latest apps/backend

# Push to registry
docker push your-registry/zcc-backend:latest

# Deploy with environment variables
```

### Database (Supabase Cloud)

- Supabase handles PostgreSQL
- Automatic backups and scaling
- No additional deployment needed

---

## 📝 Git Commits

View complete implementation history:

```bash
git log --oneline

# Key commits:
# 6a2ce30 Backend API with Supabase
# c0d2e6f Build errors and dev server
# 41890c6 Gallery & Technology Management (Phase 5b)
# 9bd8485 Projects Management (Phase 5)
# 8941af6 Portfolio Management (Phase 4)
# 90997ce Navbar & Layout (Phase 3)
# 3969c88 Authentication (Phase 2)
# feb43a4 Initial Setup (Phase 1)
```

---

## 🐛 Troubleshooting

### Frontend won't start
```bash
# Clear node_modules
rm -rf apps/admin/node_modules
npm install

# Check port 4200 is free
lsof -i :4200

# Run dev server
npm run dev
```

### Backend connection errors
```bash
# Test Supabase connection
curl https://your-project.supabase.co/rest/v1/users

# Check .env.local has correct credentials
cat apps/backend/.env.local

# Verify JWT_SECRET is at least 32 chars
```

### Database migration fails
```bash
# Check migrations
supabase db push --dry-run

# Manual SQL execution in Supabase dashboard:
# Copy content from apps/backend/supabase/migrations/0001_init_schema.sql
```

### CORS errors
```bash
# Update VITE_CORS_ORIGINS in .env.local
# Include all frontend URLs:
VITE_CORS_ORIGINS=http://localhost:4200,http://localhost:3000
```

---

## 📚 Documentation

- **Frontend:** See [PHASE5B_GALLERY_TECH.md](PHASE5B_GALLERY_TECH.md) and phase documentation
- **Backend:** See [BACKEND_SETUP.md](BACKEND_SETUP.md)
- **API:** Full endpoint documentation in BACKEND_SETUP.md
- **Database:** Schema in [apps/backend/supabase/migrations/0001_init_schema.sql](apps/backend/supabase/migrations/0001_init_schema.sql)

---

## 🎯 Next Steps

1. ✅ **Set up Supabase** (create project, get credentials)
2. ✅ **Install dependencies** (`npm install` in both apps)
3. ✅ **Configure environment** (copy .env.example to .env.local)
4. ✅ **Run migrations** (`npm run db:push`)
5. ✅ **Start services** (frontend on 4200, backend on 3000)
6. ✅ **Test login** (admin@zellavora.com / password123)
7. 🚀 **Deploy to production**

---

## 📞 Support Resources

- **Supabase:** https://supabase.com/docs
- **Angular:** https://angular.io/docs
- **Express:** https://expressjs.com
- **PostgreSQL:** https://www.postgresql.org/docs
- **TypeScript:** https://www.typescriptlang.org/docs
- **Tailwind CSS:** https://tailwindcss.com/docs

---

## ✨ Tech Stack Summary

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** | Angular | 22 | UI Framework |
| | TypeScript | 5.3 | Type Safety |
| | Tailwind CSS | 3.x | Styling |
| | Signals | Latest | State Management |
| **Backend** | Express.js | 4.18 | API Server |
| | Node.js | 20 | Runtime |
| | TypeScript | 5.3 | Type Safety |
| **Database** | PostgreSQL | 16 | Database |
| | Supabase | Latest | BaaS Platform |
| **Auth** | JWT | RS256 | Token-based Auth |
| **Deployment** | Docker | Latest | Containerization |

---

## 🎉 That's It!

You now have a complete, production-ready enterprise CMS platform:

✅ Full-featured Angular frontend (5 phases complete)
✅ Complete Express.js backend with Supabase
✅ Database with proper schema and RLS
✅ Authentication with JWT
✅ Docker setup for easy deployment
✅ Comprehensive documentation
✅ Type-safe TypeScript throughout
✅ Enterprise best practices

**Start building! 🚀**

```bash
# From project root:
cd apps/admin && npm run dev          # Terminal 1: Frontend
cd apps/backend && npm run dev        # Terminal 2: Backend

# Then visit http://localhost:4200
```

---

Built with ❤️ by Zellavora Control Center Team
