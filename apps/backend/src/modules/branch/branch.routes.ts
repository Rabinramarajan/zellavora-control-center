import { Router } from 'express';
import { BranchController } from './branch.controller';

const router = Router();
const controller = new BranchController();

/**
 * @swagger
 * /api/v1/branches:
 *   get:
 *     summary: List branches
 *     operationId: getBranches
 *     tags: [Branches]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get('/', controller.list);
/**
 * @swagger
 * /api/v1/branches/{id}:
 *   get:
 *     summary: Get branch by ID
 *     operationId: getBranchesById
 *     tags: [Branches]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.get('/:id', controller.get);
/**
 * @swagger
 * /api/v1/branches:
 *   post:
 *     summary: Create branch
 *     operationId: postBranches
 *     tags: [Branches]
 *     security: []
 *     responses:
 *       default:
 *         description: Operation response
 */
router.post('/', controller.create);
/**
 * @swagger
 * /api/v1/branches/{id}:
 *   put:
 *     summary: Update branch
 *     operationId: putBranchesById
 *     tags: [Branches]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       default:
 *         description: Operation response
 */
router.put('/:id', controller.update);

export default router;
