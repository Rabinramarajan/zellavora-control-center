import { Router, type Response, type NextFunction } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth';
import { prisma } from '../infrastructure/prisma';

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
 *     operationId: getSettings
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
// Profile belongs to the signed-in user, so it is read from and written to their user record.
const profileSelect = {
  fullName: true,
  email: true,
  bio: true,
  country: true,
  mobile: true,
} as const;

type ProfileRow = {
  fullName: string;
  email: string;
  bio: string | null;
  country: string | null;
  mobile: string | null;
};

const toProfile = (user: ProfileRow) => ({
  fullName: user.fullName,
  email: user.email,
  bio: user.bio ?? '',
  location: user.country ?? '',
  phone: user.mobile ?? '',
});

const loadProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: profileSelect });
  return user ? toProfile(user) : {};
};

const optionalText = (value: unknown): string | null | undefined =>
  value === undefined ? undefined : typeof value === 'string' && value.trim() ? value.trim() : null;

router.get(
  '/settings',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      res.json({ data: { ...store, profile: await loadProfile(req.userId!) } });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * @swagger
 * /api/v1/settings/{section}:
 *   get:
 *     summary: getSettingsSection
 *     operationId: getSettingsBySection
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
router.get(
  '/settings/:section',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { section } = req.params;
      const data = section === 'profile' ? await loadProfile(req.userId!) : store[section] || {};
      res.json({ data });
    } catch (e) {
      next(e);
    }
  }
);

// PUT /api/v1/settings/:section
/**
 * @swagger
 * /api/v1/settings/{section}:
 *   put:
 *     summary: updateSettingsSection
 *     operationId: putSettingsBySection
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
router.put(
  '/settings/:section',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { section } = req.params;
    if (section === 'profile') {
      try {
        const body = req.body as Record<string, unknown>;
        const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : undefined;
        // Email is the login identity; it is changed through the account flow, not here.
        const user = await prisma.user.update({
          where: { id: req.userId! },
          data: {
            ...(fullName ? { fullName } : {}),
            bio: optionalText(body.bio),
            country: optionalText(body.location),
            mobile: optionalText(body.phone),
          },
          select: profileSelect,
        });
        res.json({ data: toProfile(user) });
      } catch (e) {
        next(e);
      }
      return;
    }
    if (!store[section]) {
      store[section] = {};
    }
    store[section] = { ...store[section], ...req.body };
    res.json({ data: store[section] });
  }
);

export default router;
