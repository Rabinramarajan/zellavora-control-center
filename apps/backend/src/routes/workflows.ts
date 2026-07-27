import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { WorkflowService } from '../services/workflow.service';

export function createWorkflowRoutes(workflowService: WorkflowService): Router {
  const router = Router();

  // ========================================
  // Workflow Definitions
  // ========================================

  /**
   * GET /api/v1/workflows
   * Get all workflows for organization
   */
  /**
   * @swagger
   * /api/v1/workflows:
   *   get:
   *     summary: getAllWorkflowsForTheOrganization
   *     tags: [workflows]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: List of enabled workflows
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Workflow'
   *       401:
   *         description: Unauthorized
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const organizationId = (req as any).user?.organizationId;
      if (!organizationId) return res.status(401).json({ error: 'Not authorized' });

      const { data: workflows, error } = await (req as any).supabase
        .from('workflows')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('enabled', true)
        .order('name');

      if (error) throw error;

      res.json(workflows || []);
    } catch (error) {
      console.error('Failed to get workflows', error);
      res.status(500).json({ error: 'Failed to get workflows' });
    }
  });

  /**
   * GET /api/v1/workflows/:workflowId
   * Get workflow details
   */
  router.get('/:workflowId', async (req: Request, res: Response) => {
    try {
      const workflow = await workflowService.getWorkflow(req.params.workflowId);
      if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
      res.json(workflow);
    } catch (error) {
      console.error('Failed to get workflow', error);
      res.status(500).json({ error: 'Failed to get workflow' });
    }
  });

  /**
   * POST /api/v1/workflows
   * Create new workflow
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        key: z.string(),
        name: z.string(),
        description: z.string().optional(),
        initialState: z.string(),
        states: z.array(z.any()),
      });

      const body = schema.parse(req.body);
      const organizationId = (req as any).user?.organizationId;
      const userId = (req as any).user?.id;

      if (!organizationId) return res.status(401).json({ error: 'Not authorized' });

      const { data: workflow, error } = await (req as any).supabase
        .from('workflows')
        .insert({
          organization_id: organizationId,
          key: body.key,
          name: body.name,
          description: body.description,
          initial_state: body.initialState,
          states: body.states,
          created_by: userId,
          updated_by: userId,
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json(workflow);
    } catch (error) {
      console.error('Failed to create workflow', error);
      res.status(500).json({ error: 'Failed to create workflow' });
    }
  });

  // ========================================
  // Workflow Instances
  // ========================================

  /**
   * POST /api/v1/workflows/:workflowId/instances
   * Create workflow instance
   */
  router.post('/:workflowId/instances', async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        entityType: z.string(),
        entityId: z.string().uuid(),
        data: z.record(z.any()).optional(),
      });

      const body = schema.parse(req.body);
      const organizationId = (req as any).user?.organizationId;
      const userId = (req as any).user?.id;

      if (!organizationId) return res.status(401).json({ error: 'Not authorized' });

      const workflow = await workflowService.getWorkflow(req.params.workflowId);
      if (!workflow) return res.status(404).json({ error: 'Workflow not found' });

      const instance = await workflowService.createInstance(
        organizationId,
        workflow.key,
        body.entityType,
        body.entityId,
        body.data || {},
        userId
      );

      if (!instance) return res.status(400).json({ error: 'Failed to create instance' });

      res.status(201).json(instance);
    } catch (error) {
      console.error('Failed to create instance', error);
      res.status(500).json({ error: 'Failed to create instance' });
    }
  });

  /**
   * GET /api/v1/workflow-instances/:instanceId
   * Get workflow instance
   */
  router.get('/instances/:instanceId', async (req: Request, res: Response) => {
    try {
      const instance = await workflowService.getInstance(req.params.instanceId);
      if (!instance) return res.status(404).json({ error: 'Instance not found' });

      // Verify organization access
      const organizationId = (req as any).user?.organizationId;
      if (instance.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      res.json(instance);
    } catch (error) {
      console.error('Failed to get instance', error);
      res.status(500).json({ error: 'Failed to get instance' });
    }
  });

  /**
   * POST /api/v1/workflow-instances/:instanceId/transition
   * Transition workflow state
   */
  router.post('/instances/:instanceId/transition', async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        action: z.string(),
        comment: z.string().optional(),
        variables: z.record(z.any()).optional(),
        reason: z.string().optional(),
      });

      const body = schema.parse(req.body);
      const userId = (req as any).user?.id;

      const result = await workflowService.transitionState(
        {
          workflowInstanceId: req.params.instanceId,
          action: body.action,
          comment: body.comment,
          variables: body.variables,
          reason: body.reason,
        },
        userId
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ success: true, newState: result.newState });
    } catch (error) {
      console.error('Failed to transition state', error);
      res.status(500).json({ error: 'Failed to transition state' });
    }
  });

  /**
   * POST /api/v1/workflow-instances/:instanceId/cancel
   * Cancel workflow instance
   */
  router.post('/instances/:instanceId/cancel', async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        reason: z.string().optional(),
      });

      const body = schema.parse(req.body);
      const userId = (req as any).user?.id;

      const success = await workflowService.cancelInstance(
        req.params.instanceId,
        userId,
        body.reason
      );

      if (!success) return res.status(400).json({ error: 'Failed to cancel' });

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to cancel instance', error);
      res.status(500).json({ error: 'Failed to cancel instance' });
    }
  });

  /**
   * POST /api/v1/workflow-instances/:instanceId/complete
   * Complete workflow instance
   */
  router.post('/instances/:instanceId/complete', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;

      const success = await workflowService.completeInstance(req.params.instanceId, userId);

      if (!success) return res.status(400).json({ error: 'Failed to complete' });

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to complete instance', error);
      res.status(500).json({ error: 'Failed to complete instance' });
    }
  });

  // ========================================
  // Approvals
  // ========================================

  /**
   * POST /api/v1/workflow-instances/:instanceId/approve/:approvalId
   * Approve request
   */
  router.post('/instances/:instanceId/approve/:approvalId', async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        comment: z.string().optional(),
      });

      const body = schema.parse(req.body);
      const userId = (req as any).user?.id;

      const result = await workflowService.approve(req.params.approvalId, userId, body.comment);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ success: true, chainComplete: result.chainComplete });
    } catch (error) {
      console.error('Failed to approve', error);
      res.status(500).json({ error: 'Failed to approve' });
    }
  });

  /**
   * POST /api/v1/workflow-instances/:instanceId/reject/:approvalId
   * Reject request
   */
  router.post('/instances/:instanceId/reject/:approvalId', async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        reason: z.string(),
      });

      const body = schema.parse(req.body);
      const userId = (req as any).user?.id;

      const result = await workflowService.reject(req.params.approvalId, userId, body.reason);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to reject', error);
      res.status(500).json({ error: 'Failed to reject' });
    }
  });

  /**
   * GET /api/v1/workflow-instances/:instanceId/approvals
   * Get approvals for instance
   */
  router.get('/instances/:instanceId/approvals', async (req: Request, res: Response) => {
    try {
      const approvals = await workflowService.getApprovals(req.params.instanceId);
      res.json(approvals);
    } catch (error) {
      console.error('Failed to get approvals', error);
      res.status(500).json({ error: 'Failed to get approvals' });
    }
  });

  /**
   * GET /api/v1/users/me/pending-approvals
   * Get pending approvals for current user
   */
  router.get('/users/me/pending-approvals', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;

      const approvals = await workflowService.getPendingApprovals(userId);
      res.json(approvals);
    } catch (error) {
      console.error('Failed to get pending approvals', error);
      res.status(500).json({ error: 'Failed to get pending approvals' });
    }
  });

  // ========================================
  // Comments & History
  // ========================================

  /**
   * POST /api/v1/workflow-instances/:instanceId/comments
   * Add comment to workflow
   */
  router.post('/instances/:instanceId/comments', async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        content: z.string(),
        mentions: z.array(z.string().uuid()).optional(),
      });

      const body = schema.parse(req.body);
      const userId = (req as any).user?.id;

      await workflowService.addComment(req.params.instanceId, body.content, userId, body.mentions);

      res.status(201).json({ success: true });
    } catch (error) {
      console.error('Failed to add comment', error);
      res.status(500).json({ error: 'Failed to add comment' });
    }
  });

  /**
   * GET /api/v1/workflow-instances/:instanceId/comments
   * Get workflow comments
   */
  router.get('/instances/:instanceId/comments', async (req: Request, res: Response) => {
    try {
      const comments = await workflowService.getComments(req.params.instanceId);
      res.json(comments);
    } catch (error) {
      console.error('Failed to get comments', error);
      res.status(500).json({ error: 'Failed to get comments' });
    }
  });

  /**
   * GET /api/v1/workflow-instances/:instanceId/history
   * Get workflow history
   */
  router.get('/instances/:instanceId/history', async (req: Request, res: Response) => {
    try {
      const history = await workflowService.getHistory(req.params.instanceId);
      res.json(history);
    } catch (error) {
      console.error('Failed to get history', error);
      res.status(500).json({ error: 'Failed to get history' });
    }
  });

  return router;
}
