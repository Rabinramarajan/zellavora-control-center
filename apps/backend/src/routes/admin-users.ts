import { Router, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
  getOrAddUserSerial,
  getUserUuidFromSerial,
  wrapResponse,
  mockBranches,
} from './admin-helpers';

const router = Router();

/**
 * @swagger
 * /api/v1/admin/user/search:
 *   get:
 *     summary: searchUsers
 *     tags: [userSearch]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     pageSize: { type: integer }
 *                     pageNumber: { type: integer }
 *                     ascending: { type: boolean }
 *                 infoMessage:
 *                   type: object
 *                   properties:
 *                     msgID: { type: integer }
 *                     msgType: { type: string }
 *                     msgDescription: { type: string }
 *                 errorMessage:
 *                   type: array
 *                   items: { type: string }
 *                 hasError:
 *                   type: boolean
 *   post:
 *     summary: searchUsers
 *     tags: [userSearch]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pageSize:
 *                 type: integer
 *                 default: 10
 *               pageNumber:
 *                 type: integer
 *                 default: 1
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     searchResult:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           userSerialId: { type: integer }
 *                           userLoginId: { type: string }
 *                           firstName: { type: string }
 *                           lastName: { type: string }
 *                           emailId: { type: string }
 *                           userName: { type: string }
 *                           contactNumber: { type: string }
 *                           employeeCode: { type: string }
 *                           statusDescription: { type: string }
 *                           beginDateFrom: { type: string, format: date-time }
 *                           endDateFrom: { type: string, format: date-time, nullable: true }
 *                     totalCount: { type: integer }
 *                     pageSize: { type: integer }
 *                     pageNumber: { type: integer }
 *                 infoMessage:
 *                   type: object
 *                   properties:
 *                     msgID: { type: integer }
 *                     msgType: { type: string }
 *                     msgDescription: { type: string }
 *                 errorMessage:
 *                   type: array
 *                   items: { type: string }
 *                 hasError:
 *                   type: boolean
 * /api/v1/admin/user/initialize:
 *   get:
 *     summary: initializeUserData
 *     tags: [userDetail]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Initial state
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     status: { type: string }
 *                 infoMessage:
 *                   type: object
 *                   properties:
 *                     msgID: { type: integer }
 *                     msgType: { type: string }
 *                     msgDescription: { type: string }
 *                 errorMessage:
 *                   type: array
 *                   items: { type: string }
 *                 hasError:
 *                   type: boolean
 * /api/v1/admin/user/new:
 *   get:
 *     summary: getTemplateForNewUser
 *     tags: [userDetail]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: New user template
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     userSerialId: { type: integer }
 *                     userLoginId: { type: string }
 *                     firstName: { type: string }
 *                     lastName: { type: string }
 *                     emailId: { type: string }
 *                     userName: { type: string }
 *                     contactNumber: { type: string }
 *                     genderId: { type: integer }
 *                     genderValue: { type: string }
 *                     beginDate: { type: string, format: date-time }
 *                     endDate: { type: string, format: date-time }
 *                     statusId: { type: integer }
 *                     statusValue: { type: string }
 *                     designationId: { type: integer }
 *                     designationValue: { type: string }
 *                     branchId: { type: integer }
 *                     branchValue: { type: string }
 *                     employeeCode: { type: string }
 *                     departmentId: { type: integer }
 *                     departmentValue: { type: string }
 *                     teamId: { type: integer }
 *                     teamValue: { type: string }
 *                     enableTwoFactorAuthentication: { type: boolean }
 *                     isAccountLocked: { type: boolean }
 *                     successfulLoginAttempts: { type: integer }
 *                     passwordResetFlag: { type: boolean }
 *                     version: { type: integer }
 *                 infoMessage:
 *                   type: object
 *                   properties:
 *                     msgID: { type: integer }
 *                     msgType: { type: string }
 *                     msgDescription: { type: string }
 *                 errorMessage:
 *                   type: array
 *                   items: { type: string }
 *                 hasError:
 *                   type: boolean
 * /api/v1/admin/user/open:
 *   post:
 *     summary: loadUserDetailsBySerialId
 *     tags: [userDetail]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [data]
 *             properties:
 *               data:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: Loaded user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     userSerialId: { type: integer }
 *                     userLoginId: { type: string }
 *                     firstName: { type: string }
 *                     lastName: { type: string }
 *                     emailId: { type: string }
 *                     userName: { type: string }
 *                     contactNumber: { type: string }
 *                     genderId: { type: integer }
 *                     genderValue: { type: string }
 *                     beginDate: { type: string, format: date-time }
 *                     endDate: { type: string, format: date-time }
 *                     statusId: { type: integer }
 *                     statusValue: { type: string }
 *                     designationId: { type: integer }
 *                     designationValue: { type: string }
 *                     branchId: { type: integer }
 *                     branchValue: { type: string }
 *                     employeeCode: { type: string }
 *                     departmentId: { type: integer }
 *                     departmentValue: { type: string }
 *                     teamId: { type: integer }
 *                     teamValue: { type: string }
 *                     fullname: { type: string }
 *                     currentLoginDatetime: { type: string, format: date-time, nullable: true }
 *                     lastLoginDatetime: { type: string, format: date-time, nullable: true }
 *                     defaultLandingPage: { type: string }
 *                     enableTwoFactorAuthentication: { type: boolean }
 *                     isAccountLocked: { type: boolean }
 *                     lastLockedDate: { type: string, format: date-time, nullable: true }
 *                     keyToken: { type: string }
 *                     msg: { type: string }
 *                     otp: { type: string }
 *                     passwordResetFlag: { type: boolean }
 *                     statusDescription: { type: string }
 *                     version: { type: integer }
 *                     successfulLoginAttempts: { type: integer }
 *                 infoMessage:
 *                   type: object
 *                   properties:
 *                     msgID: { type: integer }
 *                     msgType: { type: string }
 *                     msgDescription: { type: string }
 *                 errorMessage:
 *                   type: array
 *                   items: { type: string }
 *                 hasError:
 *                   type: boolean
 *       404:
 *         description: User serial not mapped
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * /api/v1/admin/user/save:
 *   post:
 *     summary: saveUserDetails
 *     tags: [userDetail]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userSerialId, firstName, lastName, emailId, userLoginId]
 *             properties:
 *               userSerialId: { type: integer }
 *               userLoginId: { type: string }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               emailId: { type: string }
 *               userName: { type: string }
 *               contactNumber: { type: string }
 *               genderId: { type: integer }
 *               genderValue: { type: string }
 *               statusId: { type: integer }
 *               statusValue: { type: string }
 *               designationId: { type: integer }
 *               designationValue: { type: string }
 *               branchId: { type: integer }
 *               branchValue: { type: string }
 *               departmentId: { type: integer }
 *               departmentValue: { type: string }
 *               teamId: { type: integer }
 *               teamValue: { type: string }
 *               enableTwoFactorAuthentication: { type: boolean }
 *               isAccountLocked: { type: boolean }
 *               lastLockedDate: { type: string, format: date-time }
 *               currentLoginDatetime: { type: string, format: date-time }
 *               lastLoginDatetime: { type: string, format: date-time }
 *               defaultLandingPage: { type: string }
 *               passwordResetFlag: { type: boolean }
 *               keyToken: { type: string }
 *               statusDescription: { type: string }
 *               version: { type: integer }
 *               msg: { type: string }
 *               otp: { type: string }
 *               successfulLoginAttempts: { type: integer }
 *     responses:
 *       200:
 *         description: Saved user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     userSerialId: { type: integer }
 *                     userLoginId: { type: string }
 *                     firstName: { type: string }
 *                     lastName: { type: string }
 *                     emailId: { type: string }
 *                     fullname: { type: string }
 *                 infoMessage:
 *                   type: object
 *                   properties:
 *                     msgID: { type: integer }
 *                     msgType: { type: string }
 *                     msgDescription: { type: string }
 *                 errorMessage:
 *                   type: array
 *                   items: { type: string }
 *                 hasError:
 *                   type: boolean
 * /api/v1/admin/user/role/get:
 *   get:
 *     summary: getRolesAssignableToUser
 *     tags: [userRequest]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Available roles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 infoMessage:
 *                   type: object
 *                   properties:
 *                     msgID: { type: integer }
 *                     msgType: { type: string }
 *                     msgDescription: { type: string }
 *                 errorMessage:
 *                   type: array
 *                   items: { type: string }
 *                 hasError:
 *                   type: boolean
 * /api/v1/admin/user/team/user/get:
 *   post:
 *     summary: getTeamUsers
 *     tags: [userRequest]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Team users list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 infoMessage:
 *                   type: object
 *                   properties:
 *                     msgID: { type: integer }
 *                     msgType: { type: string }
 *                     msgDescription: { type: string }
 *                 errorMessage:
 *                   type: array
 *                   items: { type: string }
 *                 hasError:
 *                   type: boolean
 * /api/v1/admin/user/LoadBranchDDLByUserLoginId:
 *   post:
 *     summary: loadBranchDropdownDetails
 *     tags: [userRequest]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Branches dropdown
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       admBranchId: { type: integer }
 *                       actCompanyId: { type: integer }
 *                       admLocationId: { type: integer }
 *                       admRegionId: { type: integer }
 *                       branchName: { type: string }
 *                       effectiveDate: { type: string, format: date-time }
 *                       statusId: { type: integer }
 *                       statusValue: { type: string }
 *                       branchCode: { type: string }
 *                 infoMessage:
 *                   type: object
 *                   properties:
 *                     msgID: { type: integer }
 *                     msgType: { type: string }
 *                     msgDescription: { type: string }
 *                 errorMessage:
 *                   type: array
 *                   items: { type: string }
 *                 hasError:
 *                   type: boolean
 */

