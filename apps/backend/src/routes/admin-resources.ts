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

export default router;
