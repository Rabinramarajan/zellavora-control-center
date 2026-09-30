import { Router, type Response } from 'express';
import { authenticate, requirePermission, type AuthRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/async-handler';
import { orgContextOf } from '../../middleware/org-context';
import { SecurityPolicyService } from './security-policy.service';
import {
  LoginPolicySchema,
  MfaComplianceQuerySchema,
  MfaPolicySchema,
  PasswordPolicySchema,
  type LoginPolicy,
  type MfaPolicy,
  type PasswordPolicy,
} from './security-policy.dto';

const router = Router();
const service = new SecurityPolicyService();

/**
 * @swagger
 * tags:
 *   name: iamSecurity
 *   description: Organization password, login/session and MFA policies.
 */

/**
 * @swagger
 * /api/v1/iam/security/policies:
 *   get:
 *     summary: getSecurityPolicies
 *     operationId: getIamSecurityPolicies
 *     description: Effective password, login and MFA policies for the caller's organization.
 *     tags: [iamSecurity]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Policies
 */
router.get(
  '/policies',
  authenticate,
  requirePermission('settings:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = orgContextOf(req);
    res.json({ success: true, data: await service.getAll(organizationId) });
  })
);

/**
 * @swagger
 * /api/v1/iam/security/policies/password:
 *   put:
 *     summary: updatePasswordPolicy
 *     operationId: putIamSecurityPasswordPolicy
 *     tags: [iamSecurity]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [minLength, historyDepth, disallowEmailInPassword]
 *             properties:
 *               minLength: { type: integer, minimum: 12, maximum: 128 }
 *               historyDepth: { type: integer, minimum: 0, maximum: 24 }
 *               disallowEmailInPassword: { type: boolean }
 *     responses:
 *       200:
 *         description: Saved policy
 */
router.put(
  '/policies/password',
  authenticate,
  requirePermission('settings:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, actorId } = orgContextOf(req);
    const dto = PasswordPolicySchema.parse(req.body) as PasswordPolicy;
    res.json({ success: true, data: await service.updatePassword(organizationId, dto, actorId) });
  })
);

/**
 * @swagger
 * /api/v1/iam/security/policies/login:
 *   put:
 *     summary: updateLoginPolicy
 *     operationId: putIamSecurityLoginPolicy
 *     description: Lockout, session lifetime/idle, concurrent session and IP allow-list rules.
 *     tags: [iamSecurity]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Saved policy
 */
router.put(
  '/policies/login',
  authenticate,
  requirePermission('settings:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, actorId } = orgContextOf(req);
    const dto = LoginPolicySchema.parse(req.body) as LoginPolicy;
    res.json({ success: true, data: await service.updateLogin(organizationId, dto, actorId) });
  })
);

/**
 * @swagger
 * /api/v1/iam/security/policies/mfa:
 *   put:
 *     summary: updateMfaPolicy
 *     operationId: putIamSecurityMfaPolicy
 *     description: Require every member to enrol in MFA at next sign-in.
 *     tags: [iamSecurity]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Saved policy
 */
router.put(
  '/policies/mfa',
  authenticate,
  requirePermission('settings:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, actorId } = orgContextOf(req);
    const dto = MfaPolicySchema.parse(req.body) as MfaPolicy;
    res.json({ success: true, data: await service.updateMfa(organizationId, dto, actorId) });
  })
);

/**
 * @swagger
 * /api/v1/iam/security/mfa/compliance:
 *   get:
 *     summary: getMfaCompliance
 *     operationId: getIamSecurityMfaCompliance
 *     description: Enrolment summary and paginated member list.
 *     tags: [iamSecurity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: enrolled
 *         schema: { type: string, enum: ['true', 'false'] }
 *     responses:
 *       200:
 *         description: Compliance report
 */
router.get(
  '/mfa/compliance',
  authenticate,
  requirePermission('settings:manage'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = orgContextOf(req);
    const query = MfaComplianceQuerySchema.parse(req.query);
    res.json({ success: true, data: await service.mfaCompliance(organizationId, query) });
  })
);

export default router;
