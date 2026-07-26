import { createClient } from '@supabase/supabase-js';
import { RedisClient } from '../infrastructure/redis';

export interface WorkflowState {
  name: string;
  displayName: string;
  description?: string;
  type: 'initial' | 'intermediate' | 'terminal' | 'error';
  color?: string;
  icon?: string;
  transitions: WorkflowTransition[];
  metadata?: Record<string, any>;
}

export interface WorkflowTransition {
  to: string;
  action: string;
  conditions?: Record<string, any>;
  requiredRole?: string;
  metadata?: Record<string, any>;
}

export interface WorkflowDefinition {
  id: string;
  organizationId: string;
  key: string;
  name: string;
  description?: string;
  initialState: string;
  states: WorkflowState[];
  version: number;
  enabled: boolean;
}

export interface WorkflowInstance {
  id: string;
  organizationId: string;
  workflowId: string;
  entityType: string;
  entityId: string;
  currentState: string;
  status: 'active' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  data: Record<string, any>;
  variables: Record<string, any>;
  initiatorId?: string;
  assignedTo?: string;
  startedAt: Date;
  completedAt?: Date;
  dueDate?: Date;
}

export interface ApprovalChain {
  id: string;
  organizationId: string;
  workflowId: string;
  key: string;
  name: string;
  type: 'sequential' | 'parallel' | 'conditional';
  strategy: 'unanimous' | 'majority' | 'first_approver';
  approverIds?: string[];
  approverRole?: string;
  approverGroup?: string;
  allowDelegation: boolean;
  allowRejection: boolean;
}

export interface Approval {
  id: string;
  organizationId: string;
  workflowInstanceId: string;
  approvalChainId: string;
  approverId: string;
  status: 'pending' | 'approved' | 'rejected' | 'delegated' | 'escalated';
  approvedAt?: Date;
  rejectedAt?: Date;
  comment?: string;
  sequenceNumber?: number;
}

export interface StateTransitionRequest {
  workflowInstanceId: string;
  action: string;
  comment?: string;
  variables?: Record<string, any>;
  approvalDecision?: boolean;
  reason?: string;
}

export class WorkflowService {
  private supabase: ReturnType<typeof createClient>;
  private redis: RedisClient;
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(supabase: ReturnType<typeof createClient>, redis: RedisClient) {
    this.supabase = supabase;
    this.redis = redis;
  }

  /**
   * Get workflow definition
   */
  async getWorkflow(workflowId: string): Promise<WorkflowDefinition | null> {
    try {
      const cacheKey = `workflow:${workflowId}`;
      const cached = await this.redis.get<WorkflowDefinition>(cacheKey);
      if (cached) return cached;

      const { data: workflow, error } = await this.supabase
        .from('workflows')
        .select('*')
        .eq('id', workflowId)
        .single();

      if (error || !workflow) return null;

      const transformed = this.transformWorkflow(workflow);
      await this.redis.set(cacheKey, transformed, this.CACHE_TTL);
      return transformed;
    } catch (error) {
      console.error('Failed to get workflow', error);
      return null;
    }
  }

  /**
   * Get workflow by key
   */
  async getWorkflowByKey(
    organizationId: string,
    workflowKey: string
  ): Promise<WorkflowDefinition | null> {
    try {
      const cacheKey = `workflow:${organizationId}:${workflowKey}`;
      const cached = await this.redis.get<WorkflowDefinition>(cacheKey);
      if (cached) return cached;

      const { data: workflow, error } = await this.supabase
        .from('workflows')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('key', workflowKey)
        .single();

      if (error || !workflow) return null;

      const transformed = this.transformWorkflow(workflow);
      await this.redis.set(cacheKey, transformed, this.CACHE_TTL);
      return transformed;
    } catch (error) {
      console.error('Failed to get workflow by key', error);
      return null;
    }
  }

