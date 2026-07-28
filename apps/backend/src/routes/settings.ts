import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { wrapResponse } from './admin-helpers';

const router = Router();

// Store settings in-memory
const store: Record<string, any> = {
  general: {
    siteTitle: 'Zellavora Control Center',
    siteDescription: 'Centralized platform to manage portfolio, projects, content, and analytics.',
    timezone: 'GMT+5:30 Asia/Kolkata',
    dateFormat: 'MMM DD, YYYY',
    itemsPerPage: 10,
    maintenanceMode: false
  },
  profile: {
    fullName: 'Rabin R',
    email: 'rabin@zellavora.com',
    bio: 'Frontend Angular Consultant with 4+ years of experience building scalable, accessible and high-performance web applications.',
    location: 'Chennai, Tamil Nadu, India',
    phone: '+91 8765432109'
  },
  preferences: {
    theme: 'dark',
    emailNotifications: true,
    pushNotifications: true,
    weeklyDigest: true,
    language: 'en'
  }
};

// GET /api/v1/settings or /api/v1/settings/:section
router.get('/settings', authenticate, (req, res) => {
  res.json({ data: store });
});

router.get('/settings/:section', authenticate, (req, res) => {
  const { section } = req.params;
  const data = store[section] || {};
  res.json({ data });
});

// PUT /api/v1/settings/:section
router.put('/settings/:section', authenticate, (req, res) => {
  const { section } = req.params;
  if (!store[section]) {
    store[section] = {};
  }
  store[section] = { ...store[section], ...req.body };
  res.json({ data: store[section] });
});

export default router;
