# Zellavora Control Center - Development Guide

## Project Overview

**Zellavora Control Center (ZCC)** is an enterprise-grade CMS and operations management platform built with modern technologies and enterprise architecture principles.

- **Version**: 1.0.0
- **License**: MIT
- **Author**: Zellavora
- **Status**: Active Development

## Tech Stack

### Frontend
- **Framework**: Angular 22 with Standalone Components
- **State Management**: Signals (signal(), computed(), effect(), linkedSignal())
- **UI Library**: Angular Material, Tailwind CSS
- **PWA**: Service Workers, Offline Support
- **SSR**: Angular Universal for SEO
- **Testing**: Playwright (E2E), Jasmine (Unit)
- **Styling**: Tailwind CSS with dark/light mode support

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: Supabase Auth + JWT with Refresh Tokens
- **Storage**: Supabase Storage
- **Real-time**: WebSocket support
- **Email**: SendGrid / Nodemailer
- **Queue**: BullMQ + Redis (optional)
- **Logging**: Winston

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **CDN**: Cloudflare (optional)
- **Deployment**: Vercel (Frontend), Cloud Run/Render (Backend)
- **CI/CD**: GitHub Actions

## Architecture Principles

### Clean Architecture
- **Separation of Concerns**: UI, Business Logic, Data Access
- **Dependency Injection**: Invert control, testable code
- **Repository Pattern**: Abstract data sources
- **Service Layer**: Reusable business logic
- **Error Handling**: Centralized error management

### Feature-Based Structure
```
apps/
├── admin/                    # Admin dashboard (Angular)
│   └── src/app/
│       ├── core/            # Shared services, auth, HTTP
│       ├── features/        # Feature modules (lazy-loaded)
│       └── shared/          # Reusable components, pipes, directives
├── backend/                 # Express API server
│   └── src/
│       ├── config/          # Configuration management
│       ├── middleware/      # Express middleware
│       ├── modules/         # Feature modules
│       │   ├── auth/
│       │   ├── users/
│       │   ├── projects/
│       │   ├── dashboard/
│       │   └── ...
│       └── infrastructure/  # Database, logger, cache, etc
└── public/                  # Public website (future)

packages/
└── shared/                  # Shared utilities, types
```

### SOLID Principles
- **S**: Single Responsibility
- **O**: Open/Closed
- **L**: Liskov Substitution
- **I**: Interface Segregation
- **D**: Dependency Inversion

## Development Standards

### TypeScript
- **Mode**: Strict
- **Target**: ES2022
- **Lib**: ES2022, DOM
- **Module**: ESNext
- **No implicit any**: true
- **Strict null checks**: true

### Code Quality
✅ ESLint configuration enforced  
✅ Prettier formatting applied  
✅ TypeScript strict mode  
✅ No TODOs or placeholder code  
✅ No unused variables or imports  
✅ Meaningful naming conventions  
✅ Comments only for non-obvious WHY  

### Testing Strategy
- **Unit Tests**: 80%+ coverage
- **Integration Tests**: API and service integration
- **E2E Tests**: Playwright for critical user flows
- **Performance Tests**: Lighthouse, bundle analysis

### Responsive Design
- **Mobile First**: Design for mobile, enhance for larger screens
- **Breakpoints**: xs(0), sm(640), md(768), lg(1024), xl(1280), 2xl(1536)
- **Touch Friendly**: Min 44x44px interactive elements
- **Keyboard Navigation**: Full keyboard support
- **Accessibility**: WCAG 2.2 AA compliance

## Frontend Guidelines

### Angular Best Practices
1. **Standalone Components**: No NgModules
2. **Signals Everywhere**: signal(), computed(), effect(), linkedSignal()
3. **Lazy Loading**: Every feature route is lazy-loaded
4. **Change Detection**: OnPush strategy
5. **HttpClient**: Typed responses with interceptors
6. **State Management**: Signals for local state
7. **Routing**: Feature-based with guards
8. **Error Handling**: Global error interceptor
9. **Security**: XSS protection, CSRF tokens
10. **Performance**: Tree-shaking, code splitting