  /**
   * Create workflow instance
   */
  async createInstance(
    organizationId: string,
    workflowKey: string,
    entityType: string,
    entityId: string,
    data: Record<string, any>,
    initiatorId: string
  ): Promise<WorkflowInstance | null> {
    try {
      const workflow = await this.getWorkflowByKey(organizationId, workflowKey);
      if (!workflow) return null;

      const { data: instance, error } = await this.supabase
        .from('workflow_instances')
        .insert({
          organization_id: organizationId,
          workflow_id: workflow.id,
          entity_type: entityType,
          entity_id: entityId,
          current_state: workflow.initialState,
          data,
          initiator_id: initiatorId,
          status: 'active',
        })
        .select()
        .single();

      if (error || !instance) throw error;

      // Log to history
      await this.logHistoryEvent(instance.id, 'workflow_started', { workflowKey }, initiatorId);

      // Send notification
      await this.sendNotification(instance.id, 'workflow_started', {
        workflowName: workflow.name,
      });

      return this.transformInstance(instance);
    } catch (error) {
      console.error('Failed to create workflow instance', error);
      return null;
    }
  }

  /**
   * Get workflow instance
   */
  async getInstance(instanceId: string): Promise<WorkflowInstance | null> {
    try {
      const { data: instance, error } = await this.supabase
        .from('workflow_instances')
        .select('*')
        .eq('id', instanceId)
        .single();

      if (error || !instance) return null;

      return this.transformInstance(instance);
    } catch (error) {
      console.error('Failed to get instance', error);
      return null;
    }
  }

  /**
   * Transition workflow to new state
   */
  async transitionState(
    request: StateTransitionRequest,
    userId: string
  ): Promise<{
    success: boolean;
    newState?: string;
    error?: string;
  }> {
    try {
      const instance = await this.getInstance(request.workflowInstanceId);
      if (!instance) return { success: false, error: 'Instance not found' };

      const workflow = await this.getWorkflow(instance.workflowId);
      if (!workflow) return { success: false, error: 'Workflow not found' };

      // Find current state
      const currentStateConfig = workflow.states.find(s => s.name === instance.currentState);
      if (!currentStateConfig) return { success: false, error: 'Invalid state' };

      // Find transition
      const transition = currentStateConfig.transitions.find(t => t.action === request.action);
      if (!transition) return { success: false, error: 'Invalid action' };

      // Check conditions
      if (transition.conditions) {
        const conditionsMet = await this.checkConditions(
          instance,
          transition.conditions,
          request.variables
        );
        if (!conditionsMet) {
          return { success: false, error: 'Conditions not met' };
        }
      }

      // Update instance
      const { data: updated, error } = await this.supabase
        .from('workflow_instances')
        .update({
          current_state: transition.to,
          current_state_entered_at: new Date().toISOString(),
          variables: { ...instance.variables, ...request.variables },
          updated_at: new Date().toISOString(),
        })
        .eq('id', instance.id)
        .select()
        .single();

      if (error || !updated) throw error;

      // Log transition
      await this.logTransition(
        instance.organizationId,
        instance.id,
        instance.currentState,
        transition.to,
        request.action,
        userId,
        request.comment
      );

      // Log to history
      await this.logHistoryEvent(
        instance.id,
        'state_changed',
        {
          fromState: instance.currentState,
          toState: transition.to,
          action: request.action,
        },
        userId
      );

      // Handle state-specific logic
      await this.handleStateEntered(updated, transition.to, userId);

      return { success: true, newState: transition.to };
    } catch (error) {
      console.error('Failed to transition state', error);
      return { success: false, error: 'Transition failed' };
    }
  }

  /**
   * Request approval
   */
  async requestApproval(
    instanceId: string,
    approvalChainId: string,
    approverId: string
  ): Promise<Approval | null> {
    try {
      const { data: approval, error } = await this.supabase
        .from('approvals')
        .insert({
          workflow_instance_id: instanceId,
          approval_chain_id: approvalChainId,
          approver_id: approverId,
          status: 'pending',
        })
        .select()
        .single();

      if (error || !approval) throw error;

      // Send notification
      await this.sendNotification(instanceId, 'approval_requested', {
        approverId,
      });

      return this.transformApproval(approval);
    } catch (error) {
      console.error('Failed to request approval', error);
      return null;
    }
  }

  /**
   * Approve request
   */
  async approve(
    approvalId: string,
    approverId: string,
    comment?: string
  ): Promise<{
    success: boolean;
    chainComplete?: boolean;
    error?: string;
  }> {
    try {
      const { data: approval, error: fetchError } = await this.supabase
        .from('approvals')
        .select('*')
        .eq('id', approvalId)
        .single();

      if (fetchError || !approval) {
        return { success: false, error: 'Approval not found' };
      }

      // Verify approver
      if (approval.approver_id !== approverId && approval.delegated_to !== approverId) {
        return { success: false, error: 'Not authorized to approve' };
      }

      // Update approval
      const { data: updated, error } = await this.supabase
        .from('approvals')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          comment,
        })
        .eq('id', approvalId)
        .select()
        .single();

