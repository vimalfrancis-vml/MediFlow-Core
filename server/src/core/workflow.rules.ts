import { RequestType, UserRole, Priority } from '@prisma/client';

export interface RuleContext {
  type: RequestType;
  priority: Priority;
  departmentCode: string;
  details: {
    estimatedCost?: number;     // PurchaseDetail
    leaveType?: string;         // LeaveDetail
    urgencyLevel?: string;      // MaintenanceDetail
    totalDays?: number;         // LeaveDetail
  };
}

export type RuleEffect =
  | { type: 'ADD_STEP'; afterRole: UserRole; insertRole: UserRole; stepName: string }
  | { type: 'SET_PRIORITY'; priority: Priority };

export interface WorkflowRule {
  id: string;
  name: string;
  appliesTo: RequestType;
  condition: (request: RuleContext) => boolean;
  effect: RuleEffect;
}

export const workflowRules: WorkflowRule[] = [
  {
    id: 'RULE_001',
    name: 'High-Cost Purchase Requires Director Approval',
    appliesTo: 'PURCHASE',
    condition: (ctx) => (ctx.details.estimatedCost ?? 0) > 100000,
    effect: {
      type: 'ADD_STEP',
      afterRole: UserRole.PURCHASE_OFFICER,
      insertRole: UserRole.DIRECTOR,
      stepName: 'Director Approval',
    },
  },
  {
    id: 'RULE_002',
    name: 'Long Leave Requires Medical Superintendent Approval',
    appliesTo: 'LEAVE',
    condition: (ctx) => (ctx.details.totalDays ?? 0) > 14 || ctx.priority === Priority.HIGH || ctx.priority === Priority.EMERGENCY,
    effect: {
      type: 'ADD_STEP',
      afterRole: UserRole.HOD,
      insertRole: UserRole.MEDICAL_SUPERINTENDENT,
      stepName: 'Medical Superintendent Approval',
    },
  },
];
