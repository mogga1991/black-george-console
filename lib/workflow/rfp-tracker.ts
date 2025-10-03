// Automated RFP Opportunity Tracking Workflow
// Manages the entire lifecycle from document upload to proposal submission

export interface RFPOpportunity {
  id: string;
  documentId: string;
  title: string;
  agency: string;
  rfpNumber?: string;
  
  // Status tracking
  status: RFPStatus;
  stage: RFPStage;
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  // Timeline
  timeline: {
    uploaded: Date;
    analyzed?: Date;
    propertiesMatched?: Date;
    reviewCompleted?: Date;
    proposalStarted?: Date;
    proposalSubmitted?: Date;
    awarded?: Date;
  };
  
  // Key dates from RFP
  keyDates: {
    expressionOfInterest?: Date;
    marketSurvey?: Date;
    proposalDue?: Date;
    award?: Date;
    occupancy?: Date;
  };
  
  // Progress metrics
  progress: {
    extractionConfidence: number;
    propertiesFound: number;
    complianceScore: number;
    readinessScore: number;
  };
  
  // Associated data
  extractionId?: string;
  matchedProperties: string[];
  selectedProperty?: string;
  
  // Workflow state
  automationEnabled: boolean;
  notifications: NotificationPreferences;
  assignedTo?: string;
  tags: string[];
  
  // Tracking
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export type RFPStatus = 
  | 'pending_analysis'
  | 'analyzing'
  | 'analysis_complete'
  | 'matching_properties'
  | 'properties_matched'
  | 'under_review'
  | 'ready_for_proposal'
  | 'proposal_in_progress'
  | 'proposal_submitted'
  | 'awarded'
  | 'rejected'
  | 'expired'
  | 'cancelled';

export type RFPStage = 
  | 'intake'
  | 'analysis'
  | 'property_matching'
  | 'compliance_review'
  | 'proposal_preparation'
  | 'submission'
  | 'award_phase'
  | 'closed';

export interface NotificationPreferences {
  email: boolean;
  slack: boolean;
  dashboard: boolean;
  deadlineAlerts: boolean;
  statusUpdates: boolean;
  criticalIssues: boolean;
}

export interface WorkflowAction {
  id: string;
  opportunityId: string;
  action: string;
  status: 'pending' | 'completed' | 'failed' | 'skipped';
  triggeredBy: 'system' | 'user' | 'schedule';
  triggeredAt: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
  retryCount: number;
  nextRetry?: Date;
}

export interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  conditions: WorkflowCondition[];
  actions: WorkflowActionDefinition[];
  enabled: boolean;
  priority: number;
}

export interface WorkflowTrigger {
  type: 'status_change' | 'time_based' | 'score_threshold' | 'deadline_approaching' | 'user_action';
  config: Record<string, any>;
}

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'exists';
  value: any;
}

export interface WorkflowActionDefinition {
  type: 'send_notification' | 'update_status' | 'create_task' | 'run_analysis' | 'schedule_reminder';
  config: Record<string, any>;
}