router.get('/user/initialize', authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse({ status: 'initialized' }));
  } catch (error) {
    next(error);
  }
});

router.get('/user/search', authenticate, async (req, res, next) => {
  try {
    res.json(
      wrapResponse({
        pageSize: 10,
        pageNumber: 1,
        ascending: true,
      })
    );
  } catch (error) {
    next(error);
  }
});

router.post('/user/search', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { data: dbUsers, error } = await supabase.from('users').select('*');
    if (error) throw error;

    const searchResult = (dbUsers || []).map((user: any) => {
      const serial = getOrAddUserSerial(user.id);
      return {
        userSerialId: serial,
        userLoginId: user.email,
        firstName: user.full_name.split(' ')[0] || '',
        lastName: user.full_name.split(' ').slice(1).join(' ') || '',
        emailId: user.email_id || user.email,
        userName: user.username,
        contactNumber: '+1 555-0100',
        employeeCode: `EMP-${1000 + serial}`,
        statusDescription: user.is_active ? 'Active' : 'Inactive',
        beginDateFrom: user.created_at,
        endDateFrom: null,
      };
    });

    res.json(
      wrapResponse({
        searchResult,
        totalCount: searchResult.length,
        pageSize: req.body.pageSize || 10,
        pageNumber: req.body.pageNumber || 1,
      })
    );
  } catch (error) {
    next(error);
  }
});

