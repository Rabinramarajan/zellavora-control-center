import { Router } from 'express';
import { TeamsController } from './teams.controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();
const controller = new TeamsController();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * @route GET /api/v1/teams
 * @description Get all teams with pagination, filtering, and sorting
 * @query page - Page number (default: 1)
 * @query pageSize - Items per page (default: 20, max: 100)
 * @query search - Search by name or description
 * @query sortBy - Sort by (recent/name/members)
 */
router.get('/', (req, res) => controller.getAll(req, res));

/**
 * @route POST /api/v1/teams
 * @description Create a new team
 * @body name - Team name (required, 3-255 chars)
 * @body description - Team description (optional, max 2000 chars)
 * @body members - Array of user IDs to add (optional)
 */
router.post('/', (req, res) => controller.create(req, res));

/**
 * @route GET /api/v1/teams/:id
 * @description Get a specific team by ID
 * @param id - Team ID
 */
router.get('/:id', (req, res) => controller.getById(req, res));

/**
 * @route PUT /api/v1/teams/:id
 * @description Update a team
 * @param id - Team ID
 * @body - Partial team data
 */
router.put('/:id', (req, res) => controller.update(req, res));

/**
 * @route DELETE /api/v1/teams/:id
 * @description Delete (soft delete) a team
 * @param id - Team ID
 */
router.delete('/:id', (req, res) => controller.delete(req, res));

/**
 * @route GET /api/v1/teams/:id/members
 * @description Get team members with pagination
 * @param id - Team ID
 * @query page - Page number (default: 1)
 * @query pageSize - Items per page (default: 20)
 */
router.get('/:id/members', (req, res) => controller.getMembers(req, res));

/**
 * @route POST /api/v1/teams/:id/members
 * @description Add a member to team
 * @param id - Team ID
 * @body userId - User ID to add (required)
 * @body role - Member role (default: member)
 */
router.post('/:id/members', (req, res) => controller.addMember(req, res));

/**
 * @route DELETE /api/v1/teams/:id/members
 * @description Remove a member from team
 * @param id - Team ID
 * @body userId - User ID to remove (required)
 */
router.delete('/:id/members', (req, res) => controller.removeMember(req, res));

export default router;
