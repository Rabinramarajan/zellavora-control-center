import { Router, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getOrAddUserSerial, getUserUuidFromSerial, wrapResponse, mockBranches } from './admin-helpers';

const router = Router();

/**
 * @swagger
 * /api/v1/admin/user/search:
 *   post:
 *     summary: Search users
 *     tags: [UserSearch]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Search results
 * /api/v1/admin/user/initialize:
 *   get:
 *     summary: Initialize user data
 *     tags: [UserDetail]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Initial state
 * /api/v1/admin/user/new:
 *   get:
 *     summary: Get template for new user
 *     tags: [UserDetail]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: New user template
 * /api/v1/admin/user/open:
 *   post:
 *     summary: Load user details by Serial ID
 *     tags: [UserDetail]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Loaded user profile
 * /api/v1/admin/user/save:
 *   post:
 *     summary: Save user details
 *     tags: [UserDetail]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Saved user profile
 * /api/v1/admin/user/role/get:
 *   get:
 *     summary: Get roles assignable to user
 *     tags: [UserRequest]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Available roles
 * /api/v1/admin/user/team/user/get:
 *   post:
 *     summary: Get team users
 *     tags: [UserRequest]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Team users list
 * /api/v1/admin/user/LoadBranchDDLByUserLoginId:
 *   post:
 *     summary: Load branch dropdown details
 *     tags: [UserRequest]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Branches dropdown
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
    res.json(wrapResponse({
      pageSize: 10,
      pageNumber: 1,
      ascending: true
    }));
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
        emailId: user.email,
        contactNumber: '+1 555-0100',
        employeeCode: `EMP-${1000 + serial}`,
        statusDescription: user.is_active ? 'Active' : 'Inactive',
        beginDateFrom: user.created_at,
        endDateFrom: null
      };
    });

    res.json(wrapResponse({
      searchResult,
      totalCount: searchResult.length,
      pageSize: req.body.pageSize || 10,
      pageNumber: req.body.pageNumber || 1
    }));
  } catch (error) {
    next(error);
  }
});

router.get('/user/new', authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse({
      userSerialId: 0,
      userLoginId: '',
      firstName: '',
      lastName: '',
      emailId: '',
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
      teamValue: 'General'
    }));
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

    res.json(wrapResponse({
      userSerialId: serial,
      userLoginId: user.email,
      firstName: user.full_name.split(' ')[0] || '',
      lastName: user.full_name.split(' ').slice(1).join(' ') || '',
      emailId: user.email,
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
      fullname: user.full_name
    }));
  } catch (error) {
    next(error);
  }
});

router.post('/user/save', authenticate, async (req, res, next) => {
  try {
    const uData = req.body;
    const fullName = `${uData.firstName} ${uData.lastName}`.trim();
    const isActive = uData.statusValue === 'Active' || uData.statusId === 1;

    let user;
    if (uData.userSerialId > 0) {
      // Update
      const uuid = getUserUuidFromSerial(uData.userSerialId);
      const { data, error } = await supabase
        .from('users')
        .update({
          full_name: fullName,
          email: uData.emailId,
          is_active: isActive
        })
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
          full_name: fullName,
          email: uData.emailId,
          role: 'viewer',
          is_active: isActive
        })
        .select()
        .single();
      if (error) throw error;
      user = data;
    }

    const serial = getOrAddUserSerial(user.id);
    res.json(wrapResponse({
      ...uData,
      userSerialId: serial,
      fullname: user.full_name
    }));
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
