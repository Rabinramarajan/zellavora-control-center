# ⚡ Quick Start - Run in 3 Steps

## Step 1️⃣: Install Dependencies (2-3 minutes)

```bash
cd d:/my_projects/zcc/apps/admin
npm install
```

Wait for installation to complete. You'll see lots of output - this is normal.

## Step 2️⃣: Start Development Server (1 minute)

```bash
npm run dev
```

You should see:
```
✔ Compiled successfully.

The application will be available at:

  → http://localhost:4200
```

## Step 3️⃣: Open & Login

1. Open browser: **http://localhost:4200**
2. You'll see the login page
3. Enter credentials:
   - Email: `admin@zellavora.com`
   - Password: `password123`
4. Click "Sign In"
5. You'll be redirected to the dashboard! ✅

---

## 🎯 What You'll See

### Login Page
- Beautiful login form
- Email and password fields
- Demo credentials shown
- Dark/light mode toggle
- Error messages if login fails

### Dashboard (After Login)
- Welcome message
- 4 stat cards (Projects, Blog Posts, Media, Visitors)
- 6 quick access tiles (Portfolio, Projects, Blog, Media, Analytics, Settings)
- Getting started guide
- All fully responsive

---

## 🛑 If You Get Stuck

### Error: "npm: command not found"
**Fix:** Node.js not installed. Download from https://nodejs.org (v18+)

### Error: "Cannot find module..."
**Fix:** Dependencies not installed yet
```bash
npm install
```

### Error: "Port 4200 already in use"
**Fix:** Kill process on port 4200 or use different port
```bash
npm run dev -- --port 4201
```

### Application doesn't load
1. Check browser console (F12)
2. Refresh page (Ctrl+R)
3. Clear cache (Ctrl+Shift+Delete)
4. Check npm install completed successfully

---

## 📖 Read More

- **[PHASE2_SETUP.md](./PHASE2_SETUP.md)** - Detailed auth setup & architecture
- **[README.md](./README.md)** - Project overview
- **[apps/admin/README.md](./apps/admin/README.md)** - Admin dashboard guide
- **[BUILD_SUMMARY.md](./BUILD_SUMMARY.md)** - What was built

---

## ✨ What's Working Right Now

✅ Login form with validation  
✅ Authentication system  
✅ Dashboard with stats  
✅ Dark/light mode  
✅ Mobile responsive  
✅ Protected routes  
✅ Automatic token refresh  
✅ Error handling  

---

## 🚀 Next After Login

1. **Explore Dashboard**
   - Click on each menu item
   - Try dark mode toggle
   - Test on mobile

2. **Try Features**
   - Go to Portfolio section
   - Go to Projects section
   - Explore Blog

3. **Test Logout**
   - (Logout button coming in Phase 3)

4. **Check Developer Tools**
   - Press F12
   - Go to Application → LocalStorage
   - See JWT tokens stored

---

## 📞 Command Reference

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Lint code
npm run lint

# Format code
npm run format
```

---

## 🎉 You're Ready!

Execute these commands:

```bash
cd d:/my_projects/zcc/apps/admin
npm install
npm run dev
```

Then go to: **http://localhost:4200**

Login with demo credentials and explore! 🚀

---

**Questions?** See [PHASE2_SETUP.md](./PHASE2_SETUP.md)
