import { Router } from 'express';
import { ProjectsController } from './projects.controller';
import { authGuard } from '../../middleware/auth';

const router = Router();
const controller = new ProjectsController();

// Apply auth middleware to all routes
router.use(authGuard);

/**
 * @route GET /api/v1/projects
 * @description Get all projects with pagination, filtering, and sorting
 * @query page - Page number (default: 1)
 * @query pageSize - Items per page (default: 20, max: 100)
 * @query status - Filter by status (draft/published/archived)
 * @query search - Search by title or description
 * @query sortBy - Sort by (recent/name/status)
 */
router.get('/', (req, res) => controller.getAll(req, res));

/**
 * @route POST /api/v1/projects
 * @description Create a new project
 * @body title - Project title (required, 3-255 chars)
 * @body description - Project description (optional, max 2000 chars)
 * @body status - Project status (default: draft)
 * @body tags - Array of tags (optional)
 * @body thumbnail - Thumbnail URL (optional)
 */
router.post('/', (req, res) => controller.create(req, res));

/**
 * @route GET /api/v1/projects/:id
 * @description Get a specific project by ID
 * @param id - Project ID
 */
router.get('/:id', (req, res) => controller.getById(req, res));

/**
 * @route PUT /api/v1/projects/:id
 * @description Update a project
 * @param id - Project ID
 * @body - Partial project data
 */
router.put('/:id', (req, res) => controller.update(req, res));

/**
 * @route DELETE /api/v1/projects/:id
 * @description Delete (soft delete) a project
 * @param id - Project ID
 */
router.delete('/:id', (req, res) => controller.delete(req, res));

/**
 * @route PATCH /api/v1/projects/:id/status
 * @description Update project status
 * @param id - Project ID
 * @body status - New status (draft/published/archived)
 */
router.patch('/:id/status', (req, res) => controller.updateStatus(req, res));

/**
 * @route POST /api/v1/projects/:id/publish
 * @description Publish a project
 * @param id - Project ID
 */
router.post('/:id/publish', (req, res) => controller.publish(req, res));

/**
 * @route POST /api/v1/projects/:id/archive
 * @description Archive a project
 * @param id - Project ID
 */
router.post('/:id/archive', (req, res) => controller.archive(req, res));

export default router;
