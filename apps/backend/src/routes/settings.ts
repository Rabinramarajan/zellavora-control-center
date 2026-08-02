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
    maintenanceMode: false,
  },
  profile: {
    fullName: 'Rabin R',
    email: 'rabin@zellavora.com',
    bio: 'Frontend Angular Consultant with 4+ years of experience building scalable, accessible and high-performance web applications.',
    location: 'Chennai, Tamil Nadu, India',
    phone: '+91 8765432109',
  },
  preferences: {
    theme: 'dark',
    emailNotifications: true,
    pushNotifications: true,
    weeklyDigest: true,
    language: 'en',
  },
};

// GET /api/v1/settings or /api/v1/settings/:section
/**
 * @swagger
 * /api/v1/settings:
 *   get:
 *     summary: getSettings
 *     description: Returns all settings sections (general, profile, preferences).
 *     tags: [settings]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All settings sections
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     general:
 *                       type: object
 *                       properties:
 *                         siteTitle:
 *                           type: string
 *                         siteDescription:
 *                           type: string
 *                         timezone:
 *                           type: string
 *                         dateFormat:
 *                           type: string
 *                         itemsPerPage:
 *                           type: integer
 *                         maintenanceMode:
 *                           type: boolean
 *                     profile:
 *                       type: object
 *                       properties:
 *                         fullName:
 *                           type: string
 *                         email:
 *                           type: string
 *                           format: email
 *                         bio:
 *                           type: string
 *                         location:
 *                           type: string
 *                         phone:
 *                           type: string
 *                     preferences:
 *                       type: object
 *                       properties:
 *                         theme:
 *                           type: string
 *                         emailNotifications:
 *                           type: boolean
 *                         pushNotifications:
 *                           type: boolean
 *                         weeklyDigest:
 *                           type: boolean
 *                         language:
 *                           type: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/settings', authenticate, (req, res) => {
  res.json({ data: store });
});

/**
 * @swagger
 * /api/v1/settings/{section}:
 *   get:
 *     summary: getSettingsSection
 *     description: Returns a single settings section by name.
 *     tags: [settings]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: section
 *         required: true
 *         schema:
 *           type: string
 *         description: Settings section name (general, profile, preferences)
 *     responses:
 *       200:
 *         description: Settings section found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/settings/:section', authenticate, (req, res) => {
  const { section } = req.params;
  const data = store[section] || {};
  res.json({ data });
});

// PUT /api/v1/settings/:section
/**
 * @swagger
 * /api/v1/settings/{section}:
 *   put:
 *     summary: updateSettingsSection
 *     description: Merges the request body into the named settings section.
 *     tags: [settings]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: section
 *         required: true
 *         schema:
 *           type: string
 *         description: Settings section name (general, profile, preferences)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Partial settings fields to merge into the section
 *     responses:
 *       200:
 *         description: Updated settings section
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put('/settings/:section', authenticate, (req, res) => {
  const { section } = req.params;
  if (!store[section]) {
    store[section] = {};
  }
  store[section] = { ...store[section], ...req.body };
  res.json({ data: store[section] });
});

export default router;
