// Evaluates workflow rules to dynamically modify step sequences based on request context
import { RuleContext, workflowRules } from './workflow.rules';
import { WorkflowStep, UserRole } from '@prisma/client';

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
  let steps = [...baseSteps];

  for (const rule of workflowRules) {
    if (rule.appliesTo !== ctx.type) continue;
    if (!rule.condition(ctx)) continue;

    if (rule.effect.type === 'ADD_STEP') {
      const afterRole = rule.effect.afterRole;
      const insertRole = rule.effect.insertRole;
      const stepName = rule.effect.stepName;

      // Find the index of the reference step
      const afterIdx = steps.findIndex((s) => s.approverRole === afterRole);
      if (afterIdx !== -1) {
        // Create a dynamic in-memory step representation
        const newStep: WorkflowStep = {
          id: `dynamic-${insertRole.toLowerCase()}-${Date.now()}`,
          templateId: steps[afterIdx]?.templateId || '',
          stepName,
          order: 0, // Will recalculate orders below
          approverRole: insertRole,
          isFinal: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Insert new step
        steps.splice(afterIdx + 1, 0, newStep);
      }
    }
  }

  // Recalculate orders and fix isFinal flag
  return steps.map((step, idx) => ({
    ...step,
    order: idx + 1,
    isFinal: idx === steps.length - 1,
  }));
}
