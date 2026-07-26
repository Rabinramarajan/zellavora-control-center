# Phase 2: Authentication Integration - Setup Instructions

**Status:** ✅ **Ready to Install & Run**  
**What's Complete:** Auth system foundation  
**What's Next:** Install dependencies and start development

---

## 📦 What Was Built in Phase 2

### ✅ Core Authentication Services
1. **AuthService** (`src/app/core/auth/auth.service.ts`)
   - Signals-based state management
   - Login/logout/register flows
   - JWT token management with automatic refresh
   - Token expiry handling
   - Error messages
   - Permission/role checking

2. **Auth Guard** (`src/app/core/auth/auth.guard.ts`)
   - Route protection
   - Functional guards for canActivate
   - Role-based access control
   - Permission-based access control

3. **Auth Interceptor** (`src/app/core/auth/auth.interceptor.ts`)
   - Automatic JWT token attachment to requests
   - 401 error handling with token refresh
   - Exempts auth endpoints from token requirement

4. **Logger Service** (`src/app/core/logger/logger.service.ts`)
   - Structured logging with timestamps
   - Log level configuration (debug, info, warn, error)
   - Console output formatting

5. **Storage Service** (`src/app/core/storage/storage.service.ts`)
   - LocalStorage abstraction
   - Fallback to SessionStorage
   - Error handling

### ✅ Updated Components
- **Login Component** - Connected to AuthService with real auth flow
- **App Routes** - Protected with AuthGuard
- **App Config** - Auth interceptor configured

### ✅ File Structure
```
src/app/
├── core/
│   └── auth/
│       ├── auth.service.ts         ✅ NEW
│       ├── auth.guard.ts           ✅ NEW
│       ├── auth.interceptor.ts     ✅ NEW
│   └── logger/
│       └── logger.service.ts       ✅ NEW
│   └── storage/
│       └── storage.service.ts      ✅ NEW
└── features/
    └── auth/
        └── components/
            └── login/
                └── login.component.ts  ✅ UPDATED
```

---

## 🚀 How to Run

### Step 1: Install Dependencies (2-3 minutes)

```bash
cd d:/my_projects/zcc/apps/admin
npm install
```

**What this does:**
- Downloads all Angular and dependencies
- Sets up TypeScript compilation
- Installs dev tools (ESLint, Prettier)
- Creates node_modules folder

### Step 2: Start Development Server (1 minute)

```bash
npm run dev
```

**Expected output:**
```
✔ Browser application bundle generation complete.

Initial Chunk Files | Names         |      Size
vendor.js           | vendor        | 2.41 MB |
main.js             | main          | 245 kB  |
...

✔ Application bundle generation complete.

Application bundle generation by Vite in 12.45s.

✔ Compiled successfully.

The application will be available at:

http://localhost:4200
```

### Step 3: Open Dashboard

Open browser to: **http://localhost:4200**

### Step 4: Test Authentication

**Demo Credentials:**
- Email: `admin@zellavora.com`
- Password: `password123`

**What happens:**
1. Login form validates input
2. Sends request to `/api/v1/auth/login`
3. Backend returns JWT tokens
4. Tokens stored in localStorage
5. AuthService manages automatic refresh
6. Redirects to dashboard
7. All routes protected by AuthGuard

---

## 🔄 Current Authentication Flow

```
User Input (Login Form)
    ↓
AuthService.login(credentials)
    ↓
HTTP POST to /api/v1/auth/login
    ↓
Response with JWT + Refresh Token
    ↓
Update AuthService state (signals)
    ↓
Store tokens in localStorage
    ↓
Schedule automatic token refresh
    ↓
Redirect to /dashboard
    ↓
AuthGuard allows access to protected routes
```

---

## 🔑 Key Features Implemented

### ✅ Signals-Based State
```typescript
// AuthService exposes computed signals
auth.user()                // Get current user
auth.isAuthenticated()     // Check if logged in
auth.isLoading()           // Show loading spinner
auth.error()               // Display error messages
auth.token()               // Get JWT token
```

### ✅ Automatic Token Refresh
- Refreshes 1 minute before expiry
- Handles 401 responses
- Retries failed requests with new token
- Auto-logout on refresh failure

### ✅ Error Handling
- Validates email format
- Validates password length
- Handles backend errors
- User-friendly error messages
- Rate limiting (429 responses)
- Server errors (500+)

### ✅ Route Protection
```typescript
// All these routes are protected
/dashboard
/portfolio
/projects
/blog
/media
/analytics
/users
/settings

// Unprotected auth routes
/auth/login
/auth/register
/auth/forgot-password
```

---

## 🧪 Testing the Auth Flow

### 1. Login Test
1. Go to http://localhost:4200/auth/login
2. Enter demo credentials
3. Click "Sign In"
4. Should redirect to dashboard
5. Check browser DevTools → Application → localStorage
6. Should see: `zcc_access_token`, `zcc_refresh_token`, `zcc_user`

### 2. Protected Route Test
1. Try to access http://localhost:4200/dashboard directly
2. If not logged in, redirects to /auth/login
3. After login, can access all protected routes

### 3. Token Refresh Test
1. Login successfully
2. Wait ~14 minutes (or modify token expiry for testing)
3. Watch Network tab in DevTools
4. Token automatically refreshes before expiry
5. No manual re-login needed

### 4. Error Handling Test
1. Try invalid email: `test` (not email format)
2. Try short password: `pass` (less than 6 chars)
3. Try non-existent user: `fake@example.com`
4. Errors display in red box above form

