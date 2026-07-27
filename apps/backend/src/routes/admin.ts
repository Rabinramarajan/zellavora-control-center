import { Router, Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Enterprise admin operations for user, role, resource, branch, config, and audit logs.
 */

/**
 * @swagger
 * /api/v1/admin/user/search:
 *   post:
 *     summary: Search users
 *     tags: [Admin]
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
 */

/**
 * @swagger
 * /api/v1/admin/role/search:
 *   post:
 *     summary: Search roles
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Search results
 */

/**
 * @swagger
 * /api/v1/admin/resource/search:
 *   post:
 *     summary: Search resources
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Search results
 */

/**
 * @swagger
 * /api/v1/admin/Branch/Branch/Search:
 *   post:
 *     summary: Search branches
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Search results
 */

/**
 * @swagger
 * /api/v1/admin/auditlog/search:
 *   post:
 *     summary: Search audit logs
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Search results
 */

/**
 * @swagger
 * /api/v1/admin/config/search:
 *   post:
 *     summary: Search configs
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Search results
 */

/**
 * @swagger
 * /api/v1/admin/group/search:
 *   post:
 *     summary: Search groups
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Search results
 */

// ==================== IN-MEMORY STORES FOR MOCK DATA ====================
let mockResources = [
  {
    resourceId: 1,
    viewNameId: 1,
    viewNameValue: 'UserManagement',
    resourceName: 'admin:users',
    resourceTypeId: 1,
    resourceTypeValue: 'UI_SCREEN',
    resourceDescription: 'User Management Screen',
    viewNameDescription: 'User Management View',
    resourceTypeDescription: 'Screen Component'
  },
  {
    resourceId: 2,
    viewNameId: 1,
    viewNameValue: 'RoleManagement',
    resourceName: 'admin:roles',
    resourceTypeId: 1,
    resourceTypeValue: 'UI_SCREEN',
    resourceDescription: 'Role Management Screen',
    viewNameDescription: 'Role Management View',
    resourceTypeDescription: 'Screen Component'
  }
];

let mockBranches = [
  {
    admBranchId: 1,
    actCompanyId: 1,
    admLocationId: 1,
    admRegionId: 1,
    branchName: 'Headquarters',
    effectiveDate: '2026-01-01T00:00:00Z',
    statusId: 1,
    statusValue: 'Active',
    branchCode: 'HQ-001'
  },
  {
    admBranchId: 2,
    actCompanyId: 1,
    admLocationId: 1,
    admRegionId: 1,
    branchName: 'New York Branch',
    effectiveDate: '2026-01-01T00:00:00Z',
    statusId: 1,
    statusValue: 'Active',
    branchCode: 'NY-002'
  }
];

let mockConfigs = [
  {
    configSerialId: 1,
    configId: 101,
    configValue: 'Enabled',
    configDescription: 'Enable Multi-Factor Authentication'
  },
  {
    configSerialId: 2,
    configId: 102,
    configValue: '5',
    configDescription: 'Maximum login attempts before lock'
  }
];

let mockGroups = [
  {
    groupId: 1,
    groupName: 'Supervisors',
    beginDate: '2026-01-01T00:00:00Z',
    endDate: '2099-12-31T23:59:59Z',
    statusId: 1,
    statusValue: 'Active',
    statusDescription: 'Active'
  }
];

let mockAuditLogs = [
  {
    auditLogId: 1,
    tableName: 'users',
    primaryKey: 1,
    changeModeId: 1,
    changeModeValue: 'UPDATE',
    machineIpAddress: '127.0.0.1',
    changeModeDescription: 'User record updated',
    changedBy: 'admin@zellavora.com',
    changedDate: '2026-07-27T10:00:00Z',
    lstAuditLogDetail: [
      {
        auditLogDetailId: 1,
        auditLogId: 1,
        columnName: 'full_name',
        oldValue: 'Admin',
        newValue: 'Admin User',
        changedBy: 'admin@zellavora.com',
        changedDate: '2026-07-27T10:00:00Z'
      }
    ]
  }
];

// UUID Mapping Helper Maps (to simulate legacy numeric IDs)
const userUuidToSerial = new Map<string, number>();
const userSerialToUuid = new Map<number, string>();
let nextUserSerial = 1;

const roleUuidToSerial = new Map<string, number>();
const roleSerialToUuid = new Map<number, string>();
let nextRoleSerial = 1;

function getOrAddUserSerial(uuid: string): number {
  if (userUuidToSerial.has(uuid)) {
    return userUuidToSerial.get(uuid)!;
  }
  const serial = nextUserSerial++;
  userUuidToSerial.set(uuid, serial);
  userSerialToUuid.set(serial, uuid);
  return serial;
}

function getOrAddRoleSerial(uuid: string): number {
  if (roleUuidToSerial.has(uuid)) {
    return roleUuidToSerial.get(uuid)!;
  }
  const serial = nextRoleSerial++;
  roleUuidToSerial.set(uuid, serial);
  roleSerialToUuid.set(serial, uuid);
  return serial;
}

// Helper wrapper for formatting all responses to match UI expected ApiResponse structure
const wrapResponse = (data: any) => ({
  data,
  infoMessage: { msgID: 0, msgType: 'Info', msgDescription: '' },
  errorMessage: [],
  hasError: false
});

// ==================== USER ROUTES ====================

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

router.post('/user/search', authenticate, async (req, res, next) => {
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
    const uuid = userSerialToUuid.get(serial);
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
      const uuid = userSerialToUuid.get(uData.userSerialId);
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

// ==================== ROLE ROUTES ====================

router.get('/role/initialize', authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse({ status: 'initialized' }));
  } catch (error) {
    next(error);
  }
});

