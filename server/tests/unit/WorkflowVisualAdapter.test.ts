import { describe, it, expect } from 'vitest';
import {
  stepsToVisualNodes,
  visualNodesToSteps,
  reorderVisualStages,
  isWorkflowSupported,
  validateWorkflowSteps,
} from '../../src/core/workflowAdapter';

describe('Workflow Visual Adapter Golden-File Round-Trip Tests', () => {
  // 1. Seed Template: Standard Purchase Request
  const purchaseSteps = [
    {
      stepName: 'HOD Approval',
      order: 1,
      approverRole: 'HOD',
      approverDepartmentId: null,
      allowDynamicForwarding: true,
      isFinal: false,
    },
    {
      stepName: 'Procurement Review',
      order: 2,
      approverRole: 'PURCHASE_OFFICER',
      approverDepartmentId: null,
      allowDynamicForwarding: true,
      isFinal: true,
    },
  ];

  // 2. Seed Template: Standard Maintenance Request
  const maintenanceSteps = [
    {
      stepName: 'HOD Approval',
      order: 1,
      approverRole: 'HOD',
      approverDepartmentId: null,
      allowDynamicForwarding: true,
      isFinal: false,
    },
    {
      stepName: 'Facilities Processing',
      order: 2,
      approverRole: 'MAINTENANCE_OFFICER',
      approverDepartmentId: null,
      allowDynamicForwarding: true,
      isFinal: true,
    },
  ];

  // 3. Seed Template: Standard Leave Request
  const leaveSteps = [
    {
      stepName: 'HOD Approval',
      order: 1,
      approverRole: 'HOD',
      approverDepartmentId: null,
      allowDynamicForwarding: true,
      isFinal: false,
    },
    {
      stepName: 'HR Processing',
      order: 2,
      approverRole: 'HR',
      approverDepartmentId: null,
      allowDynamicForwarding: true,
      isFinal: true,
    },
  ];

  // 4. Seed Template: General Operational Request
  const generalSteps = [
    {
      stepName: 'Operational Review & Fulfillment',
      order: 1,
      approverRole: 'EMPLOYEE',
      approverDepartmentId: null,
      allowDynamicForwarding: true,
      isFinal: true,
    },
  ];

  it('should round-trip Standard Purchase Request with full fidelity', () => {
    const visualNodes = stepsToVisualNodes(purchaseSteps, 'PURCHASE');
    expect(visualNodes[0]?.kind).toBe('START');
    expect(visualNodes[visualNodes.length - 1]?.kind).toBe('END');
    expect(visualNodes.filter((n) => n.kind === 'APPROVAL')).toHaveLength(2);

    const compiled = visualNodesToSteps(visualNodes);
    expect(compiled).toEqual(purchaseSteps);
  });

  it('should round-trip Standard Maintenance Request with full fidelity', () => {
    const visualNodes = stepsToVisualNodes(maintenanceSteps, 'MAINTENANCE');
    const compiled = visualNodesToSteps(visualNodes);
    expect(compiled).toEqual(maintenanceSteps);
  });

  it('should round-trip Standard Leave Request with full fidelity', () => {
    const visualNodes = stepsToVisualNodes(leaveSteps, 'LEAVE');
    const compiled = visualNodesToSteps(visualNodes);
    expect(compiled).toEqual(leaveSteps);
  });

  it('should round-trip General Operational Request with full fidelity', () => {
    const visualNodes = stepsToVisualNodes(generalSteps, 'GENERAL');
    const compiled = visualNodesToSteps(visualNodes);
    expect(compiled).toEqual(generalSteps);
  });

  it('should exclude Start and End nodes from the compiled save payload', () => {
    const visualNodes = stepsToVisualNodes(purchaseSteps, 'PURCHASE');
    const compiled = visualNodesToSteps(visualNodes);

    expect(compiled.some((s) => s.stepName === 'Request Submission')).toBe(false);
    expect(compiled.some((s) => s.stepName === 'Final Approval & Execution')).toBe(false);
    expect(compiled.every((s) => s.order >= 1 && s.order <= compiled.length)).toBe(true);
  });

  it('should correctly reorder stages using Move Up / Move Down and re-index 1..N order and isFinal', () => {
    const visualNodes = stepsToVisualNodes(purchaseSteps, 'PURCHASE');
    // Swap stage 0 and stage 1
    const reordered = reorderVisualStages(visualNodes, 0, 1);
    const compiled = visualNodesToSteps(reordered);

    expect(compiled).toHaveLength(2);
    expect(compiled[0]?.stepName).toBe('Procurement Review');
    expect(compiled[0]?.order).toBe(1);
    expect(compiled[0]?.isFinal).toBe(false);

    expect(compiled[1]?.stepName).toBe('HOD Approval');
    expect(compiled[1]?.order).toBe(2);
    expect(compiled[1]?.isFinal).toBe(true);
  });

  it('should correctly identify and reject unsupported configurations', () => {
    // 1. Dynamic runtime clones
    const dynamicTmpl: any = {
      id: 'dyn-1',
      name: 'Dynamic: Purchase for REQ-2026-001',
      requestType: 'PURCHASE',
      version: 1,
      isActive: false,
      steps: purchaseSteps,
    };
    expect(isWorkflowSupported(dynamicTmpl).supported).toBe(false);
    expect(isWorkflowSupported(dynamicTmpl).reason).toContain('dynamic request instance');

    // 2. Gapped sequence
    const gappedTmpl: any = {
      id: 'gap-1',
      name: 'Gapped Flow',
      requestType: 'PURCHASE',
      version: 1,
      isActive: true,
      steps: [
        { ...purchaseSteps[0], order: 1 },
        { ...purchaseSteps[1], order: 3 }, // Gap!
      ],
    };
    expect(isWorkflowSupported(gappedTmpl).supported).toBe(false);

    // 3. Consecutive identical role + dept
    const duplicateTmpl: any = {
      id: 'dup-1',
      name: 'Duplicate Consecutive Flow',
      requestType: 'PURCHASE',
      version: 1,
      isActive: true,
      steps: [
        { stepName: 'Step 1', order: 1, approverRole: 'HOD', approverDepartmentId: 'cardio' },
        { stepName: 'Step 2', order: 2, approverRole: 'HOD', approverDepartmentId: 'cardio' },
      ],
    };
    expect(isWorkflowSupported(duplicateTmpl).supported).toBe(false);
  });

  it('should validate workflow steps according to backend engine rules', () => {
    expect(validateWorkflowSteps([])).toBe('A workflow template must contain at least one approval stage.');
    expect(
      validateWorkflowSteps([
        { stepName: '', order: 1, approverRole: 'HOD' },
      ])
    ).toBe('Stage 1 must have a valid name.');
    expect(
      validateWorkflowSteps([
        { stepName: 'Stage 1', order: 1, approverRole: '' },
      ])
    ).toBe('Stage "Stage 1" must have an assigned approver role.');
    expect(
      validateWorkflowSteps(purchaseSteps)
    ).toBeNull();
  });
});
