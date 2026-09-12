import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/db';
import { WorkflowEngine, AuthUser } from '../../src/core/WorkflowEngine';
import { StepResolver, resolveActiveWorkflowTemplate } from '../../src/core/StepResolver';
import { UserService } from '../../src/services/user.service';
import { DepartmentService } from '../../src/services/department.service';
import { RoleService } from '../../src/services/role.service';
import { TerminologyService } from '../../src/services/terminology.service';
import { WorkflowService } from '../../src/services/workflow.service';
import { RequestStatus, RequestType, Priority, UserRole } from '@prisma/client';

describe('MediFlow Phase 1 — Admin Foundation & Safeguards Tests', { timeout: 30000 }, () => {
  let employeeUser: any;
  let hodCardio: any;
  let financeOfficer1: any;
  let financeOfficer2: any;
  let purchaseUser: any;
  let directorUser: any;
  let cardioDept: any;
  let financeDept: any;

  beforeAll(async () => {
    employeeUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.EMPLOYEE, department: { code: 'CARD' } },
      include: { department: true },
    });
    hodCardio = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.HOD, department: { code: 'CARD' } },
      include: { department: true },
    });
    financeOfficer1 = await prisma.user.findFirstOrThrow({
      where: { email: 'finance@mediflow.com' },
      include: { department: true },
    });
    // Create a second finance officer for forwarding test if not existing
    const existingFo2 = await prisma.user.findUnique({ where: { email: 'finance2@mediflow.com' } });
    if (existingFo2) {
      financeOfficer2 = existingFo2;
    } else {
      financeOfficer2 = await UserService.createUser({
        email: 'finance2@mediflow.com',
        employeeId: 'EMP-FIN-002',
        firstName: 'Sarah',
        lastName: 'Accountant',
        role: UserRole.FINANCE_OFFICER,
        departmentId: financeOfficer1.departmentId,
      });
    }

    purchaseUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.PURCHASE_OFFICER },
      include: { department: true },
    });
    directorUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.DIRECTOR },
      include: { department: true },
    });

    cardioDept = employeeUser.department;
    financeDept = financeOfficer1.department;
  });

  describe('1. Protection Against Inactive / Old / Dynamic Workflow Bug', () => {
    it('should NEVER select an inactive or dynamic template for a new request', async () => {
      // Create an inactive template with version 99
      const inactiveTemplate = await prisma.workflowTemplate.create({
        data: {
          name: 'Inactive Old Flow',
          requestType: RequestType.MAINTENANCE,
          version: 99,
          isActive: false,
          steps: {
            create: [
              { stepName: 'Rogue Step', order: 1, approverRole: UserRole.DIRECTOR, isFinal: true },
            ],
          },
        },
      });

      // Create a dynamic cloned template instance
      const dynamicTemplate = await prisma.workflowTemplate.create({
        data: {
          name: 'Dynamic: Maintenance for REQ-99999',
          requestType: RequestType.MAINTENANCE,
          version: 100,
          isActive: false,
          steps: {
            create: [
              { stepName: 'Dynamic Step', order: 1, approverRole: UserRole.EMPLOYEE, isFinal: true },
            ],
          },
        },
      });

      // Resolve active template for MAINTENANCE
      const resolved = await resolveActiveWorkflowTemplate(RequestType.MAINTENANCE);

      // Must be active, not dynamic, not deleted
      expect(resolved.isActive).toBe(true);
      expect(resolved.name.startsWith('Dynamic:')).toBe(false);
      expect(resolved.id).not.toBe(inactiveTemplate.id);
      expect(resolved.id).not.toBe(dynamicTemplate.id);

      // Clean up test templates
      await prisma.workflowStep.deleteMany({ where: { templateId: { in: [inactiveTemplate.id, dynamicTemplate.id] } } });
      await prisma.workflowTemplate.deleteMany({ where: { id: { in: [inactiveTemplate.id, dynamicTemplate.id] } } });
    });
  });

  describe('2. Safe Workflow Versioning for Existing Requests', () => {
    it('activating a new workflow version must NOT alter existing in-flight requests', async () => {
      // 1. Get current Maintenance template (Version 1: HOD -> Facilities)
      const v1Template = await resolveActiveWorkflowTemplate(RequestType.MAINTENANCE);

      // 2. Create and submit an in-flight request under Version 1
      const actorEmployee: AuthUser = {
        id: employeeUser.id,
        email: employeeUser.email,
        role: employeeUser.role,
        departmentId: employeeUser.departmentId,
        departmentCode: 'CARD',
        firstName: employeeUser.firstName,
        lastName: employeeUser.lastName,
      };

      const request1 = await prisma.request.create({
        data: {
          referenceNumber: `REQ-V1-${Date.now()}`,
          title: 'AC Broken in Ward 3',
          type: RequestType.MAINTENANCE,
          priority: Priority.NORMAL,
          status: RequestStatus.DRAFT,
          requestedById: employeeUser.id,
          departmentId: employeeUser.departmentId,
          workflowTemplateId: v1Template.id,
          maintenanceDetail: {
            create: {
              equipmentName: 'Split AC Unit',
              location: 'Ward 3',
              issueDescription: 'Not cooling',
              urgencyLevel: 'NORMAL',
            },
          },
        },
      });

      await WorkflowEngine.submitRequest(request1.id, actorEmployee);

      // Verify request1 resolved steps match Version 1
      const request1StepsInitial = await StepResolver.getStepsForRequest(request1.id);
      expect(request1StepsInitial.length).toBe(2);
      expect(request1StepsInitial[0]!.approverRole).toBe(UserRole.HOD);
      expect(request1StepsInitial[1]!.approverRole).toBe(UserRole.MAINTENANCE_OFFICER);

      let v2Template: any = null;
      let request2: any = null;
      try {
        // 3. Admin creates Version 2 with a 3-step sequence (HOD -> Director -> Facilities)
        v2Template = await WorkflowService.createNewVersion(v1Template.id, {
          name: 'Standard Maintenance Request v2',
          steps: [
            { stepName: 'HOD Clearance', order: 1, approverRole: UserRole.HOD },
            { stepName: 'Director Approval', order: 2, approverRole: UserRole.DIRECTOR },
            { stepName: 'Facilities Repair', order: 3, approverRole: UserRole.MAINTENANCE_OFFICER, isFinal: true },
          ],
        });

        expect(v2Template.version).toBeGreaterThan(v1Template.version);
        expect(v2Template.isActive).toBe(true);

      // 4. CRITICAL CHECK: Existing request1 MUST still resolve to Version 1 steps!
      const request1StepsAfterV2 = await StepResolver.getStepsForRequest(request1.id);
      expect(request1StepsAfterV2.length).toBe(2);
      expect(request1StepsAfterV2[0]!.approverRole).toBe(UserRole.HOD);
      expect(request1StepsAfterV2[1]!.approverRole).toBe(UserRole.MAINTENANCE_OFFICER);

      // 5. A NEW request created after activation gets Version 2
      const activeForNew = await resolveActiveWorkflowTemplate(RequestType.MAINTENANCE);
      expect(activeForNew.id).toBe(v2Template.id);

      request2 = await prisma.request.create({
        data: {
          referenceNumber: `REQ-V2-${Date.now()}`,
          title: 'Elevator Maintenance',
          type: RequestType.MAINTENANCE,
          priority: Priority.NORMAL,
          status: RequestStatus.DRAFT,
          requestedById: employeeUser.id,
          departmentId: employeeUser.departmentId,
          workflowTemplateId: activeForNew.id,
          maintenanceDetail: {
            create: {
              equipmentName: 'Elevator A',
              location: 'Main Block',
              issueDescription: 'Routine servicing',
              urgencyLevel: 'NORMAL',
            },
          },
        },
      });

      await WorkflowEngine.submitRequest(request2.id, actorEmployee);
      const request2Steps = await StepResolver.getStepsForRequest(request2.id);
      expect(request2Steps.length).toBe(3);
      expect(request2Steps[0]!.approverRole).toBe(UserRole.HOD);
      expect(request2Steps[1]!.approverRole).toBe(UserRole.DIRECTOR);
      expect(request2Steps[2]!.approverRole).toBe(UserRole.MAINTENANCE_OFFICER);

      } finally {
        // Clean up test requests & restore v1 as active
        await prisma.auditLog.deleteMany({ where: { requestId: { in: [request1.id, request2.id] } } });
        await prisma.approvalAction.deleteMany({ where: { requestId: { in: [request1.id, request2.id] } } });
        await prisma.notification.deleteMany({ where: { requestId: { in: [request1.id, request2.id] } } });
        await prisma.maintenanceDetail.deleteMany({ where: { requestId: { in: [request1.id, request2.id] } } });
        await prisma.request.deleteMany({ where: { id: { in: [request1.id, request2.id] } } });
        if (v2Template) {
          await prisma.workflowStep.deleteMany({ where: { templateId: v2Template.id } });
          await prisma.workflowTemplate.deleteMany({ where: { id: v2Template.id } });
        }
        await prisma.workflowTemplate.update({ where: { id: v1Template.id }, data: { isActive: true } });
      }
    });
  });

  describe('3. Dynamic Forwarding Semantics', () => {
    it('forwarding changes assignedToUserId while keeping current step pending, preventing self-approval and enforcing boundaries', async () => {
      const actorEmployee: AuthUser = {
        id: employeeUser.id,
        email: employeeUser.email,
        role: employeeUser.role,
        departmentId: employeeUser.departmentId,
        departmentCode: 'CARD',
        firstName: employeeUser.firstName,
        lastName: employeeUser.lastName,
      };

      const template = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);

      // Create high-cost request (> 100k) so Step 1 is Finance Review
      const request = await prisma.request.create({
        data: {
          referenceNumber: `REQ-FWD-${Date.now()}`,
          title: 'Specialized Echocardiogram Machine',
          type: RequestType.PURCHASE,
          priority: Priority.HIGH,
          status: RequestStatus.DRAFT,
          requestedById: employeeUser.id,
          departmentId: employeeUser.departmentId,
          workflowTemplateId: template.id,
          purchaseDetail: {
            create: {
              itemDescription: 'Echo Ultrasound Machine',
              quantity: 1,
              estimatedCost: 250000,
              justification: 'Cardiology expansion',
            },
          },
        },
      });

      await WorkflowEngine.submitRequest(request.id, actorEmployee);

      const actorFinance1: AuthUser = {
        id: financeOfficer1.id,
        email: financeOfficer1.email,
        role: financeOfficer1.role,
        departmentId: financeOfficer1.departmentId,
        departmentCode: 'FIN',
        firstName: financeOfficer1.firstName,
        lastName: financeOfficer1.lastName,
      };

      // 1. Prohibit self-approval: cannot forward to requester
      await expect(
        WorkflowEngine.forward(request.id, employeeUser.id, 'Please review', actorFinance1)
      ).rejects.toThrow('Cannot forward request to the original requester.');

      // 2. Prohibit forwarding to yourself
      await expect(
        WorkflowEngine.forward(request.id, financeOfficer1.id, 'Self assign', actorFinance1)
      ).rejects.toThrow('Cannot forward request to yourself.');

      // 3. Prohibit forwarding outside of Finance Department for Finance step
      await expect(
        WorkflowEngine.forward(request.id, purchaseUser.id, 'Take a look', actorFinance1)
      ).rejects.toThrow();

      // 4. Valid Forward: Forward to second Finance Officer
      const forwarded = await WorkflowEngine.forward(
        request.id,
        financeOfficer2.id,
        'Please conduct secondary audit review',
        actorFinance1
      );

      // Forward semantics verification:
      // - assignedToUserId is updated
      expect(forwarded.assignedToUserId).toBe(financeOfficer2.id);
      // - Step remains pending! Status is still IN_REVIEW
      expect(forwarded.status).toBe(RequestStatus.IN_REVIEW);
      expect(forwarded.currentStepId).not.toBeNull();

      // - FinanceOfficer 1 is no longer authorized to approve since specific assignment was made
      const canFo1Act = await WorkflowEngine.canUserActOnRequest(request.id, financeOfficer1.id);
      expect(canFo1Act).toBe(false);

      // - FinanceOfficer 2 IS authorized
      const canFo2Act = await WorkflowEngine.canUserActOnRequest(request.id, financeOfficer2.id);
      expect(canFo2Act).toBe(true);

      // 5. Assigned user takes approval action
      const actorFinance2: AuthUser = {
        id: financeOfficer2.id,
        email: financeOfficer2.email,
        role: financeOfficer2.role,
        departmentId: financeOfficer2.departmentId,
        departmentCode: 'FIN',
        firstName: financeOfficer2.firstName,
        lastName: financeOfficer2.lastName,
      };

      const approved = await WorkflowEngine.approve(request.id, 'Audit completed and cleared', actorFinance2);

      // Upon approval, assignedToUserId is reset for next step
      expect(approved.assignedToUserId).toBeNull();
      // Advances to Step 2 (HOD)
      const steps = await StepResolver.getStepsForRequest(request.id);
      expect(approved.currentStepId).toBe(steps[1]!.id);

      // Clean up
      await prisma.request.delete({ where: { id: request.id } });
      if (steps[0]?.templateId !== template.id) {
        await prisma.workflowStep.deleteMany({ where: { templateId: steps[0]!.templateId } });
        await prisma.workflowTemplate.delete({ where: { id: steps[0]!.templateId } });
      }
    });
  });

  describe('4. Complete User & Department Management Foundation', () => {
    it('creates, updates, activates, deactivates users and assigns roles/departments correctly', async () => {
      // Create user
      const user = await UserService.createUser({
        email: `test.user.${Date.now()}@mediflow.com`,
        employeeId: `EMP-TEST-${Date.now()}`,
        firstName: 'Jane',
        lastName: 'Doe',
        role: UserRole.EMPLOYEE,
        departmentId: cardioDept.id,
      });

      expect(user.role).toBe(UserRole.EMPLOYEE);
      expect(user.roleRef?.displayName).toBe('Hospital Staff');
      expect(user.department.name).toBe('Cardiology');

      // Change role to PURCHASE_OFFICER
      const updatedRole = await UserService.assignRole(user.id, UserRole.PURCHASE_OFFICER);
      expect(updatedRole.role).toBe(UserRole.PURCHASE_OFFICER);
      expect(updatedRole.roleRef?.displayName).toBe('Procurement Officer');

      // Change department to Finance
      const updatedDept = await UserService.assignDepartment(user.id, financeDept.id);
      expect(updatedDept.department.code).toBe('FIN');

      // Deactivate user
      const deactivated = await UserService.setUserStatus(user.id, false);
      expect(deactivated.isActive).toBe(false);

      // Reactivate user
      const reactivated = await UserService.setUserStatus(user.id, true);
      expect(reactivated.isActive).toBe(true);

      // Clean up
      await prisma.user.delete({ where: { id: user.id } });
    });

    it('creates, updates, and customizes department display names', async () => {
      const deptCode = `DEPT-${Date.now()}`.slice(0, 10);
      const dept = await DepartmentService.createDepartment({
        name: 'Radiology & Imaging',
        code: deptCode,
        displayName: 'Department of Clinical Radiology',
      });

      expect(dept.name).toBe('Radiology & Imaging');
      expect(dept.displayName).toBe('Department of Clinical Radiology');

      // Update display name
      const updated = await DepartmentService.updateDepartment(dept.id, {
        displayName: 'Advanced Diagnostic Imaging Division',
      });
      expect(updated.displayName).toBe('Advanced Diagnostic Imaging Division');

      // Clean up
      await prisma.department.delete({ where: { id: dept.id } });
    });
  });

  describe('5. Role Model & Custom Terminology Foundation', () => {
    it('allows updating role display names while keeping internal code immutable', async () => {
      const purchaseRole = await RoleService.getRoleById(UserRole.PURCHASE_OFFICER);
      expect(purchaseRole.code).toBe(UserRole.PURCHASE_OFFICER);

      const originalName = purchaseRole.displayName;

      // Update display name
      const updated = await RoleService.updateRole(purchaseRole.id, {
        displayName: 'Senior Procurement Specialist',
      });
      expect(updated.displayName).toBe('Senior Procurement Specialist');
      expect(updated.code).toBe(UserRole.PURCHASE_OFFICER); // Internal code intact!

      // Prevent deactivating system role
      await expect(
        RoleService.updateRole(purchaseRole.id, { isActive: false })
      ).rejects.toThrow('Cannot deactivate a built-in system role');

      // Revert back
      await RoleService.updateRole(purchaseRole.id, { displayName: originalName });
    });

    it('allows retrieving and updating custom system terminology labels', async () => {
      const terms = await TerminologyService.getTerminologies('REQUEST_TYPE');
      expect(terms.length).toBeGreaterThan(0);

      const purchaseTerm = terms.find((t) => t.key === 'REQUEST_TYPE_PURCHASE')!;
      const originalLabel = purchaseTerm.label;

      const updated = await TerminologyService.updateTerminology('REQUEST_TYPE_PURCHASE', {
        label: 'Commercial Requisition',
      });
      expect(updated.label).toBe('Commercial Requisition');

      // Revert
      await TerminologyService.updateTerminology('REQUEST_TYPE_PURCHASE', {
        label: originalLabel,
      });
    });
  });

  describe('6. Workflow Configuration Backend Validation', () => {
    it('rejects empty steps, discontinuous ordering, and inactive roles', async () => {
      // Empty steps
      await expect(
        WorkflowService.validateWorkflowConfiguration([])
      ).rejects.toThrow('must contain at least one step');

      // Discontinuous ordering (1, 3)
      await expect(
        WorkflowService.validateWorkflowConfiguration([
          { stepName: 'Step 1', order: 1, approverRole: UserRole.HOD },
          { stepName: 'Step 3', order: 3, approverRole: UserRole.DIRECTOR },
        ])
      ).rejects.toThrow('Invalid step ordering');

      // Inactive / non-existent role
      await expect(
        WorkflowService.validateWorkflowConfiguration([
          { stepName: 'Step 1', order: 1, approverRole: 'SUPER_HERO_ROLE' },
        ])
      ).rejects.toThrow('does not exist or is inactive');

      // Redundant duplicate consecutive stages
      await expect(
        WorkflowService.validateWorkflowConfiguration([
          { stepName: 'Director 1', order: 1, approverRole: UserRole.DIRECTOR },
          { stepName: 'Director 2', order: 2, approverRole: UserRole.DIRECTOR },
        ])
      ).rejects.toThrow('Redundant step configuration');
    });
  });
});