router.get('/role/search', authenticate, async (req, res, next) => {
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

router.post('/role/search', authenticate, async (req, res, next) => {
  try {
    const { data: dbRoles, error } = await supabase.from('roles').select('*');
    if (error) throw error;

    const searchResult = (dbRoles || []).map((role: any) => {
      const serial = getOrAddRoleSerial(role.id);
      return {
        roleId: serial,
        roleName: role.label || role.key,
        moduleDescription: 'Admin',
        beginDate: role.created_at,
        endDate: '2099-12-31T23:59:59Z',
        statusDescription: 'Active'
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

router.get('/role/new', authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse({
      roleId: 0,
      roleName: '',
      statusId: 1,
      statusValue: 'Active',
      beginDate: new Date().toISOString(),
      endDate: '2099-12-31T23:59:59Z',
      moduleId: 1,
      moduleValue: 'Admin',
      statusDescription: 'Active',
      moduleDescription: 'Admin Module'
    }));
  } catch (error) {
    next(error);
  }
});

router.post('/role/open', authenticate, async (req, res, next) => {
  try {
    const serial = req.body.data;
    const uuid = roleSerialToUuid.get(serial);
    if (!uuid) {
      return res.status(404).json({ error: 'Role serial not mapped' });
    }

    const { data: role, error } = await supabase.from('roles').select('*').eq('id', uuid).single();
    if (error) throw error;

    res.json(wrapResponse({
      roleId: serial,
      roleName: role.label || role.key,
      statusId: 1,
      statusValue: 'Active',
      beginDate: role.created_at,
      endDate: '2099-12-31T23:59:59Z',
      moduleId: 1,
      moduleValue: 'Admin',
      statusDescription: 'Active',
      moduleDescription: 'Admin Module'
    }));
  } catch (error) {
    next(error);
  }
});

router.post('/role/save', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const rData = req.body;
    let role;
    if (rData.roleId > 0) {
      // Update
      const uuid = roleSerialToUuid.get(rData.roleId);
      const { data, error } = await supabase
        .from('roles')
        .update({
          label: rData.roleName
        })
        .eq('id', uuid)
        .select()
        .single();
      if (error) throw error;
      role = data;
    } else {
      // Insert
      const { data, error } = await supabase
        .from('roles')
        .insert({
          organization_id: req.tenantId || null,
          key: rData.roleName.toLowerCase().replace(/\s+/g, '_'),
          label: rData.roleName,
          level: 10
        })
        .select()
        .single();
      if (error) throw error;
      role = data;
    }

    const serial = getOrAddRoleSerial(role.id);
    res.json(wrapResponse({
      ...rData,
      roleId: serial
    }));
  } catch (error) {
    next(error);
  }
});

router.post('/role/delete', authenticate, async (req, res, next) => {
  try {
    const serial = req.body.data;
    const uuid = roleSerialToUuid.get(serial);
    if (uuid) {
      const { error } = await supabase.from('roles').delete().eq('id', uuid);
      if (error) throw error;
    }
    res.json(wrapResponse({ roleId: serial }));
  } catch (error) {
    next(error);
  }
});

router.post('/role/role-resource/load', authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse([]));
  } catch (error) {
    next(error);
  }
});

