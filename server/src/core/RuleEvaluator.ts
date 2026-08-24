// Evaluates workflow rules to dynamically modify step sequences based on request context
import { RuleContext, workflowRules } from './workflow.rules';
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
      // Procurement review handles initial operational processing; if > 100k, Director step is added at end.
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

  // 2. High-Cost Purchase Rule (> ₹1,00,000)
  if (ctx.type === 'PURCHASE' && (ctx.details.estimatedCost ?? 0) > 100000) {
    const hasDirector = steps.some((s) => s.approverRole === UserRole.DIRECTOR);
    if (!hasDirector) {
      const afterIdx = steps.findIndex((s) => s.approverRole === UserRole.PURCHASE_OFFICER);
      const newStep: WorkflowStep = {
        id: `dynamic-director-${Date.now()}`,
        templateId: steps[0]?.templateId || '',
        stepName: 'Director Approval',
        order: 0,
        approverRole: UserRole.DIRECTOR,
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

  // 3. Long / High-Priority Leave Rule
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

  // Deduplicate consecutive identical roles if any remain
  const deduplicatedSteps: WorkflowStep[] = [];
  for (const step of steps) {
    if (
      deduplicatedSteps.length === 0 ||
      deduplicatedSteps[deduplicatedSteps.length - 1].approverRole !== step.approverRole
    ) {
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
