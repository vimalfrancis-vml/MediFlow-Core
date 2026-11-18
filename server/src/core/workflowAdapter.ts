export interface WorkflowStepItem {
  id?: string;
  stepName: string;
  order: number;
  approverRole: string;
  approverDepartmentId?: string | null;
  allowDynamicForwarding?: boolean;
  isFinal?: boolean;
  approverDepartment?: {
    id: string;
    name: string;
    code: string;
    displayName?: string;
  };
}

export interface WorkflowTemplateItem {
  id: string;
  name: string;
  requestType: string;
  version: number;
  isActive: boolean;
  description?: string | null;
  steps: WorkflowStepItem[];
  _count?: {
    requests: number;
  };
  createdAt?: string;
}

export type VisualNodeKind = 'START' | 'APPROVAL' | 'END';

export interface VisualNode {
  id: string;
  kind: VisualNodeKind;
  stepName: string;
  order?: number;
  approverRole: string;
  approverDepartmentId?: string | null;
  approverDepartmentName?: string | null;
  allowDynamicForwarding?: boolean;
  isFinal?: boolean;
  isAutomatic?: boolean;
  ruleNotice?: string;
}

export interface SupportCheckResult {
  supported: boolean;
  reason?: string;
}

export function isWorkflowSupported(template: WorkflowTemplateItem): SupportCheckResult {
  if (!template) {
    return { supported: false, reason: 'Template definition is missing.' };
  }

  if (template.name && template.name.startsWith('Dynamic:')) {
    return {
      supported: false,
      reason: 'This is a dynamic request instance generated at runtime by the rules engine and cannot be edited as a base template.',
    };
  }

  if (!template.steps || template.steps.length === 0) {
    return {
      supported: false,
      reason: 'Workflow does not contain any configured approval stages.',
    };
  }

  const sorted = [...template.steps].sort((a, b) => a.order - b.order);
  for (let i = 0; i < sorted.length; i++) {
    const expectedOrder = i + 1;
    const step = sorted[i];
    if (!step) continue;
    if (step.order !== expectedOrder) {
      return {
        supported: false,
        reason: `Invalid non-consecutive stage sequence: stage "${step.stepName}" has order ${step.order}, expected ${expectedOrder}.`,
      };
    }
    if (!step.stepName || !step.stepName.trim()) {
      return {
        supported: false,
        reason: `Stage at position ${expectedOrder} is missing a valid name.`,
      };
    }
    if (!step.approverRole || !step.approverRole.trim()) {
      return {
        supported: false,
        reason: `Stage "${step.stepName}" is missing an assigned approver role.`,
      };
    }
  }

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    if (
      prev.approverRole === curr.approverRole &&
      (prev.approverDepartmentId || null) === (curr.approverDepartmentId || null)
    ) {
      return {
        supported: false,
        reason: `Duplicate consecutive stage: stage "${curr.stepName}" has the same role and department scope as stage "${prev.stepName}".`,
      };
    }
  }

  return { supported: true };
}