router.post('/role/role-resource/save', authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse({ ok: true }));
  } catch (error) {
    next(error);
  }
});

// ==================== RESOURCE ROUTES ====================

router.get('/resource/initialize', authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse({ status: 'initialized' }));
  } catch (error) {
    next(error);
  }
});

router.get('/resource/search', authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse({}));
  } catch (error) {
    next(error);
  }
});

router.post('/resource/search', authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse({
      searchResult: mockResources,
      totalCount: mockResources.length,
      pageSize: req.body.pageSize || 10,
      pageNumber: req.body.pageNumber || 1
    }));
  } catch (error) {
    next(error);
  }
});

router.get('/resource/new', authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse({
      resourceId: 0,
      viewNameId: 1,
      viewNameValue: 'UserManagement',
      resourceName: '',
      resourceTypeId: 1,
      resourceTypeValue: 'UI_SCREEN',
      resourceDescription: '',
      viewNameDescription: 'User Management View',
      resourceTypeDescription: 'Screen Component'
    }));
  } catch (error) {
    next(error);
  }
});

router.post('/resource/open', authenticate, async (req, res, next) => {
  try {
    const id = req.body.data;
    const resrc = mockResources.find(r => r.resourceId === id);
    res.json(wrapResponse(resrc || mockResources[0]));
  } catch (error) {
    next(error);
  }
});

router.post('/resource/save', authenticate, async (req, res, next) => {
  try {
    const resrc = req.body;
    if (resrc.resourceId > 0) {
      mockResources = mockResources.map(r => r.resourceId === resrc.resourceId ? resrc : r);
    } else {
      resrc.resourceId = mockResources.length + 1;
      mockResources.push(resrc);
    }
    res.json(wrapResponse(resrc));
  } catch (error) {
    next(error);
  }
});

router.post('/resource/delete', authenticate, async (req, res, next) => {
  try {
    const id = req.body.data;
    mockResources = mockResources.filter(r => r.resourceId !== id);
    res.json(wrapResponse({ resourceId: id }));
  } catch (error) {
    next(error);
  }
});

router.post('/resource/SaveListResource', authenticate, async (req, res, next) => {
  try {
    const list = req.body.lstentResource || [];
    list.forEach((resrc: any) => {
      if (resrc.resourceId > 0) {
        mockResources = mockResources.map(r => r.resourceId === resrc.resourceId ? resrc : r);
      } else {
        resrc.resourceId = mockResources.length + 1;
        mockResources.push(resrc);
      }
    });
    res.json(wrapResponse(list));
  } catch (error) {
    next(error);
  }
});

// ==================== BRANCH ROUTES ====================

router.get('/MAsterConfig/Region/GetMaasterConfigInitialData', authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse({ regions: [] }));
  } catch (error) {
    next(error);
  }
});

router.get('/Branch/Branch/new', authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse({
      admBranchId: 0,
      actCompanyId: 1,
      admLocationId: 1,
      admRegionId: 1,
      branchName: '',
      effectiveDate: new Date().toISOString(),
      statusId: 1,
      statusValue: 'Active',
      branchCode: ''
    }));
  } catch (error) {
    next(error);
  }
});

router.get('/Branch/Branch/search', authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse({}));
  } catch (error) {
    next(error);
  }
});

router.post('/Branch/Branch/Search', authenticate, async (req, res, next) => {
  try {
    const searchResultSet = mockBranches.map(b => ({
      admBranchId: String(b.admBranchId),
      branchName: b.branchName,
      effectiveDate: b.effectiveDate,
      statusDescription: b.statusValue
    }));
    res.json(wrapResponse({
      searchResultSet,
      totalCount: searchResultSet.length,
      pageSize: req.body.pageSize || 10,
      pageNumber: req.body.pageNumber || 1
    }));
  } catch (error) {
    next(error);
  }
});

router.post('/Branch/Branch/open', authenticate, async (req, res, next) => {
  try {
    const id = req.body.data;
    const branch = mockBranches.find(b => b.admBranchId === id);
    res.json(wrapResponse(branch || mockBranches[0]));
  } catch (error) {
    next(error);
  }
});

router.post('/Branch/Branch/save', authenticate, async (req, res, next) => {
  try {
    const branch = req.body;
    if (branch.admBranchId > 0) {
      mockBranches = mockBranches.map(b => b.admBranchId === branch.admBranchId ? branch : b);
    } else {
      branch.admBranchId = mockBranches.length + 1;
      mockBranches.push(branch);
    }
    res.json(wrapResponse(branch));
  } catch (error) {
    next(error);
  }
});