---

## 📊 Auth Service Signals Reference

```typescript
// Get computed signals
auth.user()                    // User | null
auth.isAuthenticated()         // boolean
auth.isLoading()               // boolean
auth.error()                   // string | null
auth.token()                   // string | null
auth.expiresAt()               // Date | null

// Methods
auth.login(credentials)        // Observable<LoginResponse>
auth.logout()                  // Observable<void>
auth.register(data)            // Observable<LoginResponse>
auth.refreshToken()            // Observable<LoginResponse>
auth.forgotPassword(email)     // Observable<void>
auth.resetPassword(token, pwd) // Observable<void>
auth.hasRole(role)             // boolean
auth.hasPermission(perm)       // boolean
auth.getCurrentUser()          // User | null
```

---

## 🔍 Debugging

### Enable Debug Logging
Edit `src/environments/environment.ts`:
```typescript
logLevel: 'debug'  // Shows all debug messages
```

### Watch Network Requests
1. Open DevTools (F12)
2. Go to Network tab
3. Login and watch requests:
   - POST `/api/v1/auth/login`
   - POST `/api/v1/auth/refresh-token` (auto-refresh)

### Check Storage
1. DevTools → Application → Storage → LocalStorage
2. Should see:
   - `zcc_access_token` - JWT token
   - `zcc_refresh_token` - Refresh token
   - `zcc_user` - User object (JSON)

### Console Logging
AuthService logs to console:
- `[INFO]` - Login success, logout, token refresh
- `[ERROR]` - Auth errors
- `[DEBUG]` - Token expiry checks

---

## ⚙️ Configuration

### JWT Expiry
Currently hardcoded to 15 minutes. To change:

**Backend (set in API response):**
```json
{
  "expiresIn": 900  // seconds (15 minutes)
}
```

**Auto-refresh timing:**
Edit `src/app/core/auth/auth.service.ts`:
```typescript
const refreshBeforeExpiry = 60000;  // 1 minute before expiry
```

### Token Endpoints
Auth service calls:
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/refresh-token` - Token refresh
- `POST /api/v1/auth/logout` - Logout
- `POST /api/v1/auth/forgot-password` - Request reset
- `POST /api/v1/auth/reset-password` - Reset password

---

## 🚨 Common Issues & Solutions

### Issue: "Cannot find module @angular/core"
**Solution:** Dependency errors are normal before `npm install`
```bash
npm install
```

### Issue: CORS error when logging in
**Solution:** Backend needs CORS headers
```
Access-Control-Allow-Origin: http://localhost:4200
Access-Control-Allow-Credentials: true
```

### Issue: Login works but tokens not saving
**Solution:** Check if localStorage is available
- Open DevTools
- Console tab
- Type: `localStorage.getItem('zcc_access_token')`
- Should return token string

### Issue: Auto-logout when navigating
**Solution:** Check token expiry
- DevTools → Application → LocalStorage
- Check if `zcc_access_token` exists
- Check console for 401 errors

### Issue: "Too many login attempts"
**Solution:** Rate limiting activated (429 status)
- Backend rejected request
- Wait 15 minutes before retrying
- Or reset mock data

---

## 📚 Next Steps (Phase 3)

After confirming auth works:

1. **Add User Registration**
   - Create register.component.ts
   - Connect to auth.register()

2. **Add Password Reset**
   - Create forgot-password component
   - Connect to auth.forgotPassword()

3. **Add User Profile**
   - Display current user info
   - Allow profile updates

4. **Add Logout**
   - Add logout button to navbar
   - Connect to auth.logout()

5. **Build Navbar**
   - Show logged-in user
   - Add navigation links
   - Add logout button
   - Add theme toggle

---

## 📋 Checklist Before Moving to Phase 3

- [ ] Run `npm install` successfully
- [ ] Run `npm run dev` successfully
- [ ] Dashboard opens at http://localhost:4200
- [ ] Login page shows
- [ ] Can login with demo credentials
- [ ] Redirects to dashboard
- [ ] Tokens saved in localStorage
- [ ] Protected routes blocked without auth
- [ ] Console shows no errors
- [ ] Dark/light mode works
- [ ] Mobile responsive

---

## 💡 Architecture Highlights

### Signals Pattern
```typescript
// Traditional approach
isLoading = false;
onLogin() { this.isLoading = true; }

// Signals approach (what we use)
private loading = signal(false);
isLoading = computed(() => this.loading());
onLogin() { this.loading.set(true); }
// Automatically updates UI, no change detection needed
```

### Repository/Service Pattern
```typescript
// AuthService handles all auth logic
// Components just call methods and read signals
// Easy to test, easy to change backend
this.auth.login(credentials).subscribe(/* ... */);
```

### Type Safety
```typescript
// All requests and responses are typed
login(request: LoginRequest): Observable<LoginResponse>

// No guessing what's in response
const user: User = response.user;  // ✅ Type-safe
```

---

## 🎯 Success Criteria

✅ Dependencies installed  
✅ Dev server runs  
✅ Dashboard accessible  
✅ Login form shows  
✅ Can login with credentials  
✅ Redirects to dashboard  
✅ Protected routes work  
✅ Tokens persist  
✅ No console errors  

---

**Ready to run? Execute these commands:**

```bash
cd d:/my_projects/zcc/apps/admin
npm install
npm run dev
```

**Then open:** http://localhost:4200

---

Built with ❤️ by Zellavora
