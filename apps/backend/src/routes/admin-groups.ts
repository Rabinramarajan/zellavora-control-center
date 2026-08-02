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
    statusDescription: 'Active',
  },
];

/**
 * @swagger
 * /api/v1/admin/group/search:
 *   get:
 *     summary: searchGroups
 *     tags: [groupSearch]
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
 *     summary: searchGroups
 *     tags: [groupSearch]
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
 *                           groupId: { type: integer }
 *                           groupName: { type: string }
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
 * /api/v1/admin/group/open:
 *   post:
 *     summary: loadGroupDetails
 *     tags: [groupDetail]
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
 *         description: Group details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     groupId: { type: integer }
 *                     groupName: { type: string }
 *                     beginDate: { type: string, format: date-time }
 *                     endDate: { type: string, format: date-time }
 *                     statusId: { type: integer }
 *                     statusValue: { type: string }
 *                     statusDescription: { type: string }
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
 * /api/v1/admin/group/save:
 *   post:
 *     summary: saveGroupDetails
 *     tags: [groupDetail]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [groupId, groupName, beginDate, endDate, statusId, statusValue]
 *             properties:
 *               groupId: { type: integer }
 *               groupName: { type: string }
 *               beginDate: { type: string, format: date-time }
 *               endDate: { type: string, format: date-time }
 *               statusId: { type: integer }
 *               statusValue: { type: string }
 *               statusDescription: { type: string }
 *     responses:
 *       200:
 *         description: Saved group details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     groupId: { type: integer }
 *                     groupName: { type: string }
 *                     beginDate: { type: string, format: date-time }
 *                     endDate: { type: string, format: date-time }
 *                     statusId: { type: integer }
 *                     statusValue: { type: string }
 *                     statusDescription: { type: string }
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
 * /api/v1/admin/group/delete:
 *   post:
 *     summary: deleteGroup
 *     tags: [groupDetail]
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
 *                     groupId: { type: integer }
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

router.get('/group/search', authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse({}));
  } catch (error) {
    next(error);
  }
});

router.post('/group/search', authenticate, async (req, res, next) => {
  try {
    const searchResult = mockGroups.map((g) => ({
      groupId: g.groupId,
      groupName: g.groupName,
      beginDate: g.beginDate,
      endDate: g.endDate,
      statusDescription: g.statusDescription,
    }));
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

router.post('/group/open', authenticate, async (req, res, next) => {
  try {
    const id = req.body.data;
    const grp = mockGroups.find((g) => g.groupId === id);
    res.json(wrapResponse(grp || mockGroups[0]));
  } catch (error) {
    next(error);
  }
});

router.post('/group/save', authenticate, async (req, res, next) => {
  try {
    const grp = req.body;
    if (grp.groupId > 0) {
      mockGroups = mockGroups.map((g) => (g.groupId === grp.groupId ? grp : g));
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
    mockGroups = mockGroups.filter((g) => g.groupId !== id);
    res.json(wrapResponse({ groupId: id }));
  } catch (error) {
    next(error);
  }
});

export default router;
