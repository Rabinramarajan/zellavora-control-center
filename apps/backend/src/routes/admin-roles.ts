import { Router } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getOrAddRoleSerial, getRoleUuidFromSerial, wrapResponse } from './admin-helpers';

const router = Router();

/**
 * @swagger
 * /api/v1/admin/role/search:
 *   get:
 *     summary: searchRoles
 *     tags: [roleSearch]
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
 *     summary: searchRoles
 *     tags: [roleSearch]
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
 *                           roleId: { type: integer }
 *                           roleName: { type: string }
 *                           moduleDescription: { type: string }
 *                           beginDate: { type: string, format: date-time }
 *                           endDate: { type: string, format: date-time }
 *                           statusDescription: { type: string }
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
 * /api/v1/admin/role/initialize:
 *   get:
 *     summary: initializeRoleMetadata
 *     tags: [roleDetail]
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
 * /api/v1/admin/role/new:
 *   get:
 *     summary: getTemplateForNewRole
 *     tags: [roleDetail]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: New role template
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     roleId: { type: integer }
 *                     roleName: { type: string }
 *                     statusId: { type: integer }
 *                     statusValue: { type: string }
 *                     beginDate: { type: string, format: date-time }
 *                     endDate: { type: string, format: date-time }
 *                     moduleId: { type: integer }
 *                     moduleValue: { type: string }
 *                     statusDescription: { type: string }
 *                     moduleDescription: { type: string }
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
 * /api/v1/admin/role/open:
 *   post:
 *     summary: loadRoleDetailsById
 *     tags: [roleDetail]
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
 *         description: Role profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     roleId: { type: integer }
 *                     roleName: { type: string }
 *                     statusId: { type: integer }
 *                     statusValue: { type: string }
 *                     beginDate: { type: string, format: date-time }
 *                     endDate: { type: string, format: date-time }
 *                     moduleId: { type: integer }
 *                     moduleValue: { type: string }
 *                     statusDescription: { type: string }
 *                     moduleDescription: { type: string }
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
 *         description: Role serial not mapped
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * /api/v1/admin/role/save:
 *   post:
 *     summary: saveRoleDetails
 *     tags: [roleDetail]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roleName]
 *             properties:
 *               roleId: { type: integer }
 *               roleName: { type: string }
 *     responses:
 *       200:
 *         description: Saved role details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     roleId: { type: integer }
 *                     roleName: { type: string }
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
 * /api/v1/admin/role/delete:
 *   post:
 *     summary: deleteRole
 *     tags: [roleDetail]
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
 *         description: Deletion confirmation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     roleId: { type: integer }
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
 * /api/v1/admin/role/role-resource/load:
 *   post:
 *     summary: loadRoleResourceMappings
 *     tags: [roleDetail]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Mappings list
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
 * /api/v1/admin/role/role-resource/save:
 *   post:
 *     summary: saveRoleResourceMappings
 *     tags: [roleDetail]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Action status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     ok: { type: boolean }
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

router.get('/role/initialize', authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse({ status: 'initialized' }));
  } catch (error) {
    next(error);
  }
});

router.get('/role/search', authenticate, async (req, res, next) => {
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
        statusDescription: 'Active',
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

router.get('/role/new', authenticate, async (req, res, next) => {
  try {
    res.json(
      wrapResponse({
        roleId: 0,
        roleName: '',
        statusId: 1,
        statusValue: 'Active',
        beginDate: new Date().toISOString(),
        endDate: '2099-12-31T23:59:59Z',
        moduleId: 1,
        moduleValue: 'Admin',
        statusDescription: 'Active',
        moduleDescription: 'Admin Module',
      })
    );
  } catch (error) {
    next(error);
  }
});

router.post('/role/open', authenticate, async (req, res, next) => {
  try {
    const serial = req.body.data;
    const uuid = getRoleUuidFromSerial(serial);
    if (!uuid) {
      return res.status(404).json({ error: 'Role serial not mapped' });
    }

    const { data: role, error } = await supabase.from('roles').select('*').eq('id', uuid).single();
    if (error) throw error;

    res.json(
      wrapResponse({
        roleId: serial,
        roleName: role.label || role.key,
        statusId: 1,
        statusValue: 'Active',
        beginDate: role.created_at,
        endDate: '2099-12-31T23:59:59Z',
        moduleId: 1,
        moduleValue: 'Admin',
        statusDescription: 'Active',
        moduleDescription: 'Admin Module',
      })
    );
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
      const uuid = getRoleUuidFromSerial(rData.roleId);
      const { data, error } = await supabase
        .from('roles')
        .update({
          label: rData.roleName,
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
          level: 10,
        })
        .select()
        .single();
      if (error) throw error;
      role = data;
    }

    const serial = getOrAddRoleSerial(role.id);
    res.json(
      wrapResponse({
        ...rData,
        roleId: serial,
      })
    );
  } catch (error) {
    next(error);
  }
});

router.post('/role/delete', authenticate, async (req, res, next) => {
  try {
    const serial = req.body.data;
    const uuid = getRoleUuidFromSerial(serial);
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

export default router;
