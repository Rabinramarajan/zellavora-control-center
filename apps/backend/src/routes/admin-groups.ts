import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { wrapResponse } from './admin-helpers';

const router = Router();

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
