import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { wrapResponse, mockBranches } from './admin-helpers';

const router = Router();

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

let currentBranches = [...mockBranches];

/**
 * @swagger
 * /api/v1/admin/Branch/Branch/Search:
 *   post:
 *     summary: Search branches
 *     tags: [CommonConfigurationDetail]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Search results
 * /api/v1/admin/MAsterConfig/Region/GetMaasterConfigInitialData:
 *   get:
 *     summary: Get regional initial metadata
 *     tags: [CommonConfigurationDetail]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Initial state
 * /api/v1/admin/Branch/Branch/new:
 *   get:
 *     summary: Get template for new branch
 *     tags: [CommonConfigurationDetail]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: New branch template
 * /api/v1/admin/Branch/Branch/open:
 *   post:
 *     summary: Load branch details
 *     tags: [CommonConfigurationDetail]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Branch details
 * /api/v1/admin/Branch/Branch/save:
 *   post:
 *     summary: Save branch details
 *     tags: [CommonConfigurationDetail]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Saved branch details
 * /api/v1/admin/Branch/Branch/delete:
 *   post:
 *     summary: Delete branch
 *     tags: [CommonConfigurationDetail]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Deletion confirmation
 * /api/v1/admin/config/search:
 *   post:
 *     summary: Search configs
 *     tags: [CommonConfigurationSearch]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Search results
 * /api/v1/admin/config/open:
 *   post:
 *     summary: Load configuration details
 *     tags: [CommonConfigurationDetail]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Loaded configuration
 * /api/v1/admin/config/save:
 *   post:
 *     summary: Save configuration details
 *     tags: [CommonConfigurationDetail]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Saved configuration
 * /api/v1/admin/config/Load:
 *   post:
 *     summary: Load all configurations
 *     tags: [CommonConfigurationDetail]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Configurations list
 * /api/v1/admin/config/delete:
 *   post:
 *     summary: Delete configuration
 *     tags: [CommonConfigurationDetail]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Deletion confirmation
 */

// ==================== BRANCH / REGION ENDPOINTS ====================

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
    const searchResultSet = currentBranches.map(b => ({
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
    const branch = currentBranches.find(b => b.admBranchId === id);
    res.json(wrapResponse(branch || currentBranches[0]));
  } catch (error) {
    next(error);
  }
});

router.post('/Branch/Branch/save', authenticate, async (req, res, next) => {
  try {
    const branch = req.body;
    if (branch.admBranchId > 0) {
      currentBranches = currentBranches.map(b => b.admBranchId === branch.admBranchId ? branch : b);
    } else {
      branch.admBranchId = currentBranches.length + 1;
      currentBranches.push(branch);
    }
    res.json(wrapResponse(branch));
  } catch (error) {
    next(error);
  }
});

router.post('/Branch/Branch/delete', authenticate, async (req, res, next) => {
  try {
    const id = req.body.admBranchId;
    currentBranches = currentBranches.filter(b => b.admBranchId !== id);
    res.json(wrapResponse({ admBranchId: id }));
  } catch (error) {
    next(error);
  }
});

// ==================== CONFIG ENDPOINTS ====================

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

export default router;
