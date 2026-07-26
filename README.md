# 🚀 Zellavora Control Center (ZCC)

**Enterprise-grade CMS and Administration Platform**

A production-ready, scalable, and fully documented enterprise platform for managing portfolios, projects, blogs, media, and more.

## 🎯 Vision

Build once, scale infinitely. ZCC starts as your personal portfolio CMS and grows into your complete digital products platform.

## ✨ Features

- **Enterprise Portfolio CMS** - Manage all portfolio sections dynamically
- **Project Management** - Create unlimited projects with galleries and technologies
- **Blog Platform** - Rich text editor with SEO optimization
- **Media Library** - Organize and manage all your assets
- **Analytics Dashboard** - Track visitors, engagement, and downloads
- **Admin Panel** - User management, roles, permissions, audit logs
- **Secure Authentication** - JWT with refresh tokens and RLS
- **Real-time Sync** - Supabase realtime subscriptions
- **Dark/Light Mode** - Full theme support
- **Mobile Responsive** - Works on all devices
- **Accessible** - WCAG 2.2 compliant
- **Performant** - Optimized bundle and rendering
- **Scalable** - Enterprise architecture from day one

## 📋 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Angular 22, Signals, TypeScript, Tailwind CSS |
| **Backend** | Supabase, PostgreSQL, Edge Functions |
| **Auth** | JWT, Supabase Auth, RLS Policies |
| **Storage** | Supabase Storage |
| **Deployment** | Vercel, Docker, Cloudflare CDN |
| **Testing** | Playwright, Jasmine, Karma |
| **CI/CD** | GitHub Actions |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (LTS)
- npm 9+
- Git

### Installation

```bash
# Clone repository
git clone https://github.com/zellavora/zcc.git
cd zcc

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Start development
npm run dev:admin

# Dashboard ready at http://localhost:4200
```

## 📚 Documentation

- **[Architecture](./docs/ARCHITECTURE.md)** - System design & principles
- **[Setup Guide](./docs/SETUP_GUIDE.md)** - Installation & configuration
- **[Development](./apps/admin/README.md)** - Frontend development guide
- **[API Documentation](./docs/API.md)** - REST API reference
- **[Database](./docs/DATABASE.md)** - Schema & RLS policies
- **[Deployment](./docs/DEPLOYMENT.md)** - Production deployment

## 📂 Project Structure

```
zcc/
├── apps/admin/           # Angular admin dashboard
├── apps/public/          # Public portfolio (future)
├── services/             # Backend APIs (future)
├── packages/             # Shared libraries
├── docs/                 # Complete documentation
├── .supabase/            # Database migrations
└── docker-compose.yml    # Local development setup
```

## 🎯 Available Scripts

```bash
# Development
npm run dev              # Start admin dashboard
npm run dev:admin        # Admin only
npm run dev:public       # Public portfolio only

# Testing
npm run test             # Run tests
npm run test:watch       # Watch mode
npm run test:e2e         # E2E tests

# Quality
npm run lint             # Lint code
npm run format           # Format with Prettier
npm run type-check       # TypeScript check

# Build
npm run build            # Production build
npm run analyze          # Bundle analysis

# Database
npm run db:migrate       # Run migrations
npm run db:reset         # Reset DB (dev only)
npm run db:seed          # Seed sample data

# Deployment
npm run deploy:staging   # Deploy to staging
npm run deploy:production # Deploy to production
```

## 🔐 Security

✅ OWASP Top 10 Compliant  
✅ Row-Level Security (RLS)  
✅ JWT with Refresh Tokens  
✅ CSRF Protection  
✅ SQL Injection Prevention  
✅ XSS Protection  
✅ Secure Cookies  
✅ Audit Logging  

## 📊 Performance Targets

- **Lighthouse Score:** 90+
- **Bundle Size:** < 1MB (gzipped)
- **FCP:** < 2 seconds
- **LCP:** < 3 seconds
- **CLS:** < 0.1
- **TTI:** < 3.5 seconds

## 🧪 Testing

```bash
# Unit tests with 80%+ coverage
npm run test

# E2E tests with Playwright
npm run test:e2e

# Coverage report
npm run test -- --coverage
```

## 🌐 Deployment

### Staging
```bash
npm run deploy:staging
# Available at: https://zcc-staging.vercel.app
```

### Production
```bash
npm run deploy:production
# Available at: https://zcc.zellavora.com
```

## 📝 Development Workflow

1. Create feature branch: `git checkout -b feat/feature-name`
2. Develop with hot reload: `npm run dev:admin`
3. Run tests: `npm run test`
4. Lint & format: `npm run lint && npm run format`
5. Push & create PR
6. CI/CD runs automatically

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - See [LICENSE](./LICENSE)

## 🎓 Learning Resources

- [Angular Documentation](https://angular.io)
- [Supabase Docs](https://supabase.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Tailwind CSS](https://tailwindcss.com)

## 🐛 Issues & Support

- [GitHub Issues](https://github.com/zellavora/zcc/issues)
- [Discussions](https://github.com/zellavora/zcc/discussions)
- [Documentation](./docs)

## 👨‍💻 Author

**Zellavora**  
Enterprise Software Engineering  
© 2026 All Rights Reserved

---

**Ready to build something amazing?** Start with the [Setup Guide](./docs/SETUP_GUIDE.md).