      if (error || !updated) throw error;

      // Check if chain is complete
      const chainComplete = await this.checkApprovalChainComplete(
        approval.workflow_instance_id,
        approval.approval_chain_id
      );

      if (chainComplete) {
        // Transition workflow
        const instance = await this.getInstance(approval.workflow_instance_id);
        if (instance) {
          const workflow = await this.getWorkflow(instance.workflowId);
          const approvalChain = await this.getApprovalChain(approval.approval_chain_id);

          if (approvalChain?.approval_state) {
            await this.transitionState(
              {
                workflowInstanceId: approval.workflow_instance_id,
                action: 'approve',
              },
              approverId
            );
          }
        }
      }

      // Log history
      await this.logHistoryEvent(
        approval.workflow_instance_id,
        'approval_given',
        { approverId, comment },
        approverId
      );

      return { success: true, chainComplete };
    } catch (error) {
      console.error('Failed to approve', error);
      return { success: false, error: 'Approval failed' };
    }
  }

  /**
   * Reject approval
   */
  async reject(
    approvalId: string,
    approverId: string,
    reason: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { data: approval, error: fetchError } = await this.supabase
        .from('approvals')
        .select('*')
        .eq('id', approvalId)
        .single();

      if (fetchError || !approval) {
        return { success: false, error: 'Approval not found' };
      }

      // Update approval
      const { data: updated, error } = await this.supabase
        .from('approvals')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          decision_reason: reason,
        })
        .eq('id', approvalId)
        .select()
        .single();

      if (error || !updated) throw error;

      // Get approval chain to find rejection state
      const approvalChain = await this.getApprovalChain(approval.approval_chain_id);
      if (approvalChain?.rejection_state) {
        // Transition to rejection state
        await this.transitionState(
          {
            workflowInstanceId: approval.workflow_instance_id,
            action: 'reject',
            reason,
          },
          approverId
        );
      }

      // Log history
      await this.logHistoryEvent(
        approval.workflow_instance_id,
        'approval_rejected',
        { approverId, reason },
        approverId
      );

      return { success: true };
    } catch (error) {
      console.error('Failed to reject', error);
      return { success: false, error: 'Rejection failed' };
    }
  }

  /**
   * Add comment to workflow
   */
  async addComment(
    instanceId: string,
    content: string,
    authorId: string,
    mentions?: string[]
  ): Promise<void> {
    try {
      await this.supabase.from('workflow_comments').insert({
        workflow_instance_id: instanceId,
        content,
        author_id: authorId,
        mentions,
      });

      // Log to history
      await this.logHistoryEvent(instanceId, 'comment_added', { content, mentions }, authorId);

      // Send notifications to mentioned users
      if (mentions && mentions.length > 0) {
        for (const mentionedId of mentions) {
          await this.sendNotification(instanceId, 'mentioned_in_comment', {
            authorId,
            content,
          });
        }
      }
    } catch (error) {
      console.error('Failed to add comment', error);
    }
  }

  /**
   * Get workflow comments
   */
  async getComments(instanceId: string): Promise<any[]> {
    try {
      const { data: comments, error } = await this.supabase
        .from('workflow_comments')
        .select('*')
        .eq('workflow_instance_id', instanceId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error || !comments) return [];

      return comments;
    } catch (error) {
      console.error('Failed to get comments', error);
      return [];
    }
  }

  /**
   * Get workflow history
   */
  async getHistory(instanceId: string): Promise<any[]> {
    try {
      const { data: history, error } = await this.supabase
        .from('workflow_history')
        .select('*')
        .eq('workflow_instance_id', instanceId)
        .order('created_at', { ascending: false });

      if (error || !history) return [];

      return history;
    } catch (error) {
      console.error('Failed to get history', error);
      return [];
    }
  }

  /**
   * Get approvals for instance
   */
  async getApprovals(instanceId: string): Promise<Approval[]> {
    try {
      const { data: approvals, error } = await this.supabase
        .from('approvals')
        .select('*')
        .eq('workflow_instance_id', instanceId)
        .order('sequence_number', { ascending: true });

      if (error || !approvals) return [];

      return approvals.map(a => this.transformApproval(a));
    } catch (error) {
      console.error('Failed to get approvals', error);
      return [];
    }
  }

  /**
   * Get pending approvals for user
   */
  async getPendingApprovals(userId: string): Promise<any[]> {
    try {
      const { data: approvals, error } = await this.supabase
        .from('approvals')
        .select('*, workflow_instances(*), workflows(*)')
        .eq('status', 'pending')
        .or(`approver_id.eq.${userId},delegated_to.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error || !approvals) return [];

      return approvals;
    } catch (error) {
      console.error('Failed to get pending approvals', error);
      return [];
    }
  }

  /**
   * Get approval chain
   */
  async getApprovalChain(chainId: string): Promise<ApprovalChain | null> {
    try {
      const { data: chain, error } = await this.supabase
        .from('approval_chains')
        .select('*')
        .eq('id', chainId)
        .single();

      if (error || !chain) return null;

      return this.transformApprovalChain(chain);
    } catch (error) {
      console.error('Failed to get approval chain', error);
      return null;
    }
  }

  /**
   * Cancel workflow instance
   */
  async cancelInstance(instanceId: string, userId: string, reason?: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('workflow_instances')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', instanceId);

      if (error) throw error;

      // Log history
      await this.logHistoryEvent(instanceId, 'workflow_cancelled', { reason }, userId);

      return true;
    } catch (error) {
      console.error('Failed to cancel instance', error);
      return false;
    }
  }

  /**
   * Complete workflow instance
   */
  async completeInstance(instanceId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('workflow_instances')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          progress: 100,
          updated_at: new Date().toISOString(),
        })
        .eq('id', instanceId);

      if (error) throw error;

      // Log history
      await this.logHistoryEvent(instanceId, 'workflow_completed', {}, userId);

      return true;
    } catch (error) {
      console.error('Failed to complete instance', error);
      return false;
    }
  }

  /**
   * Private helper methods
   */

  private async handleStateEntered(
    instance: any,
    newState: string,
    userId: string
  ): Promise<void> {
    // Handle specific state logic
    const workflow = await this.getWorkflow(instance.workflow_id);
    if (!workflow) return;

    const stateConfig = workflow.states.find(s => s.name === newState);
    if (!stateConfig) return;

    // If terminal state, mark as completed
    if (stateConfig.type === 'terminal') {
      await this.completeInstance(instance.id, userId);
    }
  }

  private async checkConditions(
    instance: WorkflowInstance,
    conditions: Record<string, any>,
    variables?: Record<string, any>
  ): Promise<boolean> {
    // Simple condition checking - can be extended
    for (const [key, expectedValue] of Object.entries(conditions)) {
      const actualValue = variables?.[key] ?? instance.variables[key];
      if (actualValue !== expectedValue) {
        return false;
      }
    }
    return true;
  }

  private async checkApprovalChainComplete(
    instanceId: string,
    chainId: string
  ): Promise<boolean> {
    const { data: approvals, error } = await this.supabase
      .from('approvals')
      .select('status')
      .eq('workflow_instance_id', instanceId)
      .eq('approval_chain_id', chainId);

    if (error || !approvals) return false;

    const chain = await this.getApprovalChain(chainId);
    if (!chain) return false;

    if (chain.type === 'sequential') {
      // All must be approved in order
      return approvals.every(a => a.status === 'approved');
    } else if (chain.type === 'parallel') {
      // All must be approved
      return approvals.every(a => a.status === 'approved');
    } else {
      // Conditional - check strategy
      if (chain.strategy === 'unanimous') {
        return approvals.every(a => a.status === 'approved');
      } else if (chain.strategy === 'majority') {
        const approved = approvals.filter(a => a.status === 'approved').length;
        return approved > approvals.length / 2;
      } else {
        // first_approver
        return approvals.some(a => a.status === 'approved');
      }
    }
  }

  private async logTransition(
    organizationId: string,
    instanceId: string,
    fromState: string,
    toState: string,
    action: string,
    userId: string,
    comment?: string
  ): Promise<void> {
    try {
      await this.supabase.from('workflow_transitions').insert({
        organization_id: organizationId,
        workflow_instance_id: instanceId,
        from_state: fromState,
        to_state: toState,
        action,
        triggered_by: 'user',
        triggered_by_id: userId,
        comment,
      });
    } catch (error) {
      console.error('Failed to log transition', error);
    }
  }

  private async logHistoryEvent(
    instanceId: string,
    eventType: string,
    eventData: Record<string, any>,
    actorId?: string
  ): Promise<void> {
    try {
      const instance = await this.getInstance(instanceId);
      if (!instance) return;

      await this.supabase.from('workflow_history').insert({
        organization_id: instance.organizationId,
        workflow_instance_id: instanceId,
        event_type: eventType,
        event_data: eventData,
        actor_id: actorId,
        actor_type: 'user',
      });
    } catch (error) {
      console.error('Failed to log history event', error);
    }
  }

  private async sendNotification(
    instanceId: string,
    notificationType: string,
    context: Record<string, any>
  ): Promise<void> {
    try {
      const instance = await this.getInstance(instanceId);
      if (!instance) return;

      const notifications: Record<string, { title: string; message: string }> = {
        workflow_started: {
          title: 'Workflow Started',
          message: `${context.workflowName} workflow has been started`,
        },
        approval_requested: {
          title: 'Approval Needed',
          message: 'Your approval is requested',
        },
        approved: {
          title: 'Approved',
          message: 'Request has been approved',
        },
        rejected: {
          title: 'Rejected',
          message: 'Request has been rejected',
        },
        mentioned_in_comment: {
          title: 'Mentioned in Comment',
          message: 'You were mentioned in a workflow comment',
        },
      };

      const notification = notifications[notificationType];
      if (!notification) return;

      // Send to appropriate recipients based on notification type
      let recipientId: string | null = null;

      if (notificationType === 'approval_requested') {
        recipientId = context.approverId;
      } else if (notificationType === 'mentioned_in_comment') {
        recipientId = context.mentionedId;
      } else {
        recipientId = instance.initiatorId || undefined;
      }

      if (recipientId) {
        await this.supabase.from('workflow_notifications').insert({
          organization_id: instance.organizationId,
          workflow_instance_id: instanceId,
          notification_type: notificationType,
          recipient_id: recipientId,
          title: notification.title,
          message: notification.message,
        });
      }
    } catch (error) {
      console.error('Failed to send notification', error);
    }
  }

  private transformWorkflow(data: any): WorkflowDefinition {
    return {
      id: data.id,
      organizationId: data.organization_id,
      key: data.key,
      name: data.name,
      description: data.description,
      initialState: data.initial_state,
      states: data.states || [],
      version: data.version,
      enabled: data.enabled,
    };
  }

  private transformInstance(data: any): WorkflowInstance {
    return {
      id: data.id,
      organizationId: data.organization_id,
      workflowId: data.workflow_id,
      entityType: data.entity_type,
      entityId: data.entity_id,
      currentState: data.current_state,
      status: data.status,
      progress: data.progress,
      data: data.data || {},
      variables: data.variables || {},
      initiatorId: data.initiator_id,
      assignedTo: data.assigned_to,
      startedAt: new Date(data.started_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      dueDate: data.due_date ? new Date(data.due_date) : undefined,
    };
  }

  private transformApproval(data: any): Approval {
    return {
      id: data.id,
      organizationId: data.organization_id,
      workflowInstanceId: data.workflow_instance_id,
      approvalChainId: data.approval_chain_id,
      approverId: data.approver_id,
      status: data.status,
      approvedAt: data.approved_at ? new Date(data.approved_at) : undefined,
      rejectedAt: data.rejected_at ? new Date(data.rejected_at) : undefined,
      comment: data.comment,
    };
  }

  private transformApprovalChain(data: any): ApprovalChain {
    return {
      id: data.id,
      organizationId: data.organization_id,
      workflowId: data.workflow_id,
      key: data.key,
      name: data.name,
      type: data.type,
      strategy: data.strategy,
      approverIds: data.approver_ids,
      approverRole: data.approver_role,
      approverGroup: data.approver_group,
      allowDelegation: data.allow_delegation,
      allowRejection: data.allow_rejection,
    };
  }
}
