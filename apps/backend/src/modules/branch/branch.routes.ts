import { Router } from 'express';
import { BranchController } from './branch.controller';

const router = Router();
const controller = new BranchController();

/**
 * @swagger
 * /api/v1/branches:
 *   get:
 *     summary: listBranches
 *     operationId: getBranches
 *     tags: [branches]
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
 *     summary: getBranchById
 *     operationId: getBranchesById
 *     tags: [branches]
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
 *     summary: createBranch
 *     operationId: postBranches
 *     tags: [branches]
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
 *     summary: updateBranch
 *     operationId: putBranchesById
 *     tags: [branches]
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
