import { describe, it, expect } from 'vitest';
import { evaluateRules } from '../../src/core/RuleEvaluator';
import { RuleContext } from '../../src/core/workflow.rules';
import { WorkflowStep, UserRole, RequestType, Priority } from '@prisma/client';

describe('Approval Dynamic Escalation & Rule Composition Tests', () => {
  const dummyDate = new Date();

  const basePurchaseSteps: WorkflowStep[] = [
    {
      id: 'step-1',
      templateId: 'temp-purchase',
      stepName: 'HOD Approval',
      order: 1,
      approverRole: UserRole.HOD,
      isFinal: false,
      createdAt: dummyDate,
      updatedAt: dummyDate,
    },
    {
      id: 'step-2',
      templateId: 'temp-purchase',
      stepName: 'Procurement Review',
      order: 2,
      approverRole: UserRole.PURCHASE_OFFICER,
      isFinal: true,
      createdAt: dummyDate,
      updatedAt: dummyDate,
    },
  ];

  const baseMaintenanceSteps: WorkflowStep[] = [
    {
      id: 'step-1',
      templateId: 'temp-maintenance',
      stepName: 'HOD Approval',
      order: 1,
      approverRole: UserRole.HOD,
      isFinal: false,
      createdAt: dummyDate,
      updatedAt: dummyDate,
    },
    {
      id: 'step-2',
      templateId: 'temp-maintenance',
      stepName: 'Facilities Processing',
      order: 2,
      approverRole: UserRole.MAINTENANCE_OFFICER,
      isFinal: true,
      createdAt: dummyDate,
      updatedAt: dummyDate,
    },
  ];

  const baseLeaveSteps: WorkflowStep[] = [
    {
      id: 'step-1',
      templateId: 'temp-leave',
      stepName: 'HOD Approval',
      order: 1,
      approverRole: UserRole.HOD,
      isFinal: false,
      createdAt: dummyDate,
      updatedAt: dummyDate,
    },
    {
      id: 'step-2',
      templateId: 'temp-leave',
      stepName: 'HR Processing',
      order: 2,
      approverRole: UserRole.HR,
      isFinal: true,
      createdAt: dummyDate,
      updatedAt: dummyDate,
    },
  ];

  describe('Part 1: Spending Threshold Boundaries (Employee Purchase Requests)', () => {
    it('₹500: Low-value purchase should have 2 steps (HOD -> Purchase Officer)', () => {
      const ctx: RuleContext = {
        type: RequestType.PURCHASE,
        priority: Priority.NORMAL,
        departmentCode: 'CARD',
        requesterRole: UserRole.EMPLOYEE,
        details: { estimatedCost: 500 },
      };
      const result = evaluateRules(ctx, basePurchaseSteps);
      expect(result.length).toBe(2);
      expect(result[0].approverRole).toBe(UserRole.HOD);
      expect(result[1].approverRole).toBe(UserRole.PURCHASE_OFFICER);
      expect(result[1].isFinal).toBe(true);
    });

    it('₹99,999: Boundary low-value purchase should have 2 steps (HOD -> Purchase Officer)', () => {
      const ctx: RuleContext = {
        type: RequestType.PURCHASE,
        priority: Priority.NORMAL,
        departmentCode: 'CARD',
        requesterRole: UserRole.EMPLOYEE,
        details: { estimatedCost: 99999 },
      };
      const result = evaluateRules(ctx, basePurchaseSteps);
      expect(result.length).toBe(2);
      expect(result[0].approverRole).toBe(UserRole.HOD);
      expect(result[1].approverRole).toBe(UserRole.PURCHASE_OFFICER);
      expect(result[1].isFinal).toBe(true);
    });

    it('₹1,00,000: Exact threshold purchase should have 2 steps (HOD -> Purchase Officer)', () => {
      const ctx: RuleContext = {
        type: RequestType.PURCHASE,
        priority: Priority.NORMAL,
        departmentCode: 'CARD',
        requesterRole: UserRole.EMPLOYEE,
        details: { estimatedCost: 100000 },
      };
      const result = evaluateRules(ctx, basePurchaseSteps);
      expect(result.length).toBe(2);
      expect(result[0].approverRole).toBe(UserRole.HOD);
      expect(result[1].approverRole).toBe(UserRole.PURCHASE_OFFICER);
      expect(result[1].isFinal).toBe(true);
    });

    it('₹1,00,001: Boundary high-value purchase should escalate to Director (3 steps)', () => {
      const ctx: RuleContext = {
        type: RequestType.PURCHASE,
        priority: Priority.NORMAL,
        departmentCode: 'CARD',
        requesterRole: UserRole.EMPLOYEE,
        details: { estimatedCost: 100001 },
      };
      const result = evaluateRules(ctx, basePurchaseSteps);
      expect(result.length).toBe(3);
      expect(result[0].approverRole).toBe(UserRole.HOD);
      expect(result[1].approverRole).toBe(UserRole.PURCHASE_OFFICER);
      expect(result[2].approverRole).toBe(UserRole.DIRECTOR);
      expect(result[2].isFinal).toBe(true);
    });

    it('₹5,00,000: High-value purchase should escalate to Director (3 steps)', () => {
      const ctx: RuleContext = {
        type: RequestType.PURCHASE,
        priority: Priority.NORMAL,
        departmentCode: 'CARD',
        requesterRole: UserRole.EMPLOYEE,
        details: { estimatedCost: 500000 },
      };
      const result = evaluateRules(ctx, basePurchaseSteps);
      expect(result.length).toBe(3);
      expect(result[0].approverRole).toBe(UserRole.HOD);
      expect(result[1].approverRole).toBe(UserRole.PURCHASE_OFFICER);
      expect(result[2].approverRole).toBe(UserRole.DIRECTOR);
      expect(result[2].isFinal).toBe(true);
    });
  });

  describe('Part 2: Composed Rule Verification (HOD-Created Requests)', () => {
    it('HOD → ₹50,000 Purchase: Omits HOD self-approval, leaving Procurement Review (1 step)', () => {
      const ctx: RuleContext = {
        type: RequestType.PURCHASE,
        priority: Priority.NORMAL,
        departmentCode: 'CARD',
        requesterRole: UserRole.HOD,
        details: { estimatedCost: 50000 },
      };
      const result = evaluateRules(ctx, basePurchaseSteps);
      expect(result.length).toBe(1);
      expect(result[0].approverRole).toBe(UserRole.PURCHASE_OFFICER);
      expect(result[0].isFinal).toBe(true);
    });

    it('HOD → ₹2,00,000 Purchase: Omits HOD self-approval and escalates to Director (Procurement -> Director, 2 steps, no duplicate roles)', () => {
      const ctx: RuleContext = {
        type: RequestType.PURCHASE,
        priority: Priority.NORMAL,
        departmentCode: 'CARD',
        requesterRole: UserRole.HOD,
        details: { estimatedCost: 200000 },
      };
      const result = evaluateRules(ctx, basePurchaseSteps);
      expect(result.length).toBe(2);
      expect(result[0].approverRole).toBe(UserRole.PURCHASE_OFFICER);
      expect(result[1].approverRole).toBe(UserRole.DIRECTOR);
      expect(result[1].isFinal).toBe(true);

      // Verify no duplicate roles exist
      const roles = result.map((r) => r.approverRole);
      const uniqueRoles = new Set(roles);
      expect(uniqueRoles.size).toBe(roles.length);
    });

    it('HOD → Maintenance: Replaces HOD step with Director Approval (Director -> Facilities Processing, 2 steps)', () => {
      const ctx: RuleContext = {
        type: RequestType.MAINTENANCE,
        priority: Priority.NORMAL,
        departmentCode: 'CARD',
        requesterRole: UserRole.HOD,
        details: { urgencyLevel: 'NORMAL' },
      };
      const result = evaluateRules(ctx, baseMaintenanceSteps);
      expect(result.length).toBe(2);
      expect(result[0].approverRole).toBe(UserRole.DIRECTOR);
      expect(result[1].approverRole).toBe(UserRole.MAINTENANCE_OFFICER);
      expect(result[1].isFinal).toBe(true);
    });

    it('HOD → Leave: Replaces HOD step with Medical Superintendent Approval (Med Supt -> HR, 2 steps)', () => {
      const ctx: RuleContext = {
        type: RequestType.LEAVE,
        priority: Priority.NORMAL,
        departmentCode: 'CARD',
        requesterRole: UserRole.HOD,
        details: { leaveType: 'Annual', totalDays: 5 },
      };
      const result = evaluateRules(ctx, baseLeaveSteps);
      expect(result.length).toBe(2);
      expect(result[0].approverRole).toBe(UserRole.MEDICAL_SUPERINTENDENT);
      expect(result[1].approverRole).toBe(UserRole.HR);
      expect(result[1].isFinal).toBe(true);
    });
  });
});
