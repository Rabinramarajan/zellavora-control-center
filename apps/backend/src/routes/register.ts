import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../infrastructure/prisma';
import { logger } from '../infrastructure/logger';
import { PasswordService } from '../services/auth/password.service';
import { addQueueJob } from '../infrastructure/queue';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';

const router = Router();

// Zod schemas for request validation
const VerifyInvitationSchema = z.object({
  code: z.string().min(1, 'Invitation code is required'),
});

const SendOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const VerifyOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().length(6, 'OTP must be exactly 6 characters'),
});

const RegisterSubmitSchema = z.object({
  invitationCode: z.string(),
  company: z.object({
    name: z.string().min(2, 'Company name is required'),
    clientCode: z.string().min(2).max(16),
    logoUrl: z.string().nullable().optional(),
    industry: z.string().optional(),
    employees: z.string().optional(),
  }),
  branch: z.object({
    name: z.string().min(2, 'Branch name is required'),
    code: z.string().optional(),
  }),
  admin: z.object({
    fullName: z.string().min(2),
    email: z.string().email(),
    designation: z.string().optional(),
  }),
  credentials: z.object({
    username: z.string().min(4),
    password: z.string(),
  }),
  mfaSecret: z.string(),
  mfaCode: z.string(),
});

// Endpoints
/**
 * @swagger
 * /api/v1/auth/register/verify-invitation:
 *   post:
 *     summary: verifyInvitationCode
 *     description: Validates a registration invitation code.
 *     tags: [auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Invitation code is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 email:
 *                   type: string
 *                   format: email
 *       400:
 *         description: Invalid or already used invitation code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/verify-invitation', async (req, res, next) => {
  try {
    const { code } = VerifyInvitationSchema.parse(req.body);
    const invite = await prisma.invitation.findFirst({
      where: { code, used: false },
    });

    if (!invite) {
      return res.status(400).json({ error: 'Invalid or already used invitation code.' });
    }

    res.json({ success: true, email: invite.email });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/v1/auth/register/send-email-otp:
 *   post:
 *     summary: sendRegistrationEmailOtp
 *     description: Generates a 6-digit OTP for the given email and queues it for delivery.
 *     tags: [auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: OTP generated and queued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Invalid email address
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/send-email-otp', async (req, res, next) => {
  try {
    const { email } = SendOtpSchema.parse(req.body);

    // Generate 6 digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await prisma.otp.create({
      data: {
        type: 'email',
        target: email,
        code,
        expiresAt,
      },
    });

    // Queue background job
    await addQueueJob('send-otp', { email, otp: code });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/v1/auth/register/verify-email-otp:
 *   post:
 *     summary: verifyRegistrationEmailOtp
 *     description: Verifies a 6-digit OTP previously sent to the given email.
 *     tags: [auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               code:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *     responses:
 *       200:
 *         description: OTP verified
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Invalid or expired verification code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/verify-email-otp', async (req, res, next) => {
  try {
    const { email, code } = VerifyOtpSchema.parse(req.body);

    const otp = await prisma.otp.findFirst({
      where: {
        type: 'email',
        target: email,
        code,
        verified: false,
        expiresAt: { gte: new Date() },
      },
    });

    if (!otp) {
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    await prisma.otp.update({
      where: { id: otp.id },
      data: { verified: true },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/v1/auth/register/mfa-setup:
 *   get:
 *     summary: generateMfaSetup
 *     description: Generates a TOTP secret and QR code for MFA enrollment.
 *     tags: [auth]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: email
 *         required: false
 *         schema:
 *           type: string
 *           format: email
 *         description: Account email embedded in the otpauth URI (defaults to admin@zellavora.com)
 *     responses:
 *       200:
 *         description: MFA secret and QR code
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 secret:
 *                   type: string
 *                 qrCodeDataUrl:
 *                   type: string
 *                   format: data-url
 */
