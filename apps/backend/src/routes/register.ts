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
        OR: [
          { email: data.admin.email },
          { username: data.credentials.username },
        ],
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
      const tenant = await tx.tenant.create({
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
