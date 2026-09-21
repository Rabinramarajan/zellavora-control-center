import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { wrapResponse } from './admin-helpers';

const router = Router();

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
    resourceTypeDescription: 'Screen Component',
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
    resourceTypeDescription: 'Screen Component',
  },
];

/**
 * @swagger
 * /api/v1/admin/resources/search:
 *   get:
 *     summary: Get resource search template
 *     operationId: getAdminResourcesSearch
 *     tags: [Administration - Resources]
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
 *     summary: Search resources
 *     operationId: postAdminResourcesSearch
 *     tags: [Administration - Resources]
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
 *                           resourceId: { type: integer }
 *                           viewNameId: { type: integer }
 *                           viewNameValue: { type: string }
 *                           resourceName: { type: string }
 *                           resourceTypeId: { type: integer }
 *                           resourceTypeValue: { type: string }
 *                           resourceDescription: { type: string }
 *                           viewNameDescription: { type: string }
 *                           resourceTypeDescription: { type: string }
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
 * /api/v1/admin/resources/metadata:
 *   get:
 *     summary: Initialize resource metadata
 *     operationId: getAdminResourcesMetadata
 *     tags: [Administration - Resources]
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
 * /api/v1/admin/resources/template:
 *   get:
 *     summary: Get template for new resource
 *     operationId: getAdminResourcesTemplate
 *     tags: [Administration - Resources]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: New resource template
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     resourceId: { type: integer }
 *                     viewNameId: { type: integer }
 *                     viewNameValue: { type: string }
 *                     resourceName: { type: string }
 *                     resourceTypeId: { type: integer }
 *                     resourceTypeValue: { type: string }
 *                     resourceDescription: { type: string }
 *                     viewNameDescription: { type: string }
 *                     resourceTypeDescription: { type: string }
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
 * /api/v1/admin/resources/details:
 *   post:
 *     summary: Load resource details by ID
 *     operationId: postAdminResourcesDetails
 *     tags: [Administration - Resources]
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
 *         description: Resource profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     resourceId: { type: integer }
 *                     viewNameId: { type: integer }
 *                     viewNameValue: { type: string }
 *                     resourceName: { type: string }
 *                     resourceTypeId: { type: integer }
 *                     resourceTypeValue: { type: string }
 *                     resourceDescription: { type: string }
 *                     viewNameDescription: { type: string }
 *                     resourceTypeDescription: { type: string }
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
 * /api/v1/admin/resources/save:
 *   post:
 *     summary: Save resource details
 *     operationId: postAdminResourcesSave
 *     tags: [Administration - Resources]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [resourceId, resourceName, resourceTypeId, resourceTypeValue]
 *             properties:
 *               resourceId: { type: integer }
 *               viewNameId: { type: integer }
 *               viewNameValue: { type: string }
 *               resourceName: { type: string }
 *               resourceTypeId: { type: integer }
 *               resourceTypeValue: { type: string }
 *               resourceDescription: { type: string }
 *               viewNameDescription: { type: string }
 *               resourceTypeDescription: { type: string }
 *     responses:
 *       200:
 *         description: Saved resource details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     resourceId: { type: integer }
 *                     viewNameId: { type: integer }
 *                     viewNameValue: { type: string }
 *                     resourceName: { type: string }
 *                     resourceTypeId: { type: integer }
 *                     resourceTypeValue: { type: string }
 *                     resourceDescription: { type: string }
 *                     viewNameDescription: { type: string }
 *                     resourceTypeDescription: { type: string }
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
 * /api/v1/admin/resources/delete:
 *   post:
 *     summary: Delete resource
 *     operationId: postAdminResourcesDelete
 *     tags: [Administration - Resources]
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
 *                     resourceId: { type: integer }
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
 * /api/v1/admin/resources/bulk-save:
 *   post:
 *     summary: Save list of resources
 *     operationId: postAdminResourcesBulkSave
 *     tags: [Administration - Resources]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lstentResource:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     resourceId: { type: integer }
 *                     viewNameId: { type: integer }
 *                     viewNameValue: { type: string }
 *                     resourceName: { type: string }
 *                     resourceTypeId: { type: integer }
 *                     resourceTypeValue: { type: string }
 *                     resourceDescription: { type: string }
 *                     viewNameDescription: { type: string }
 *                     resourceTypeDescription: { type: string }
 *     responses:
 *       200:
 *         description: Action status
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
 *                       resourceId: { type: integer }
 *                       viewNameId: { type: integer }
 *                       viewNameValue: { type: string }
 *                       resourceName: { type: string }
 *                       resourceTypeId: { type: integer }
 *                       resourceTypeValue: { type: string }
 *                       resourceDescription: { type: string }
 *                       viewNameDescription: { type: string }
 *                       resourceTypeDescription: { type: string }
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

router.get(['/resources/metadata', '/resource/initialize'], authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse({ status: 'initialized' }));
  } catch (error) {
    next(error);
  }
});

router.get(['/resources/search', '/resource/search'], authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse({}));
  } catch (error) {
    next(error);
  }
});

router.post(['/resources/search', '/resource/search'], authenticate, async (req, res, next) => {
  try {
    res.json(
      wrapResponse({
        searchResult: mockResources,
        totalCount: mockResources.length,
        pageSize: req.body.pageSize || 10,
        pageNumber: req.body.pageNumber || 1,
      })
    );
  } catch (error) {
    next(error);
  }
});

router.get(['/resources/template', '/resource/new'], authenticate, async (req, res, next) => {
  try {
    res.json(
      wrapResponse({
        resourceId: 0,
        viewNameId: 1,
        viewNameValue: 'UserManagement',
        resourceName: '',
        resourceTypeId: 1,
        resourceTypeValue: 'UI_SCREEN',
        resourceDescription: '',
        viewNameDescription: 'User Management View',
        resourceTypeDescription: 'Screen Component',
      })
    );
  } catch (error) {
    next(error);
  }
});

router.post(['/resources/details', '/resource/open'], authenticate, async (req, res, next) => {
  try {
    const id = req.body.data;
    const resrc = mockResources.find((r) => r.resourceId === id);
    res.json(wrapResponse(resrc || mockResources[0]));
  } catch (error) {
    next(error);
  }
});

router.post(['/resources/save', '/resource/save'], authenticate, async (req, res, next) => {
  try {
    const resrc = req.body;
    if (resrc.resourceId > 0) {
      mockResources = mockResources.map((r) => (r.resourceId === resrc.resourceId ? resrc : r));
    } else {
      resrc.resourceId = mockResources.length + 1;
      mockResources.push(resrc);
    }
    res.json(wrapResponse(resrc));
  } catch (error) {
    next(error);
  }
});

router.post(['/resources/delete', '/resource/delete'], authenticate, async (req, res, next) => {
  try {
    const id = req.body.data;
    mockResources = mockResources.filter((r) => r.resourceId !== id);
    res.json(wrapResponse({ resourceId: id }));
  } catch (error) {
    next(error);
  }
});

router.post(['/resources/bulk-save', '/resource/SaveListResource'], authenticate, async (req, res, next) => {
  try {
    const list = req.body.lstentResource || [];
    list.forEach((resrc: any) => {
      if (resrc.resourceId > 0) {
        mockResources = mockResources.map((r) => (r.resourceId === resrc.resourceId ? resrc : r));
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

export default router;
