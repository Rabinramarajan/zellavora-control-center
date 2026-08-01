# Zellavora Control Center - Admin Dashboard

**Enterprise CMS Admin Interface**

Built with Angular 22, TypeScript, Tailwind CSS, and Supabase.

## 🚀 Quick Start

```bash
cd apps/admin

# Install dependencies
npm install

# Start development server
npm run dev

# Dashboard at http://localhost:4200
```

## 📋 Features

- ✅ Modern UI with Tailwind CSS
- ✅ Signal-based state management
- ✅ Type-safe with TypeScript
- ✅ Dark/Light mode
- ✅ Responsive design
- ✅ Real-time updates
- ✅ Secure authentication
- ✅ Comprehensive error handling
- ✅ Accessibility compliant

## 📁 Project Structure

```
src/
├── app/
│   ├── features/            # Feature modules
│   │   ├── auth/            # Authentication
│   │   ├── dashboard/       # Dashboard
│   │   ├── portfolio/       # Portfolio management
│   │   ├── projects/        # Project management
│   │   ├── blog/            # Blog CMS
│   │   ├── media/           # Media library
│   │   ├── analytics/       # Analytics
│   │   ├── users/           # User management
│   │   └── settings/        # Settings
│   ├── core/                # Core services
│   │   ├── http/            # API client
│   │   └── auth/            # Auth service
│   ├── shared/              # Shared components
│   │   ├── components/      # Reusable UI components
│   │   ├── directives/      # Custom directives
│   │   ├── pipes/           # Custom pipes
│   │   ├── utils/           # Utility functions
│   │   ├── constants/       # Constants
│   │   └── models/          # Type definitions
│   ├── app.component.ts     # Root component
│   ├── app.routes.ts        # Routing
│   └── app.config.ts        # App configuration
├── environments/            # Environment configs
├── styles/                  # Global styles
└── main.ts                  # Entry point
```

## 🔧 Available Scripts

```bash
# Development
npm run dev              # Start dev server with hot reload
npm run build            # Production build
npm run build:prod       # Explicit production build

# Testing
npm run test             # Run tests
npm run test:watch       # Watch mode
npm run test:e2e         # E2E tests

# Code Quality
npm run lint             # ESLint check
npm run format           # Prettier format
npm run type-check       # TypeScript check
```

## 🎨 Theming

The dashboard includes full dark/light mode support using Tailwind CSS.

### Theme Colors
- **Primary:** Blue (#0ea5e9)
- **Secondary:** Purple (#a855f7)
- **Accent:** Amber (#f59e0b)

### Customizing Theme

Edit `tailwind.config.js`:
```javascript
theme: {
  extend: {
    colors: {
      primary: { /* your colors */ },
      secondary: { /* your colors */ },
    },
  },
},
```

## 🔐 Authentication

The admin dashboard uses JWT-based authentication with automatic token refresh.

### Login
- Organization (client code): `zellavora-inc`
- Email: `admin@zellavora.com`
- Password: `AdminPassword123!`

### How it Works
1. User logs in with email/password
2. Backend returns JWT access token + refresh token
3. Access token stored in localStorage
4. All API requests include token in Authorization header
5. Token automatically refreshed before expiry

## 🌐 API Integration

### API Client Service
Located in `src/app/core/http/api-client.service.ts`

```typescript
constructor(private api: ApiClientService) {}

// GET request
this.api.get<Project>('/projects/123').subscribe(project => {
  console.log(project);
});

// POST request
this.api.post<Project>('/projects', newProject).subscribe(project => {
  console.log(project);
});

// PUT request
this.api.put<Project>('/projects/123', updates).subscribe(project => {
  console.log(project);
});

// DELETE request
this.api.delete<void>('/projects/123').subscribe(() => {
  console.log('Deleted');
});
```

## 🧪 Testing

### Unit Tests
```bash
npm run test
```

### E2E Tests
```bash
npm run test:e2e
```

### Coverage Report
```bash
npm run test -- --coverage
```

## 📦 Dependencies

### Core
- `@angular/core` - Angular framework
- `@angular/router` - Routing
- `@angular/forms` - Form handling
- `rxjs` - Reactive programming

### Styling
- `tailwindcss` - Utility-first CSS
- `@tailwindcss/forms` - Form styling
- `@tailwindcss/typography` - Typography

### Backend
- `@supabase/supabase-js` - Supabase client

### Charts
- `apexcharts` - Interactive charts

### Build
- `@angular/cli` - Angular CLI
- `vite` - Build tool (via Angular)

## 🚀 Deployment

### Vercel Deployment
```bash
npm run build
# Deploy the dist/ folder to Vercel
```

### Docker
```bash
docker build -t zcc-admin .
docker run -p 4200:80 zcc-admin
```

## 🐛 Debugging

### Browser DevTools
1. Open Chrome DevTools (F12)
2. Go to Sources tab
3. Set breakpoints in TypeScript files
4. Step through code

### VS Code Debugging
Add to `.vscode/launch.json`:
```json
{
  "type": "chrome",
  "request": "launch",
  "name": "Angular Debug",
  "url": "http://localhost:4200",
  "webRoot": "${workspaceFolder}/src",
  "sourceMaps": true
}
```

### Console Logging
```typescript
import { LoggerService } from '@core/logger';

constructor(private logger: LoggerService) {}

this.logger.info('Message', { data: 'value' });
this.logger.error('Error', error);
```

## 📚 Resources

- [Angular 22 Docs](https://angular.io/docs)
- [Angular Signals](https://angular.io/guide/signals)
- [Tailwind CSS](https://tailwindcss.com)
- [TypeScript](https://www.typescriptlang.org/docs)

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Run tests & lint
4. Create pull request

## 📄 License

MIT - See LICENSE file

---

**Happy Coding!** 🚀