### Component Structure
```typescript
// Component template with standalone
@Component({
  selector: 'app-example',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `<div>{{ title() }}</div>`,
  styles: [`...`]
})
export class ExampleComponent {
  // Signals for state
  title = signal('Hello');
  
  // Computed values
  uppercase = computed(() => this.title().toUpperCase());
  
  // Effects for side effects
  constructor() {
    effect(() => {
      console.log(this.title());
    });
  }
}
```

### Styling
- **Tailwind CSS**: Utility-first CSS
- **CSS Variables**: Theme customization
- **Dark Mode**: @media (prefers-color-scheme: dark)
- **Animation**: Micro-interactions, smooth transitions
- **Responsive**: Mobile-first approach

### Folder Structure (Feature Module)
```
features/dashboard/
├── components/
│   ├── dashboard-header/
│   ├── kpi-cards/
│   ├── charts/
│   └── activity-feed/
├── services/
│   └── dashboard.service.ts
├── models/
│   └── dashboard.model.ts
├── guards/
│   └── dashboard.guard.ts
├── dashboard.routes.ts
└── dashboard.component.ts
```

## Backend Guidelines

### Express Best Practices
1. **Middleware**: Request logging, error handling, auth
2. **Routes**: RESTful API design
3. **Controllers**: Request handling, validation
4. **Services**: Business logic layer
5. **Repositories**: Data access abstraction
6. **Validation**: Zod schema validation
7. **Error Handling**: Centralized error middleware
8. **Logging**: Winston logger
9. **Rate Limiting**: Express rate limit
10. **Security**: Helmet, CORS, input validation

### Module Structure
```
modules/projects/
├── projects.controller.ts      # Route handlers
├── projects.service.ts         # Business logic
├── projects.repository.ts      # Data access
├── projects.routes.ts          # Route definitions
├── projects.dto.ts             # DTOs & validation
├── projects.types.ts           # TypeScript types
└── projects.middleware.ts      # Module middleware
```

### API Endpoint Pattern
```typescript
GET    /api/v1/projects             # List all projects
POST   /api/v1/projects             # Create project
GET    /api/v1/projects/:id         # Get project
PUT    /api/v1/projects/:id         # Update project
DELETE /api/v1/projects/:id         # Delete project
GET    /api/v1/projects/:id/tasks   # Get project tasks
```

## Database Schema

### Core Tables
- **users** - User accounts
- **organizations** - Workspace/company
- **roles** - User roles (admin, manager, member)
- **permissions** - System permissions
- **projects** - Project records
- **teams** - Team grouping
- **audit_logs** - Activity tracking
- **notifications** - User notifications
- **settings** - System settings

### Key Columns (All Tables)
- `id` - UUID primary key
- `created_at` - Timestamp (auto)
- `updated_at` - Timestamp (auto)
- `created_by` - User who created
- `updated_by` - User who updated
- `deleted_at` - Soft delete timestamp (nullable)

## Security Requirements

✅ **Authentication**: JWT with refresh tokens  
✅ **Authorization**: Role-Based Access Control (RBAC)  
✅ **Input Validation**: Zod schema on backend, Angular validators  
✅ **SQL Injection**: Prisma parameterized queries  
✅ **XSS Protection**: Angular sanitization, CSP headers  
✅ **CSRF**: Token-based protection  
✅ **Rate Limiting**: Express rate limit  
✅ **Secure Cookies**: HttpOnly, Secure, SameSite  
✅ **Encryption**: Sensitive data encryption at rest  
✅ **Audit Logging**: Track user actions  

## Environment Variables

