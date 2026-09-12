import { RequestType, UserRole, Priority } from '@prisma/client';

export interface RuleContext {
  type: RequestType;
  priority: Priority;
  departmentCode: string;
  requesterRole?: UserRole;
  details: {
    estimatedCost?: number;     // PurchaseDetail
    leaveType?: string;         // LeaveDetail
    urgencyLevel?: string;      // MaintenanceDetail
    totalDays?: number;         // LeaveDetail
    amount?: number;            // Generic financial amount for future types
    totalCost?: number;         // Generic financial cost
  };
}

/**
 * Request-type aware financial amount extractor.
 * Avoids assuming every future request type uses `estimatedCost`.
 */
export function getRequestMonetaryAmount(ctx: RuleContext): number | null {
  if (ctx.type === 'PURCHASE') {
    return ctx.details.estimatedCost != null ? Number(ctx.details.estimatedCost) : null;
  }
  if (typeof ctx.details.amount === 'number') {
    return ctx.details.amount;
  }
  if (typeof ctx.details.totalCost === 'number') {
    return ctx.details.totalCost;
  }
  return null;
}

export type RuleEffect =
  | { type: 'ADD_STEP'; afterRole: UserRole; insertRole: UserRole; stepName: string }
  | { type: 'INJECT_FIRST_STEP'; insertRole: UserRole; stepName: string }
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
    id: 'RULE_000',
    name: 'Mandatory High-Value Finance Review (First Stage)',
    appliesTo: 'PURCHASE',
    condition: (ctx) => (getRequestMonetaryAmount(ctx) ?? 0) > 100000,
    effect: {
      type: 'INJECT_FIRST_STEP',
      insertRole: UserRole.FINANCE_OFFICER,
      stepName: 'Finance Review',
    },
  },
  {
    id: 'RULE_001',
    name: 'High-Cost Purchase Requires Director Approval',
    appliesTo: 'PURCHASE',
    condition: (ctx) => (getRequestMonetaryAmount(ctx) ?? 0) > 100000,
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