router.post('/Branch/Branch/delete', authenticate, async (req, res, next) => {
  try {
    const id = req.body.admBranchId;
    mockBranches = mockBranches.filter(b => b.admBranchId !== id);
    res.json(wrapResponse({ admBranchId: id }));
  } catch (error) {
    next(error);
  }
});

// ==================== AUDIT LOG, CONFIG & GROUP ROUTES ====================

router.get('/auditlog/search', authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse({}));
  } catch (error) {
    next(error);
  }
});

router.post('/auditlog/search', authenticate, async (req, res, next) => {
  try {
    const plstAuditLogDetail = mockAuditLogs.map(log => ({
      tableName: log.tableName,
      primaryKey: String(log.primaryKey),
      changedMode: log.changeModeValue,
      logCount: String(log.lstAuditLogDetail.length),
      changedBy: log.changedBy,
      auditLogId: log.auditLogId,
      changedDate: log.changedDate
    }));
    res.json(wrapResponse({
      plstAuditLogDetail,
      totalCount: plstAuditLogDetail.length,
      pageSize: req.body.pageSize || 10,
      pageNumber: req.body.pageNumber || 1
    }));
  } catch (error) {
    next(error);
  }
});

router.post('/auditlog/LoadAuditLogDetails', authenticate, async (req, res, next) => {
  try {
    const id = req.body.data;
    const log = mockAuditLogs.find(l => l.auditLogId === id);
    res.json(wrapResponse(log || mockAuditLogs[0]));
  } catch (error) {
    next(error);
  }
});

router.get('/config/search', authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse({}));
  } catch (error) {
    next(error);
  }
});

router.post('/config/search', authenticate, async (req, res, next) => {
  try {
    const searchResult = mockConfigs.map(c => ({
      configSerialId: c.configSerialId,
      configId: c.configId,
      configValue: c.configValue,
      configDescription: c.configDescription
    }));
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

router.post('/config/open', authenticate, async (req, res, next) => {
  try {
    const id = req.body.data;
    const conf = mockConfigs.find(c => c.configSerialId === id);
    res.json(wrapResponse(conf || mockConfigs[0]));
  } catch (error) {
    next(error);
  }
});

router.post('/config/save', authenticate, async (req, res, next) => {
  try {
    const conf = req.body;
    if (conf.configSerialId > 0) {
      mockConfigs = mockConfigs.map(c => c.configSerialId === conf.configSerialId ? conf : c);
    } else {
      conf.configSerialId = mockConfigs.length + 1;
      mockConfigs.push(conf);
    }
    res.json(wrapResponse(conf));
  } catch (error) {
    next(error);
  }
});

router.post('/config/Load', authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse(mockConfigs));
  } catch (error) {
    next(error);
  }
});

router.post('/config/delete', authenticate, async (req, res, next) => {
  try {
    const id = req.body.data;
    mockConfigs = mockConfigs.filter(c => c.configSerialId !== id);
    res.json(wrapResponse({ configSerialId: id }));
  } catch (error) {
    next(error);
  }
});

router.get('/group/search', authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse({}));
  } catch (error) {
    next(error);
  }
});

router.post('/group/search', authenticate, async (req, res, next) => {
  try {
    const searchResult = mockGroups.map(g => ({
      groupId: g.groupId,
      groupName: g.groupName,
      beginDate: g.beginDate,
      endDate: g.endDate,
      statusDescription: g.statusDescription
    }));
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

router.post('/group/open', authenticate, async (req, res, next) => {
  try {
    const id = req.body.data;
    const grp = mockGroups.find(g => g.groupId === id);
    res.json(wrapResponse(grp || mockGroups[0]));
  } catch (error) {
    next(error);
  }
});

router.post('/group/save', authenticate, async (req, res, next) => {
  try {
    const grp = req.body;
    if (grp.groupId > 0) {
      mockGroups = mockGroups.map(g => g.groupId === grp.groupId ? grp : g);
    } else {
      grp.groupId = mockGroups.length + 1;
      mockGroups.push(grp);
    }
    res.json(wrapResponse(grp));
  } catch (error) {
    next(error);
  }
});

router.post('/group/delete', authenticate, async (req, res, next) => {
  try {
    const id = req.body.data;
    mockGroups = mockGroups.filter(g => g.groupId !== id);
    res.json(wrapResponse({ groupId: id }));
  } catch (error) {
    next(error);
  }
});

export default router;