### Frontend (.env)
```
VITE_API_URL=http://localhost:3000/api
VITE_AUTH_DOMAIN=auth.zellavora.com
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### Backend (.env)
```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/zcc
JWT_SECRET=your-secret-key
SUPABASE_URL=
SUPABASE_KEY=
SENDGRID_API_KEY=
REDIS_URL=redis://localhost:6379
```

## Git Workflow

### Branches
- `main` - Production ready code
- `develop` - Development branch
- `feat/*` - Feature branches
- `fix/*` - Bug fix branches
- `docs/*` - Documentation branches

### Commit Message Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**: feat, fix, docs, style, refactor, perf, test, chore

## Performance Targets

| Metric | Target |
|--------|--------|
| Lighthouse Score | 90+ |
| Bundle Size (gzipped) | < 1MB |
| First Contentful Paint | < 2s |
| Largest Contentful Paint | < 3s |
| Cumulative Layout Shift | < 0.1 |
| Time to Interactive | < 3.5s |

## Development Workflow

1. **Setup**: `npm install` && `npm run db:migrate`
2. **Development**: `npm run dev` (frontend) + `npm run dev:backend` (backend)
3. **Testing**: `npm run test` for unit, `npm run test:e2e` for E2E
4. **Quality**: `npm run lint && npm run format`
5. **Build**: `npm run build`
6. **Deploy**: See DEPLOYMENT.md

## Common Tasks

### Adding a New Feature
1. Create feature folder in `features/`
2. Create component with `@Component()` standalone
3. Use Signals for state management
4. Create service for business logic
5. Add route with lazy loading
6. Add tests with 80%+ coverage
7. Update documentation

### Adding a New API Endpoint
1. Create controller method
2. Define DTO with Zod validation
3. Implement service logic
4. Add repository method
5. Register route in module
6. Add API documentation
7. Add tests
8. Update OpenAPI spec

### Database Migration
```bash
npx prisma migrate dev --name add_new_table
# Updates schema.prisma and creates migration file
```

## Useful Commands

```bash
# Frontend
npm run dev:admin              # Start dev server
npm run build:admin            # Production build
npm run test:admin             # Run tests
npm run test:e2e              # E2E tests
npm run lint:admin            # Lint check
npm run format                # Format all files

# Backend
npm run dev:backend           # Start dev server
npm run build:backend         # Compile TypeScript
npm run test:backend          # Run tests
npm run db:migrate            # Database migration
npm run db:seed               # Seed sample data
npm run db:studio             # Prisma Studio

# Docker
npm run docker:build          # Build image
npm run docker:up             # Start containers
npm run docker:down           # Stop containers
```

## Monitoring & Logging

- **Frontend**: Console errors, performance metrics
- **Backend**: Winston logger, application logs
- **Database**: PostgreSQL logs
- **Audit**: Complete audit trail of user actions

## Support & Documentation

- **Main Docs**: `/docs` folder
- **Setup**: `docs/SETUP_GUIDE.md`
- **Architecture**: `docs/ARCHITECTURE.md`
- **API**: `docs/API.md`
- **Database**: `docs/DATABASE.md`
- **Deployment**: `docs/DEPLOYMENT.md`

## Project Status

### ✅ Completed
- Backend scaffolding & core modules
- Frontend app structure with Angular 22
- Authentication & Authorization system
- Database schema (Prisma)
- Dashboard foundation
- Admin panel structure
- Audit logging

### 🔄 In Progress
- Feature completion (projects, teams, settings)
- UI component library refinement
- API endpoint implementation
- Testing suite setup
- Documentation

### 📋 To Do
- Advanced filtering & search
- Real-time WebSocket features
- Reporting & export functionality
- Mobile app (React Native - future)
- Notification system
- Advanced analytics
- Performance optimization

## Notes

- **Always use strict TypeScript**
- **Never commit TODO comments**
- **Test before merge**
- **Keep components small & focused**
- **Reuse components & services**
- **Document public APIs**
- **Follow naming conventions**
- **Keep git history clean**