// Default workflow rules for RFP processing
export const DEFAULT_WORKFLOW_RULES: WorkflowRule[] = [
  {
    id: 'auto_analyze_upload',
    name: 'Auto-Analyze New Upload',
    description: 'Automatically analyze RFP documents when uploaded',
    trigger: {
      type: 'status_change',
      config: { from: null, to: 'pending_analysis' }
    },
    conditions: [
      { field: 'automationEnabled', operator: 'equals', value: true }
    ],
    actions: [
      {
        type: 'update_status',
        config: { status: 'analyzing' }
      },
      {
        type: 'run_analysis',
        config: { analysisTypes: ['comprehensive_extraction', 'property_criteria'] }
      }
    ],
    enabled: true,
    priority: 1
  },
  
  {
    id: 'auto_match_properties',
    name: 'Auto-Match Properties',
    description: 'Automatically find matching properties after analysis',
    trigger: {
      type: 'status_change',
      config: { from: 'analyzing', to: 'analysis_complete' }
    },
    conditions: [
      { field: 'progress.extractionConfidence', operator: 'greater_than', value: 0.7 },
      { field: 'automationEnabled', operator: 'equals', value: true }
    ],
    actions: [
      {
        type: 'update_status',
        config: { status: 'matching_properties' }
      },
      {
        type: 'run_analysis',
        config: { type: 'property_matching' }
      }
    ],
    enabled: true,
    priority: 2
  },

  {
    id: 'deadline_warning_7days',
    name: '7-Day Deadline Warning',
    description: 'Send warning when proposal deadline is 7 days away',
    trigger: {
      type: 'deadline_approaching',
      config: { field: 'keyDates.proposalDue', days: 7 }
    },
    conditions: [
      { field: 'status', operator: 'not_equals', value: 'proposal_submitted' },
      { field: 'keyDates.proposalDue', operator: 'exists', value: true }
    ],
    actions: [
      {
        type: 'send_notification',
        config: {
          type: 'deadline_warning',
          urgency: 'high',
          message: 'Proposal deadline approaching in 7 days'
        }
      },
      {
        type: 'update_status',
        config: { priority: 'high' }
      }
    ],
    enabled: true,
    priority: 3
  },

  {
    id: 'deadline_critical_2days',
    name: '2-Day Critical Deadline',
    description: 'Send critical alert when deadline is 2 days away',
    trigger: {
      type: 'deadline_approaching',
      config: { field: 'keyDates.proposalDue', days: 2 }
    },
    conditions: [
      { field: 'status', operator: 'not_equals', value: 'proposal_submitted' }
    ],
    actions: [
      {
        type: 'send_notification',
        config: {
          type: 'critical_deadline',
          urgency: 'critical',
          message: 'CRITICAL: Proposal deadline in 2 days!'
        }
      },
      {
        type: 'update_status',
        config: { priority: 'critical' }
      },
      {
        type: 'create_task',
        config: {
          title: 'Urgent: Complete proposal submission',
          assignTo: 'opportunityOwner',
          priority: 'critical'
        }
      }
    ],
    enabled: true,
    priority: 1
  },

  {
    id: 'low_confidence_review',
    name: 'Low Confidence Review',
    description: 'Flag opportunities with low extraction confidence for manual review',
    trigger: {
      type: 'score_threshold',
      config: { field: 'progress.extractionConfidence', threshold: 0.6, direction: 'below' }
    },
    conditions: [
      { field: 'status', operator: 'equals', value: 'analysis_complete' }
    ],
    actions: [
      {
        type: 'update_status',
        config: { status: 'under_review' }
      },
      {
        type: 'send_notification',
        config: {
          type: 'manual_review_required',
          message: 'RFP analysis has low confidence score - manual review recommended'
        }
      },
      {
        type: 'create_task',
        config: {
          title: 'Review RFP extraction data',
          assignTo: 'analysisTeam',
          priority: 'medium'
        }
      }
    ],
    enabled: true,
    priority: 2
  },

  {
    id: 'compliance_issues_found',
    name: 'Compliance Issues Alert',
    description: 'Alert when properties have critical compliance issues',
    trigger: {
      type: 'score_threshold',
      config: { field: 'progress.complianceScore', threshold: 0.7, direction: 'below' }
    },
    conditions: [
      { field: 'matchedProperties', operator: 'exists', value: true }
    ],
    actions: [
      {
        type: 'send_notification',
        config: {
          type: 'compliance_issues',
          urgency: 'high',
          message: 'Critical compliance issues found in matched properties'
        }
      },
      {
        type: 'create_task',
        config: {
          title: 'Resolve property compliance issues',
          assignTo: 'complianceTeam',
          priority: 'high'
        }
      }
    ],
    enabled: true,
    priority: 2
  },

  {
    id: 'weekly_status_update',
    name: 'Weekly Status Update',
    description: 'Send weekly status updates for active opportunities',
    trigger: {
      type: 'time_based',
      config: { schedule: 'weekly', day: 'monday', time: '09:00' }
    },
    conditions: [
      { field: 'status', operator: 'not_equals', value: 'closed' },
      { field: 'status', operator: 'not_equals', value: 'cancelled' }
    ],
    actions: [
      {
        type: 'send_notification',
        config: {
          type: 'status_update',
          template: 'weekly_summary'
        }
      }
    ],
    enabled: true,
    priority: 3
  }
];

export class RFPOpportunityTracker {
  private opportunities: Map<string, RFPOpportunity> = new Map();
  private workflowRules: WorkflowRule[] = [...DEFAULT_WORKFLOW_RULES];
  private actionQueue: WorkflowAction[] = [];