export function stepsToVisualNodes(
  steps: WorkflowStepItem[],
  requestType?: string
): VisualNode[] {
  const sorted = [...steps].sort((a, b) => a.order - b.order);

  const startNode: VisualNode = {
    id: 'node-start',
    kind: 'START',
    stepName: 'Request Submission',
    approverRole: 'EMPLOYEE',
    allowDynamicForwarding: false,
    isFinal: false,
    ruleNotice: 'Request originator drafts and submits the hospital requisition.',
  };

  const approvalNodes: VisualNode[] = sorted.map((s, idx) => {
    let ruleNotice: string | undefined;

    if (requestType === 'PURCHASE' && s.approverRole === 'PURCHASE_OFFICER') {
      ruleNotice = 'Purchases exceeding ₹1,00,000 automatically require Director Approval following Procurement Review.';
    } else if (requestType === 'PURCHASE' && idx === 0) {
      ruleNotice = 'Requisitions exceeding ₹1,00,000 dynamically prepend Finance Department Review at Step 1.';
    } else if (requestType === 'LEAVE' && s.approverRole === 'HOD') {
      ruleNotice = 'Leave applications exceeding 14 days or marked High/Emergency priority automatically require Medical Superintendent Approval.';
    }

    return {
      id: s.id ? `node-step-${s.id}` : `node-step-${idx + 1}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      kind: 'APPROVAL',
      stepName: s.stepName,
      order: idx + 1,
      approverRole: s.approverRole,
      approverDepartmentId: s.approverDepartmentId || null,
      approverDepartmentName: s.approverDepartment?.displayName || s.approverDepartment?.name || null,
      allowDynamicForwarding: s.allowDynamicForwarding ?? true,
      isFinal: idx === sorted.length - 1,
      ruleNotice,
    };
  });

  const endNode: VisualNode = {
    id: 'node-end',
    kind: 'END',
    stepName: 'Final Approval & Execution',
    approverRole: 'SYSTEM',
    allowDynamicForwarding: false,
    isFinal: true,
    ruleNotice: 'Requisition reaches terminal Approved state; notifications and audit trails are finalized.',
  };

  return [startNode, ...approvalNodes, endNode];
}

export function visualNodesToSteps(nodes: VisualNode[]): WorkflowStepItem[] {
  const approvalNodes = nodes.filter((n) => n.kind === 'APPROVAL');

  return approvalNodes.map((node, index) => {
    const isLast = index === approvalNodes.length - 1;
    return {
      stepName: node.stepName.trim(),
      order: index + 1,
      approverRole: node.approverRole,
      approverDepartmentId: node.approverDepartmentId || null,
      allowDynamicForwarding: node.allowDynamicForwarding ?? true,
      isFinal: isLast,
    };
  });
}

export function reorderVisualStages(
  nodes: VisualNode[],
  approvalIndexFrom: number,
  approvalIndexTo: number
): VisualNode[] {
  const startNode = nodes[0]!;
  const endNode = nodes[nodes.length - 1]!;
  const approvalNodes = nodes.filter((n) => n.kind === 'APPROVAL');

  if (
    approvalIndexFrom < 0 ||
    approvalIndexFrom >= approvalNodes.length ||
    approvalIndexTo < 0 ||
    approvalIndexTo >= approvalNodes.length
  ) {
    return nodes;
  }

  const reordered = [...approvalNodes];
  const [moved] = reordered.splice(approvalIndexFrom, 1);
  if (!moved) return nodes;
  reordered.splice(approvalIndexTo, 0, moved);

  const updatedApprovalNodes = reordered.map((node, idx) => ({
    ...node,
    order: idx + 1,
    isFinal: idx === reordered.length - 1,
  }));

  return [startNode, ...updatedApprovalNodes, endNode];
}

export function validateWorkflowSteps(steps: WorkflowStepItem[]): string | null {
  if (!steps || steps.length === 0) {
    return 'A workflow template must contain at least one approval stage.';
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    if (!step.stepName || !step.stepName.trim()) {
      return `Stage ${i + 1} must have a valid name.`;
    }
    if (!step.approverRole || !step.approverRole.trim()) {
      return `Stage "${step.stepName}" must have an assigned approver role.`;
    }
    if (step.order !== i + 1) {
      return `Invalid stage ordering: stage "${step.stepName}" has order ${step.order}, expected ${i + 1}.`;
    }
  }

  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1]!;
    const curr = steps[i]!;
    if (
      prev.approverRole === curr.approverRole &&
      (prev.approverDepartmentId || null) === (curr.approverDepartmentId || null)
    ) {
      return `Redundant stage configuration: consecutive stage "${curr.stepName}" has the identical approver role and department scope as stage "${prev.stepName}".`;
    }
  }

  return null;
}