router.get('/user/new', authenticate, async (req, res, next) => {
  try {
    res.json(
      wrapResponse({
        userSerialId: 0,
        userLoginId: '',
        firstName: '',
        lastName: '',
        emailId: '',
        userName: '',
        contactNumber: '',
        genderId: 1,
        genderValue: 'Male',
        beginDate: new Date().toISOString(),
        endDate: '2099-12-31T23:59:59Z',
        statusId: 1,
        statusValue: 'Active',
        designationId: 1,
        designationValue: 'Viewer',
        branchId: 1,
        branchValue: 'Headquarters',
        employeeCode: '',
        departmentId: 1,
        departmentValue: 'Staff',
        teamId: 1,
        teamValue: 'General',
        enableTwoFactorAuthentication: false,
        isAccountLocked: false,
        successfulLoginAttempts: 0,
        passwordResetFlag: false,
        version: 1,
      })
    );
  } catch (error) {
    next(error);
  }
});

router.post('/user/open', authenticate, async (req, res, next) => {
  try {
    const serial = req.body.data;
    const uuid = getUserUuidFromSerial(serial);
    if (!uuid) {
      return res.status(404).json({ error: 'User serial not mapped' });
    }

    const { data: user, error } = await supabase.from('users').select('*').eq('id', uuid).single();
    if (error) throw error;

    res.json(
      wrapResponse({
        userSerialId: serial,
        userLoginId: user.email,
        firstName: user.full_name.split(' ')[0] || '',
        lastName: user.full_name.split(' ').slice(1).join(' ') || '',
        emailId: user.email_id || user.email,
        userName: user.username,
        contactNumber: '+1 555-0100',
        genderId: 1,
        genderValue: 'Male',
        beginDate: user.created_at,
        endDate: '2099-12-31T23:59:59Z',
        statusId: user.is_active ? 1 : 2,
        statusValue: user.is_active ? 'Active' : 'Inactive',
        designationId: 1,
        designationValue: 'Viewer',
        branchId: 1,
        branchValue: 'Headquarters',
        employeeCode: `EMP-${1000 + serial}`,
        departmentId: 1,
        departmentValue: 'Staff',
        teamId: 1,
        teamValue: 'General',
        fullname: user.full_name,

        // Mapped Login/Auth fields
        currentLoginDatetime: user.current_login_datetime,
        lastLoginDatetime: user.last_login_datetime,
        defaultLandingPage: user.default_landing_page,
        enableTwoFactorAuthentication: user.enable_two_factor_authentication,
        isAccountLocked: user.is_account_locked,
        lastLockedDate: user.last_locked_date,
        keyToken: user.key_token,
        msg: user.msg,
        otp: user.otp,
        passwordResetFlag: user.password_reset_flag,
        statusDescription: user.status_description,
        version: user.version,
        successfulLoginAttempts: user.successful_login_attempts,
      })
    );
  } catch (error) {
    next(error);
  }
});