  constructor(private database: any, private notificationService: any) {}

  // Create new opportunity from uploaded RFP
  async createOpportunity(
    documentId: string, 
    title: string, 
    userId: string,
    options: Partial<RFPOpportunity> = {}
  ): Promise<RFPOpportunity> {
    const opportunity: RFPOpportunity = {
      id: `opp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      documentId,
      title,
      agency: options.agency || 'Unknown Agency',
      rfpNumber: options.rfpNumber,
      
      status: 'pending_analysis',
      stage: 'intake',
      priority: 'medium',
      
      timeline: {
        uploaded: new Date()
      },
      
      keyDates: options.keyDates || {},
      
      progress: {
        extractionConfidence: 0,
        propertiesFound: 0,
        complianceScore: 0,
        readinessScore: 0
      },
      
      matchedProperties: [],
      
      automationEnabled: options.automationEnabled ?? true,
      notifications: options.notifications || {
        email: true,
        slack: false,
        dashboard: true,
        deadlineAlerts: true,
        statusUpdates: true,
        criticalIssues: true
      },
      
      tags: options.tags || [],
      
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      
      ...options
    };

    // Store opportunity
    this.opportunities.set(opportunity.id, opportunity);
    await this.saveOpportunity(opportunity);

    // Trigger workflow rules
    await this.processWorkflowRules(opportunity, null, opportunity.status);

    return opportunity;
  }

  // Update opportunity status and trigger workflow
  async updateStatus(
    opportunityId: string, 
    newStatus: RFPStatus, 
    updates: Partial<RFPOpportunity> = {}
  ): Promise<void> {
    const opportunity = this.opportunities.get(opportunityId);
    if (!opportunity) throw new Error('Opportunity not found');

    const oldStatus = opportunity.status;
    
    // Update opportunity
    const updatedOpportunity = {
      ...opportunity,
      ...updates,
      status: newStatus,
      updatedAt: new Date()
    };

    // Update timeline
    switch (newStatus) {
      case 'analysis_complete':
        updatedOpportunity.timeline.analyzed = new Date();
        break;
      case 'properties_matched':
        updatedOpportunity.timeline.propertiesMatched = new Date();
        break;
      case 'proposal_submitted':
        updatedOpportunity.timeline.proposalSubmitted = new Date();
        break;
      case 'awarded':
        updatedOpportunity.timeline.awarded = new Date();
        break;
    }

    this.opportunities.set(opportunityId, updatedOpportunity);
    await this.saveOpportunity(updatedOpportunity);

    // Trigger workflow rules
    await this.processWorkflowRules(updatedOpportunity, oldStatus, newStatus);
  }

  // Process workflow rules
  private async processWorkflowRules(
    opportunity: RFPOpportunity, 
    oldStatus: RFPStatus | null, 
    newStatus: RFPStatus
  ): Promise<void> {
    for (const rule of this.workflowRules.filter(r => r.enabled)) {
      if (await this.shouldTriggerRule(rule, opportunity, oldStatus, newStatus)) {
        await this.executeRule(rule, opportunity);
      }
    }
  }

  // Check if rule should trigger
  private async shouldTriggerRule(
    rule: WorkflowRule,
    opportunity: RFPOpportunity,
    oldStatus: RFPStatus | null,
    newStatus: RFPStatus
  ): Promise<boolean> {
    // Check trigger conditions
    const trigger = rule.trigger;
    
    switch (trigger.type) {
      case 'status_change':
        if (trigger.config.from && trigger.config.from !== oldStatus) return false;
        if (trigger.config.to && trigger.config.to !== newStatus) return false;
        break;
        
      case 'deadline_approaching':
        const deadline = opportunity.keyDates[trigger.config.field as keyof typeof opportunity.keyDates];
        if (!deadline) return false;
        
        const daysUntil = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysUntil !== trigger.config.days) return false;
        break;
        
      case 'score_threshold':
        const score = this.getNestedValue(opportunity, trigger.config.field);
        const threshold = trigger.config.threshold;
        const direction = trigger.config.direction;
        
        if (direction === 'below' && score >= threshold) return false;
        if (direction === 'above' && score <= threshold) return false;
        break;
    }

    // Check all conditions
    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(condition, opportunity)) {
        return false;
      }
    }

    return true;
  }

  // Execute workflow rule actions
  private async executeRule(rule: WorkflowRule, opportunity: RFPOpportunity): Promise<void> {
    for (const actionDef of rule.actions) {
      const action: WorkflowAction = {
        id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        opportunityId: opportunity.id,
        action: actionDef.type,
        status: 'pending',
        triggeredBy: 'system',
        triggeredAt: new Date(),
        retryCount: 0
      };

      try {
        await this.executeAction(action, actionDef, opportunity);
        action.status = 'completed';
        action.completedAt = new Date();
      } catch (error) {
        action.status = 'failed';
        action.error = error instanceof Error ? error.message : 'Unknown error';
        action.nextRetry = new Date(Date.now() + 5 * 60 * 1000); // Retry in 5 minutes
      }

      this.actionQueue.push(action);
      await this.saveAction(action);
    }
  }

  // Execute individual action
  private async executeAction(
    action: WorkflowAction,
    actionDef: WorkflowActionDefinition,
    opportunity: RFPOpportunity
  ): Promise<void> {
    switch (actionDef.type) {
      case 'send_notification':
        await this.notificationService.send({
          to: opportunity.assignedTo || opportunity.createdBy,
          type: actionDef.config.type,
          urgency: actionDef.config.urgency || 'normal',
          subject: `RFP ${opportunity.title}`,
          message: actionDef.config.message,
          data: { opportunityId: opportunity.id }
        });
        break;

      case 'update_status':
        if (actionDef.config.status) {
          await this.updateStatus(opportunity.id, actionDef.config.status);
        }
        break;

      case 'run_analysis':
        await this.triggerAnalysis(opportunity.id, actionDef.config);
        break;

      case 'create_task':
        await this.createTask(opportunity.id, actionDef.config);
        break;

      case 'schedule_reminder':
        await this.scheduleReminder(opportunity.id, actionDef.config);
        break;
    }
  }

  // Helper methods
  private evaluateCondition(condition: WorkflowCondition, opportunity: RFPOpportunity): boolean {
    const value = this.getNestedValue(opportunity, condition.field);
    
    switch (condition.operator) {
      case 'equals': return value === condition.value;
      case 'not_equals': return value !== condition.value;
      case 'greater_than': return value > condition.value;
      case 'less_than': return value < condition.value;
      case 'contains': return Array.isArray(value) ? value.includes(condition.value) : false;
      case 'exists': return value !== undefined && value !== null;
      default: return false;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  // Database operations (to be implemented with actual database)
  private async saveOpportunity(opportunity: RFPOpportunity): Promise<void> {
    // Save to database
    console.log('Saving opportunity:', opportunity.id);
  }

  private async saveAction(action: WorkflowAction): Promise<void> {
    // Save to database
    console.log('Saving action:', action.id);
  }

  private async triggerAnalysis(opportunityId: string, config: any): Promise<void> {
    // Trigger analysis API
    console.log('Triggering analysis for opportunity:', opportunityId);
  }

  private async createTask(opportunityId: string, config: any): Promise<void> {
    // Create task in task management system
    console.log('Creating task for opportunity:', opportunityId);
  }

  private async scheduleReminder(opportunityId: string, config: any): Promise<void> {
    // Schedule reminder
    console.log('Scheduling reminder for opportunity:', opportunityId);
  }

  // Public API methods
  getOpportunity(id: string): RFPOpportunity | undefined {
    return this.opportunities.get(id);
  }

  getAllOpportunities(): RFPOpportunity[] {
    return Array.from(this.opportunities.values());
  }

  getOpportunitiesByStatus(status: RFPStatus): RFPOpportunity[] {
    return this.getAllOpportunities().filter(opp => opp.status === status);
  }

  getUpcomingDeadlines(days: number = 7): RFPOpportunity[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    
    return this.getAllOpportunities().filter(opp => {
      const deadline = opp.keyDates.proposalDue;
      return deadline && deadline <= cutoff && deadline > new Date();
    });
  }

  async addWorkflowRule(rule: WorkflowRule): Promise<void> {
    this.workflowRules.push(rule);
    // Save to database
  }

  async removeWorkflowRule(ruleId: string): Promise<void> {
    this.workflowRules = this.workflowRules.filter(r => r.id !== ruleId);
    // Update database
  }
}