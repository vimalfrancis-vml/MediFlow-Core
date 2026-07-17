import { describe, it, expect } from 'vitest';
import { evaluateRules } from '../../src/core/RuleEvaluator';
import { RuleContext } from '../../src/core/workflow.rules';
import { WorkflowStep, UserRole, RequestType, Priority } from '@prisma/client';

describe('RuleEvaluator Unit Tests', () => {
  const dummyDate = new Date();
  
  const basePurchaseSteps: WorkflowStep[] = [
    {
      id: 'step-1',
      templateId: 'temp-1',
      stepName: 'HOD Approval',
      order: 1,
      approverRole: UserRole.HOD,
      isFinal: false,
      createdAt: dummyDate,
      updatedAt: dummyDate,
    },
    {
      id: 'step-2',
      templateId: 'temp-1',
      stepName: 'Procurement Review',
      order: 2,
      approverRole: UserRole.PURCHASE_OFFICER,
      isFinal: true,
      createdAt: dummyDate,
      updatedAt: dummyDate,
    },
  ];

  const baseLeaveSteps: WorkflowStep[] = [
    {
      id: 'step-1',
      templateId: 'temp-2',
      stepName: 'HOD Approval',
      order: 1,
      approverRole: UserRole.HOD,
      isFinal: false,
      createdAt: dummyDate,
      updatedAt: dummyDate,
    },
    {
      id: 'step-2',
      templateId: 'temp-2',
      stepName: 'HR Processing',
      order: 2,
      approverRole: UserRole.HR,
      isFinal: true,
      createdAt: dummyDate,
      updatedAt: dummyDate,
    },
  ];

  it('should not modify steps for low cost purchase request', () => {
    const ctx: RuleContext = {
      type: RequestType.PURCHASE,
      priority: Priority.NORMAL,
      departmentCode: 'CARD',
      details: {
        estimatedCost: 5000, // Below 100k
      },
    };

    const result = evaluateRules(ctx, basePurchaseSteps);
    expect(result.length).toBe(2);
    expect(result[0]?.approverRole).toBe(UserRole.HOD);
    expect(result[1]?.approverRole).toBe(UserRole.PURCHASE_OFFICER);
    expect(result[1]?.isFinal).toBe(true);
  });

  it('should dynamically inject Director approval for high cost purchase request', () => {
    const ctx: RuleContext = {
      type: RequestType.PURCHASE,
      priority: Priority.NORMAL,
      departmentCode: 'CARD',
      details: {
        estimatedCost: 150000, // Above 100k
      },
    };

    const result = evaluateRules(ctx, basePurchaseSteps);
    expect(result.length).toBe(3);
    expect(result[0]?.approverRole).toBe(UserRole.HOD);
    expect(result[1]?.approverRole).toBe(UserRole.PURCHASE_OFFICER);
    expect(result[1]?.isFinal).toBe(false);
    expect(result[2]?.approverRole).toBe(UserRole.DIRECTOR);
    expect(result[2]?.isFinal).toBe(true);
    expect(result[2]?.stepName).toBe('Director Approval');
  });

  it('should inject Medical Superintendent approval for leave request exceeding 14 days', () => {
    const ctx: RuleContext = {
      type: RequestType.LEAVE,
      priority: Priority.NORMAL,
      departmentCode: 'CARD',
      details: {
        totalDays: 15, // Above 14 days
      },
    };

    const result = evaluateRules(ctx, baseLeaveSteps);
    expect(result.length).toBe(3);
    expect(result[0]?.approverRole).toBe(UserRole.HOD);
    expect(result[0]?.isFinal).toBe(false);
    expect(result[1]?.approverRole).toBe(UserRole.MEDICAL_SUPERINTENDENT);
    expect(result[1]?.isFinal).toBe(false);
    expect(result[2]?.approverRole).toBe(UserRole.HR);
    expect(result[2]?.isFinal).toBe(true);
  });

  it('should inject Medical Superintendent approval for high/emergency priority leave request', () => {
    const ctx: RuleContext = {
      type: RequestType.LEAVE,
      priority: Priority.HIGH, // High priority
      departmentCode: 'CARD',
      details: {
        totalDays: 3,
      },
    };

    const result = evaluateRules(ctx, baseLeaveSteps);
    expect(result.length).toBe(3);
    expect(result[1]?.approverRole).toBe(UserRole.MEDICAL_SUPERINTENDENT);
  });
});