router.post('/user/save', authenticate, async (req, res, next) => {
  try {
    const uData = req.body;
    const fullName = `${uData.firstName} ${uData.lastName}`.trim();
    const isActive = uData.statusValue === 'Active' || uData.statusId === 1;

    const dbPayload = {
      full_name: fullName,
      email: uData.emailId || uData.userLoginId,
      email_id: uData.emailId,
      is_active: isActive,
      enable_two_factor_authentication: uData.enableTwoFactorAuthentication,
      is_account_locked: uData.isAccountLocked,
      last_locked_date: uData.lastLockedDate,
      current_login_datetime: uData.currentLoginDatetime,
      last_login_datetime: uData.lastLoginDatetime,
      default_landing_page: uData.defaultLandingPage,
      password_reset_flag: uData.passwordResetFlag,
      key_token: uData.keyToken,
      status_value: uData.statusValue,
      status_description: uData.statusDescription,
      version: uData.version,
      msg: uData.msg,
      otp: uData.otp,
      successful_login_attempts: uData.successfulLoginAttempts,
    };

    let user;
    if (uData.userSerialId > 0) {
      // Update
      const uuid = getUserUuidFromSerial(uData.userSerialId);
      const { data, error } = await supabase
        .from('users')
        .update(dbPayload)
        .eq('id', uuid)
        .select()
        .single();
      if (error) throw error;
      user = data;
    } else {
      // Insert
      const { data, error } = await supabase
        .from('users')
        .insert({
          ...dbPayload,
          role: 'viewer',
        })
        .select()
        .single();
      if (error) throw error;
      user = data;
    }

    const serial = getOrAddUserSerial(user.id);
    res.json(
      wrapResponse({
        ...uData,
        userSerialId: serial,
        fullname: user.full_name,
      })
    );
  } catch (error) {
    next(error);
  }
});

router.get('/user/role/get', authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse([]));
  } catch (error) {
    next(error);
  }
});

router.post('/user/team/user/get', authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse([]));
  } catch (error) {
    next(error);
  }
});

router.post('/user/LoadBranchDDLByUserLoginId', authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse(mockBranches));
  } catch (error) {
    next(error);
  }
});

export default router;