router.get('/mfa-setup', async (req, res, next) => {
  try {
    const email = (req.query.email as string) || 'admin@zellavora.com';
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(email, 'ZELLAVORA', secret);
    const qrCodeDataUrl = await qrcode.toDataURL(otpauth);

    res.json({ secret, qrCodeDataUrl });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/v1/auth/register/submit:
 *   post:
 *     summary: submitRegistration
 *     description: Completes tenant, branch, and super-admin registration. Verifies invitation, duplicates, and MFA code before provisioning.
 *     tags: [auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - invitationCode
 *               - company
 *               - branch
 *               - admin
 *               - credentials
 *               - mfaSecret
 *               - mfaCode
 *             properties:
 *               invitationCode:
 *                 type: string
 *               company:
 *                 type: object
 *                 required: [name, clientCode]
 *                 properties:
 *                   name:
 *                     type: string
 *                   clientCode:
 *                     type: string
 *                   logoUrl:
 *                     type: string
 *                     nullable: true
 *                   industry:
 *                     type: string
 *                   employees:
 *                     type: string
 *               branch:
 *                 type: object
 *                 required: [name]
 *                 properties:
 *                   name:
 *                     type: string
 *                   code:
 *                     type: string
 *               admin:
 *                 type: object
 *                 required: [fullName, email]
 *                 properties:
 *                   fullName:
 *                     type: string
 *                   email:
 *                     type: string
 *                     format: email
 *                   designation:
 *                     type: string
 *               credentials:
 *                 type: object
 *                 required: [username, password]
 *                 properties:
 *                   username:
 *                     type: string
 *                   password:
 *                     type: string
 *                     format: password
 *               mfaSecret:
 *                 type: string
 *                 description: TOTP secret returned by the mfa-setup endpoint
 *               mfaCode:
 *                 type: string
 *                 description: Current TOTP code proving possession of the secret
 *     responses:
 *       200:
 *         description: Registration completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Registration completed successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     tenant:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         name:
 *                           type: string
 *                         clientCode:
 *                           type: string
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         email:
 *                           type: string
 *                           format: email
 *                         username:
 *                           type: string
 *                         role:
 *                           type: string
 *       400:
 *         description: Invalid invitation code, duplicate user, or invalid MFA code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Registration failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/submit', async (req, res, next) => {
  try {
    const data = RegisterSubmitSchema.parse(req.body);

    // 1. Verify invitation code
    const invite = await prisma.invitation.findFirst({
      where: { code: data.invitationCode, used: false },
    });
    if (!invite) {
      return res.status(400).json({ error: 'Invalid invitation code.' });
    }

    // 2. Check for username/email duplicates
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.admin.email }, { username: data.credentials.username }],
      },
    });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email or username already exists.' });
    }

    // 3. Verify MFA code
    const mfaValid = authenticator.check(data.mfaCode, data.mfaSecret);
    if (!mfaValid) {
      return res.status(400).json({ error: 'Invalid MFA verification code.' });
    }

    // 4. Hash password
    const passwordHash = await PasswordService.hash(data.credentials.password);

    // 5. Database transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.organization.create({
        data: {
          name: data.company.name,
          clientCode: data.company.clientCode,
          logoUrl: data.company.logoUrl,
          plan: 'enterprise',
          enforce2fa: true,
        },
      });

      // Create user
      const user = await tx.user.create({
        data: {
          email: data.admin.email,
          emailId: data.admin.email,
          username: data.credentials.username,
          fullName: data.admin.fullName,
          passwordHash,
          role: 'superadmin',
          mfaEnabled: true,
          enable2fa: true,
        },
      });

      // Create membership
      await tx.userTenant.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
        },
      });

      // Create profile
      await tx.profile.create({
        data: {
          userId: user.id,
          headline: data.admin.designation || 'Super Administrator',
        },
      });

      // Create primary branch
      const branch = await tx.branch.create({
        data: {
          organizationId: tenant.id,
          name: data.branch.name,
          code: data.branch.code || 'HQ',
        },
      });

      // Mark invitation used
      await tx.invitation.update({
        where: { id: invite.id },
        data: { used: true },
      });

      return { tenant, user, branch };
    });

    // 6. Queue Welcome Email
    await addQueueJob('send-welcome', { email: result.user.email, tenantName: result.tenant.name });

    res.json({
      success: true,
      message: 'Registration completed successfully.',
      data: {
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          clientCode: result.tenant.clientCode,
        },
        user: {
          id: result.user.id,
          email: result.user.email,
          username: result.user.username,
          role: result.user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
