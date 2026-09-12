// Evaluates workflow rules to dynamically modify step sequences based on request context
import { RuleContext, getRequestMonetaryAmount } from './workflow.rules';
import { WorkflowStep, UserRole, Priority } from '@prisma/client';

/**
 * Dynamically adjusts workflow steps based on evaluation rules.
 * 
 * @param ctx - The context containing request details and user information.
 * @param baseSteps - The initial list of workflow steps.
 * @returns The modified list of workflow steps with recalculated orders and flags.
 */
export function evaluateRules(
  ctx: RuleContext,
  baseSteps: WorkflowStep[]
): WorkflowStep[] {
  let steps = baseSteps.map((s) => ({ ...s }));

  // 1. Handle HOD Self-Approval Prevention (Requester is HOD)
  if (ctx.requesterRole === UserRole.HOD) {
    if (ctx.type === 'PURCHASE') {
      // HOD self-approval omitted for purchase requests initiated by HOD.
      // Procurement review / Director handles operational processing.
      steps = steps.filter((s) => s.approverRole !== UserRole.HOD);
    } else if (ctx.type === 'MAINTENANCE') {
      // Replace HOD step with Director Approval
      steps = steps.map((s) => {
        if (s.approverRole === UserRole.HOD) {
          return {
            ...s,
            id: `dynamic-director-${Date.now()}`,
            stepName: 'Director Approval',
            approverRole: UserRole.DIRECTOR,
          };
        }
        return s;
      });
    } else if (ctx.type === 'LEAVE') {
      // Replace HOD step with Medical Superintendent Approval
      steps = steps.map((s) => {
        if (s.approverRole === UserRole.HOD) {
          return {
            ...s,
            id: `dynamic-medsupt-${Date.now()}`,
            stepName: 'Medical Superintendent Approval',
            approverRole: UserRole.MEDICAL_SUPERINTENDENT,
          };
        }
        return s;
      });
    }
  }

  // 2. High-Cost Purchase Rule (> ₹1,00,000) — Add Director Approval if not present
  const monetaryAmount = getRequestMonetaryAmount(ctx);
  if (ctx.type === 'PURCHASE' && (monetaryAmount ?? 0) > 100000) {
    const hasDirector = steps.some((s) => s.approverRole === UserRole.DIRECTOR);
    if (!hasDirector) {
      const afterIdx = steps.findIndex((s) => s.approverRole === UserRole.PURCHASE_OFFICER);
      const newStep: WorkflowStep = {
        id: `dynamic-director-${Date.now()}`,
        templateId: steps[0]?.templateId || '',
        stepName: 'Director Approval',
        order: 0,
        approverRole: UserRole.DIRECTOR,
        approverDepartmentId: null,
        allowDynamicForwarding: false,
        isFinal: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      if (afterIdx !== -1) {
        steps.splice(afterIdx + 1, 0, newStep);
      } else {
        steps.push(newStep);
      }
    }
  }

  // 3. Long / High-Priority Leave Rule (> 14 days or HIGH/EMERGENCY)
  if (
    ctx.type === 'LEAVE' &&
    ((ctx.details.totalDays ?? 0) > 14 ||
      ctx.priority === Priority.HIGH ||
      ctx.priority === Priority.EMERGENCY)
  ) {
    const hasMedSupt = steps.some((s) => s.approverRole === UserRole.MEDICAL_SUPERINTENDENT);
    if (!hasMedSupt) {
      const afterIdx = steps.findIndex((s) => s.approverRole === UserRole.HOD);
      const newStep: WorkflowStep = {
        id: `dynamic-medsupt-${Date.now()}`,
        templateId: steps[0]?.templateId || '',
        stepName: 'Medical Superintendent Approval',
        order: 0,
        approverRole: UserRole.MEDICAL_SUPERINTENDENT,
        approverDepartmentId: null,
        allowDynamicForwarding: false,
        isFinal: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      if (afterIdx !== -1) {
        steps.splice(afterIdx + 1, 0, newStep);
      } else {
        steps.unshift(newStep);
      }
    }
  }

  // 4. System-Enforced Finance-First Invariant:
  // Any qualifying request above ₹1,00,000 MUST have Finance Department review as the FIRST required stage.
  // This cannot be bypassed by admin-configured templates.
  if (monetaryAmount !== null && monetaryAmount > 100000) {
    // Check if a Finance Officer step already exists
    const existingFinanceIdx = steps.findIndex((s) => s.approverRole === UserRole.FINANCE_OFFICER);
    let financeStep: WorkflowStep;

    if (existingFinanceIdx !== -1) {
      financeStep = steps.splice(existingFinanceIdx, 1)[0]!;
    } else {
      financeStep = {
        id: `dynamic-finance-${Date.now()}`,
        templateId: steps[0]?.templateId || '',
        stepName: 'Finance Department Review',
        order: 0,
        approverRole: UserRole.FINANCE_OFFICER,
        approverDepartmentId: null,
        allowDynamicForwarding: true,
        isFinal: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    // Unshift to ensure Finance is the very first step
    steps.unshift(financeStep);
  }

  // Deduplicate consecutive identical roles if any remain
  const deduplicatedSteps: WorkflowStep[] = [];
  for (const step of steps) {
    const lastStep = deduplicatedSteps[deduplicatedSteps.length - 1];
    if (!lastStep || lastStep.approverRole !== step.approverRole) {
      deduplicatedSteps.push(step);
    }
  }

  // Recalculate orders and fix isFinal flag
  return deduplicatedSteps.map((step, idx) => ({
    ...step,
    order: idx + 1,
    isFinal: idx === deduplicatedSteps.length - 1,
  }));
}
