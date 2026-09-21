import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { wrapResponse, mockBranches } from './admin-helpers';

const router = Router();

let mockConfigs = [
  {
    configSerialId: 1,
    configId: 101,
    configValue: 'Enabled',
    configDescription: 'Enable Multi-Factor Authentication',
  },
  {
    configSerialId: 2,
    configId: 102,
    configValue: '5',
    configDescription: 'Maximum login attempts before lock',
  },
];

let currentBranches = [...mockBranches];

/**
 * @swagger
 * /api/v1/admin/regions/metadata:
 *   get:
 *     summary: getRegionalInitialMetadata
 *     operationId: getAdminRegionsMetadata
 *     tags: [administrationConfiguration]
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
 *                     regions:
 *                       type: array
 *                       items:
 *                         type: object
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
 * /api/v1/admin/branches/template:
 *   get:
 *     summary: getTemplateForNewBranch
 *     operationId: getAdminBranchesTemplate
 *     tags: [administrationBranches]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: New branch template
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     admBranchId: { type: integer }
 *                     actCompanyId: { type: integer }
 *                     admLocationId: { type: integer }
 *                     admRegionId: { type: integer }
 *                     branchName: { type: string }
 *                     effectiveDate: { type: string, format: date-time }
 *                     statusId: { type: integer }
 *                     statusValue: { type: string }
 *                     branchCode: { type: string }
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
 * /api/v1/admin/branches/search:
 *   get:
 *     summary: getBranchSearchTemplate
 *     operationId: getAdminBranchesSearch
 *     tags: [administrationBranches]
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
 *     summary: searchBranch
 *     operationId: postAdminBranchesSearch
 *     tags: [administrationBranches]
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
 *                     searchResultSet:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           admBranchId: { type: string }
 *                           branchName: { type: string }
 *                           effectiveDate: { type: string, format: date-time }
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
 * /api/v1/admin/branches/details:
 *   post:
 *     summary: loadBranchDetails
 *     operationId: postAdminBranchesDetails
 *     tags: [administrationBranches]
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
 *         description: Branch details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     admBranchId: { type: integer }
 *                     actCompanyId: { type: integer }
 *                     admLocationId: { type: integer }
 *                     admRegionId: { type: integer }
 *                     branchName: { type: string }
 *                     effectiveDate: { type: string, format: date-time }
 *                     statusId: { type: integer }
 *                     statusValue: { type: string }
 *                     branchCode: { type: string }
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
 * /api/v1/admin/branches/save:
 *   post:
 *     summary: saveBranchDetails
 *     operationId: postAdminBranchesSave
 *     tags: [administrationBranches]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [admBranchId, branchName, effectiveDate, statusId, branchCode]
 *             properties:
 *               admBranchId: { type: integer }
 *               actCompanyId: { type: integer }
 *               admLocationId: { type: integer }
 *               admRegionId: { type: integer }
 *               branchName: { type: string }
 *               effectiveDate: { type: string, format: date-time }
 *               statusId: { type: integer }
 *               statusValue: { type: string }
 *               branchCode: { type: string }
 *     responses:
 *       200:
 *         description: Saved branch details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     admBranchId: { type: integer }
 *                     actCompanyId: { type: integer }
 *                     admLocationId: { type: integer }
 *                     admRegionId: { type: integer }
 *                     branchName: { type: string }
 *                     effectiveDate: { type: string, format: date-time }
 *                     statusId: { type: integer }
 *                     statusValue: { type: string }
 *                     branchCode: { type: string }
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
 * /api/v1/admin/branches/delete:
 *   post:
 *     summary: deleteBranch
 *     operationId: postAdminBranchesDelete
 *     tags: [administrationBranches]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [admBranchId]
 *             properties:
 *               admBranchId:
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
 *                     admBranchId: { type: integer }
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
 * /api/v1/admin/configurations/search:
 *   get:
 *     summary: getConfigurationSearchTemplate
 *     operationId: getAdminConfigurationsSearch
 *     tags: [administrationConfiguration]
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
 *     summary: searchConfigurations
 *     operationId: postAdminConfigurationsSearch
 *     tags: [administrationConfiguration]
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
 *                           configSerialId: { type: integer }
 *                           configId: { type: integer }
 *                           configValue: { type: string }
 *                           configDescription: { type: string }
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
 * /api/v1/admin/configurations/details:
 *   post:
 *     summary: loadConfigurationDetails
 *     operationId: postAdminConfigurationsDetails
 *     tags: [administrationConfiguration]
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
 *         description: Loaded configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     configSerialId: { type: integer }
 *                     configId: { type: integer }
 *                     configValue: { type: string }
 *                     configDescription: { type: string }
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
 * /api/v1/admin/configurations/save:
 *   post:
 *     summary: saveConfigurationDetails
 *     operationId: postAdminConfigurationsSave
 *     tags: [administrationConfiguration]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [configSerialId, configId, configValue, configDescription]
 *             properties:
 *               configSerialId: { type: integer }
 *               configId: { type: integer }
 *               configValue: { type: string }
 *               configDescription: { type: string }
 *     responses:
 *       200:
 *         description: Saved configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     configSerialId: { type: integer }
 *                     configId: { type: integer }
 *                     configValue: { type: string }
 *                     configDescription: { type: string }
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
 * /api/v1/admin/configurations/list:
 *   post:
 *     summary: loadAllConfigurations
 *     operationId: postAdminConfigurationsList
 *     tags: [administrationConfiguration]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Configurations list
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
 *                       configSerialId: { type: integer }
 *                       configId: { type: integer }
 *                       configValue: { type: string }
 *                       configDescription: { type: string }
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
 * /api/v1/admin/configurations/delete:
 *   post:
 *     summary: deleteConfiguration
 *     operationId: postAdminConfigurationsDelete
 *     tags: [administrationConfiguration]
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
 *                     configSerialId: { type: integer }
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

// ==================== BRANCH / REGION ENDPOINTS ====================

router.get(
  ['/regions/metadata', '/MAsterConfig/Region/GetMaasterConfigInitialData'],
  authenticate,
  async (req, res, next) => {
    try {
      res.json(wrapResponse({ regions: [] }));
    } catch (error) {
      next(error);
    }
  }
);

router.get(['/branches/template', '/Branch/Branch/new'], authenticate, async (req, res, next) => {
  try {
    res.json(
      wrapResponse({
        admBranchId: 0,
        actCompanyId: 1,
        admLocationId: 1,
        admRegionId: 1,
        branchName: '',
        effectiveDate: new Date().toISOString(),
        statusId: 1,
        statusValue: 'Active',
        branchCode: '',
      })
    );
  } catch (error) {
    next(error);
  }
});

router.get(['/branches/search', '/Branch/Branch/search'], authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse({}));
  } catch (error) {
    next(error);
  }
});

router.post(['/branches/search', '/Branch/Branch/Search'], authenticate, async (req, res, next) => {
  try {
    const searchResultSet = currentBranches.map((b) => ({
      admBranchId: String(b.admBranchId),
      branchName: b.branchName,
      effectiveDate: b.effectiveDate,
      statusDescription: b.statusValue,
    }));
    res.json(
      wrapResponse({
        searchResultSet,
        totalCount: searchResultSet.length,
        pageSize: req.body.pageSize || 10,
        pageNumber: req.body.pageNumber || 1,
      })
    );
  } catch (error) {
    next(error);
  }
});

router.post(['/branches/details', '/Branch/Branch/open'], authenticate, async (req, res, next) => {
  try {
    const id = req.body.data;
    const branch = currentBranches.find((b) => b.admBranchId === id);
    res.json(wrapResponse(branch || currentBranches[0]));
  } catch (error) {
    next(error);
  }
});

router.post(['/branches/save', '/Branch/Branch/save'], authenticate, async (req, res, next) => {
  try {
    const branch = req.body;
    if (branch.admBranchId > 0) {
      currentBranches = currentBranches.map((b) =>
        b.admBranchId === branch.admBranchId ? branch : b
      );
    } else {
      branch.admBranchId = currentBranches.length + 1;
      currentBranches.push(branch);
    }
    res.json(wrapResponse(branch));
  } catch (error) {
    next(error);
  }
});

router.post(['/branches/delete', '/Branch/Branch/delete'], authenticate, async (req, res, next) => {
  try {
    const id = req.body.admBranchId;
    currentBranches = currentBranches.filter((b) => b.admBranchId !== id);
    res.json(wrapResponse({ admBranchId: id }));
  } catch (error) {
    next(error);
  }
});

// ==================== CONFIG ENDPOINTS ====================

router.get(['/configurations/search', '/config/search'], authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse({}));
  } catch (error) {
    next(error);
  }
});

router.post(['/configurations/search', '/config/search'], authenticate, async (req, res, next) => {
  try {
    const searchResult = mockConfigs.map((c) => ({
      configSerialId: c.configSerialId,
      configId: c.configId,
      configValue: c.configValue,
      configDescription: c.configDescription,
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

router.post(['/configurations/details', '/config/open'], authenticate, async (req, res, next) => {
  try {
    const id = req.body.data;
    const conf = mockConfigs.find((c) => c.configSerialId === id);
    res.json(wrapResponse(conf || mockConfigs[0]));
  } catch (error) {
    next(error);
  }
});

router.post(['/configurations/save', '/config/save'], authenticate, async (req, res, next) => {
  try {
    const conf = req.body;
    if (conf.configSerialId > 0) {
      mockConfigs = mockConfigs.map((c) => (c.configSerialId === conf.configSerialId ? conf : c));
    } else {
      conf.configSerialId = mockConfigs.length + 1;
      mockConfigs.push(conf);
    }
    res.json(wrapResponse(conf));
  } catch (error) {
    next(error);
  }
});

router.post(['/configurations/list', '/config/Load'], authenticate, async (req, res, next) => {
  try {
    res.json(wrapResponse(mockConfigs));
  } catch (error) {
    next(error);
  }
});

router.post(['/configurations/delete', '/config/delete'], authenticate, async (req, res, next) => {
  try {
    const id = req.body.data;
    mockConfigs = mockConfigs.filter((c) => c.configSerialId !== id);
    res.json(wrapResponse({ configSerialId: id }));
  } catch (error) {
    next(error);
  }
});

export default router;
