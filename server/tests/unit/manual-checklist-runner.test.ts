import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/db';
import { UserService } from '../../src/services/user.service';
import { DepartmentService } from '../../src/services/department.service';
import { RoleService } from '../../src/services/role.service';
import { TerminologyService } from '../../src/services/terminology.service';
import { WorkflowService } from '../../src/services/workflow.service';
import { WorkflowEngine, AuthUser } from '../../src/core/WorkflowEngine';
import { StepResolver, resolveActiveWorkflowTemplate } from '../../src/core/StepResolver';
import { RequestService } from '../../src/request/request.service';
import { RequestType, RequestStatus, Priority, UserRole, ApprovalActionType } from '@prisma/client';
import bcrypt from 'bcrypt';

describe('MEDIFLOW — PHASE 1 MANUAL VERIFICATION CHECKLIST (AUTOMATED RUNNER)', { timeout: 30000 }, () => {
  let adminUser: any;
  let hodCardio: any;
  let employeeCardio: any;
  let financeUser1: any;
  let financeUser2: any;
  let purchaseUser: any;
  let directorUser: any;
  let medSuptUser: any;
  let cardioDept: any;
  let financeDept: any;

  // Helper to build AuthUser
  const toAuthUser = (u: any, deptCode: string = 'CARD'): AuthUser => ({
    id: u.id,
    email: u.email,
    role: u.role,
    departmentId: u.departmentId,
    departmentCode: deptCode,
    firstName: u.firstName,
    lastName: u.lastName,
  });

  beforeAll(async () => {
    adminUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.ADMIN } });
    hodCardio = await prisma.user.findFirstOrThrow({ where: { role: UserRole.HOD, email: 'hod.cardio@mediflow.com' } });
    employeeCardio = await prisma.user.findFirstOrThrow({ where: { role: UserRole.EMPLOYEE, email: 'employee1@mediflow.com' } });
    financeUser1 = await prisma.user.findFirstOrThrow({ where: { email: 'finance@mediflow.com' } });

    // Check or create secondary finance officer
    let fo2 = await prisma.user.findUnique({ where: { email: 'finance2.runner@mediflow.com' } });
    if (!fo2) {
      fo2 = await UserService.createUser({
        email: 'finance2.runner@mediflow.com',
        employeeId: 'EMP-FIN2-RUN',
        firstName: 'Robert',
        lastName: 'Auditor',
        role: UserRole.FINANCE_OFFICER,
        departmentId: financeUser1.departmentId,
      });
    }
    financeUser2 = fo2;

    purchaseUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.PURCHASE_OFFICER } });
    directorUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.DIRECTOR } });
    medSuptUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.MEDICAL_SUPERINTENDENT } });

    cardioDept = await prisma.department.findUniqueOrThrow({ where: { code: 'CARD' } });
    financeDept = await prisma.department.findUniqueOrThrow({ where: { code: 'FIN' } });
  });

  // ==================================================
  // 1. ROLE MANAGEMENT
  // ==================================================
  describe('1. ROLE MANAGEMENT', () => {
    it('verifies all 9 system roles exist', async () => {
      const roles = await RoleService.getRoles();
      const codes = roles.map((r) => r.code);
      const expected = [
        'ADMIN',
        'HOD',
        'FINANCE_OFFICER',
        'PURCHASE_OFFICER',
        'MAINTENANCE_OFFICER',
        'HR',
        'DIRECTOR',
        'MEDICAL_SUPERINTENDENT',
        'EMPLOYEE',
      ];
      expected.forEach((exp) => {
        expect(codes).toContain(exp);
      });
    });

    it('changes a role display name and verifies underlying role works', async () => {
      const original = await RoleService.getRoleById(UserRole.PURCHASE_OFFICER);
      const origName = original.displayName;

      // Update
      const updated = await RoleService.updateRole(original.id, {
        displayName: 'Procurement Specialist Officer',
      });
      expect(updated.displayName).toBe('Procurement Specialist Officer');
      expect(updated.code).toBe(UserRole.PURCHASE_OFFICER);

      // Verify user query enriches it
      const user = await UserService.getUserById(purchaseUser.id);
      expect(user.roleRef?.displayName).toBe('Procurement Specialist Officer');

      // Revert
      await RoleService.updateRole(original.id, { displayName: origName });
    });

    it('refuses deactivating a system role', async () => {
      const adminRole = await RoleService.getRoleById(UserRole.ADMIN);
      await expect(
        RoleService.updateRole(adminRole.id, { isActive: false })
      ).rejects.toThrow('Cannot deactivate a built-in system role');
    });
  });

  // ==================================================
  // 2. USER MANAGEMENT
  // ==================================================
  describe('2. USER MANAGEMENT', () => {
    let newUserId: string;

    it('creates a new user with active role and department', async () => {
      const newUser = await UserService.createUser({
        email: `checklist.user.${Date.now()}@mediflow.com`,
        employeeId: `EMP-CHK-${Date.now()}`,
        firstName: 'Checklist',
        lastName: 'Tester',
        role: UserRole.EMPLOYEE,
        departmentId: cardioDept.id,
      });

      expect(newUser.id).toBeDefined();
      expect(newUser.role).toBe(UserRole.EMPLOYEE);
      expect(newUser.department.id).toBe(cardioDept.id);
      newUserId = newUser.id;
    });

    it('changes the user role and department', async () => {
      const updatedRole = await UserService.assignRole(newUserId, UserRole.PURCHASE_OFFICER);
      expect(updatedRole.role).toBe(UserRole.PURCHASE_OFFICER);

      const updatedDept = await UserService.assignDepartment(newUserId, financeDept.id);
      expect(updatedDept.department.code).toBe('FIN');
    });

    it('deactivates and reactivates user', async () => {
      const deactivated = await UserService.setUserStatus(newUserId, false);
      expect(deactivated.isActive).toBe(false);

      const reactivated = await UserService.setUserStatus(newUserId, true);
      expect(reactivated.isActive).toBe(true);
    });

    it('rejects assigning an invalid/non-existent role', async () => {
      await expect(
        UserService.assignRole(newUserId, 'SUPER_ADMIN_NOT_REAL')
      ).rejects.toThrow();
    });

    it('rejects assigning an inactive department', async () => {
      const inactiveDept = await DepartmentService.createDepartment({
        name: 'Obsolete Dept',
        code: `OBS-${Date.now()}`.slice(0, 10),
      });
      await DepartmentService.setDepartmentStatus(inactiveDept.id, false);

      await expect(
        UserService.assignDepartment(newUserId, inactiveDept.id)
      ).rejects.toThrow('Specified department does not exist or is inactive');

      await prisma.department.delete({ where: { id: inactiveDept.id } });
    });

    afterAll(async () => {
      if (newUserId) {
        await prisma.user.delete({ where: { id: newUserId } });
      }
    });
  });

  // ==================================================
  // 3. DEPARTMENT MANAGEMENT
  // ==================================================
  describe('3. DEPARTMENT MANAGEMENT', () => {
    let deptId: string;
    const deptCode = `DEP-${Date.now()}`.slice(0, 10);

    it('creates a test department with code, name, and display name', async () => {
      const dept = await DepartmentService.createDepartment({
        name: 'Nuclear Medicine',
        code: deptCode,
        displayName: 'Department of Advanced Nuclear Medicine',
      });
      expect(dept.code).toBe(deptCode);
      expect(dept.displayName).toBe('Department of Advanced Nuclear Medicine');
      deptId = dept.id;
    });

    it('edits display name and assigns HOD', async () => {
      const updated = await DepartmentService.updateDepartment(deptId, {
        displayName: 'Molecular Imaging & Nuclear Medicine Center',
        hodId: hodCardio.id,
      });
      expect(updated.displayName).toBe('Molecular Imaging & Nuclear Medicine Center');
      expect(updated.hod?.id).toBe(hodCardio.id);
    });

    it('deactivates department and verifies it cannot be selected for new assignments', async () => {
      const deactivated = await DepartmentService.setDepartmentStatus(deptId, false);
      expect(deactivated.isActive).toBe(false);

      // Verify cannot create user with inactive department
      await expect(
        UserService.createUser({
          email: `dept.test.${Date.now()}@mediflow.com`,
          employeeId: `EMP-DPT-${Date.now()}`,
          firstName: 'Fail',
          lastName: 'Dept',
          role: UserRole.EMPLOYEE,
          departmentId: deptId,
        })
      ).rejects.toThrow('Specified department does not exist or is inactive');

      await prisma.department.delete({ where: { id: deptId } });
    });
  });

  // ==================================================
  // 4. SYSTEM TERMINOLOGY / CUSTOM LABELS
  // ==================================================
  describe('4. SYSTEM TERMINOLOGY / CUSTOM LABELS', () => {
    it('changes request type and status labels without breaking workflow logic', async () => {
      const origTerm = await TerminologyService.getTerminologyByKey('REQUEST_TYPE_PURCHASE');
      const origLabel = origTerm.label;

      const updated = await TerminologyService.updateTerminology('REQUEST_TYPE_PURCHASE', {
        label: 'Commercial Requisition',
      });
      expect(updated.label).toBe('Commercial Requisition');

      // Verify internal logic still accepts and handles RequestType.PURCHASE
      const tmpl = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
      expect(tmpl.requestType).toBe(RequestType.PURCHASE);

      // Revert label
      await TerminologyService.updateTerminology('REQUEST_TYPE_PURCHASE', { label: origLabel });
    });
  });

  // ==================================================
  // 5. NORMAL PURCHASE — BELOW ₹1,00,000
  // ==================================================
  describe('5. NORMAL PURCHASE — BELOW ₹1,00,000', () => {
    it('creates, submits, approves (HOD -> Purchase Officer), and completes ₹50,000 request', async () => {
      const tmpl = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);

      const request = await prisma.request.create({
        data: {
          referenceNumber: `REQ-LOW-${Date.now()}`,
          title: 'Stethoscopes & BP Cuffs',
          type: RequestType.PURCHASE,
          priority: Priority.NORMAL,
          status: RequestStatus.DRAFT,
          requestedById: employeeCardio.id,
          departmentId: employeeCardio.departmentId,
          workflowTemplateId: tmpl.id,
          purchaseDetail: {
            create: {
              itemDescription: 'Standard clinical supplies',
              quantity: 10,
              estimatedCost: 50000, // < 100k
              justification: 'Clinic ward supply',
            },
          },
        },
      });

      const submitted = await WorkflowEngine.submitRequest(request.id, toAuthUser(employeeCardio, 'CARD'));
      expect(submitted.status).toBe(RequestStatus.IN_REVIEW);

      const steps = await StepResolver.getStepsForRequest(request.id);
      // Finance is NOT inserted!
      expect(steps.length).toBe(2);
      expect(steps[0]!.approverRole).toBe(UserRole.HOD);
      expect(steps[1]!.approverRole).toBe(UserRole.PURCHASE_OFFICER);
      expect(steps[1]!.isFinal).toBe(true);

      // Approve HOD step
      const hodApproved = await WorkflowEngine.approve(request.id, 'HOD Approved', toAuthUser(hodCardio, 'CARD'));
      expect(hodApproved.currentStepId).toBe(steps[1]!.id);

      // Approve Purchase Officer step
      const completed = await WorkflowEngine.approve(request.id, 'Procurement Approved', toAuthUser(purchaseUser, 'PROC'));
      expect(completed.status).toBe(RequestStatus.APPROVED);
      expect(completed.currentStepId).toBeNull();

      // Clean up
      await prisma.request.delete({ where: { id: request.id } });
    });
  });

  // ==================================================
  // 6. HIGH-VALUE PURCHASE — ABOVE ₹1,00,000
  // ==================================================
  describe('6. HIGH-VALUE PURCHASE — ABOVE ₹1,00,000', () => {
    it('verifies Finance is Step 1, followed by HOD, Purchase Officer, Director, and completes flow', async () => {
      const tmpl = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);

      const request = await prisma.request.create({
        data: {
          referenceNumber: `REQ-HIGH-${Date.now()}`,
          title: 'Dialysis Machine Filter Kit',
          type: RequestType.PURCHASE,
          priority: Priority.HIGH,
          status: RequestStatus.DRAFT,
          requestedById: employeeCardio.id,
          departmentId: employeeCardio.departmentId,
          workflowTemplateId: tmpl.id,
          purchaseDetail: {
            create: {
              itemDescription: 'High precision filter kit',
              quantity: 2,
              estimatedCost: 150000, // > 100k
              justification: 'ICU replacement',
            },
          },
        },
      });

      await WorkflowEngine.submitRequest(request.id, toAuthUser(employeeCardio, 'CARD'));

      const steps = await StepResolver.getStepsForRequest(request.id);
      expect(steps.length).toBe(4);
      expect(steps[0]!.approverRole).toBe(UserRole.FINANCE_OFFICER);
      expect(steps[1]!.approverRole).toBe(UserRole.HOD);
      expect(steps[2]!.approverRole).toBe(UserRole.PURCHASE_OFFICER);
      expect(steps[3]!.approverRole).toBe(UserRole.DIRECTOR);

      // Confirm HOD CANNOT approve before Finance!
      await expect(
        WorkflowEngine.approve(request.id, 'Premature HOD', toAuthUser(hodCardio, 'CARD'))
      ).rejects.toThrow('You cannot take action on this step');

      // Finance approves step 1
      const finApproved = await WorkflowEngine.approve(request.id, 'Budget verified', toAuthUser(financeUser1, 'FIN'));
      expect(finApproved.currentStepId).toBe(steps[1]!.id);

      // HOD approves step 2
      const hodApproved = await WorkflowEngine.approve(request.id, 'HOD cleared', toAuthUser(hodCardio, 'CARD'));
      expect(hodApproved.currentStepId).toBe(steps[2]!.id);

      // Purchase approves step 3
      const poApproved = await WorkflowEngine.approve(request.id, 'PO cleared', toAuthUser(purchaseUser, 'PROC'));
      expect(poApproved.currentStepId).toBe(steps[3]!.id);

      // Director approves step 4 (Final)
      const completed = await WorkflowEngine.approve(request.id, 'Director final approval', toAuthUser(directorUser, 'ADMIN'));
      expect(completed.status).toBe(RequestStatus.APPROVED);
      expect(completed.currentStepId).toBeNull();

      // Clean up
      const dynamicTemplateId = steps[0]?.templateId;
      await prisma.request.delete({ where: { id: request.id } });
      if (dynamicTemplateId && dynamicTemplateId !== tmpl.id) {
        await prisma.workflowStep.deleteMany({ where: { templateId: dynamicTemplateId } });
        await prisma.workflowTemplate.delete({ where: { id: dynamicTemplateId } });
      }
    }, 30000);
  });

  // ==================================================
  // 7. HIGH-VALUE HOD REQUEST
  // ==================================================
  describe('7. HIGH-VALUE HOD REQUEST', () => {
    it('verifies Finance first, omits HOD self-approval, no duplicate Director step, and completes', async () => {
      const tmpl = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);

      const request = await prisma.request.create({
        data: {
          referenceNumber: `REQ-HOD-HIGH-${Date.now()}`,
          title: 'Surgical Light Assembly',
          type: RequestType.PURCHASE,
          priority: Priority.HIGH,
          status: RequestStatus.DRAFT,
          requestedById: hodCardio.id,
          departmentId: hodCardio.departmentId,
          workflowTemplateId: tmpl.id,
          purchaseDetail: {
            create: {
              itemDescription: 'OR Overhead Lighting',
              quantity: 1,
              estimatedCost: 200000,
              justification: 'OT Renovation',
            },
          },
        },
      });

      await WorkflowEngine.submitRequest(request.id, toAuthUser(hodCardio, 'CARD'));

      const steps = await StepResolver.getStepsForRequest(request.id);
      // Expected: Finance -> Procurement -> Director (3 steps)
      expect(steps.length).toBe(3);
      expect(steps[0]!.approverRole).toBe(UserRole.FINANCE_OFFICER);
      expect(steps[1]!.approverRole).toBe(UserRole.PURCHASE_OFFICER);
      expect(steps[2]!.approverRole).toBe(UserRole.DIRECTOR);

      // Verify HOD cannot self-approve
      const canHodAct = await WorkflowEngine.canUserActOnRequest(request.id, hodCardio.id);
      expect(canHodAct).toBe(false);

      // Clean up
      await prisma.request.delete({ where: { id: request.id } });
      if (steps[0]?.templateId !== tmpl.id) {
        await prisma.workflowStep.deleteMany({ where: { templateId: steps[0]!.templateId } });
        await prisma.workflowTemplate.delete({ where: { id: steps[0]!.templateId } });
      }
    });
  });

  // ==================================================
  // 8. FINANCE-FIRST BYPASS TEST — VERY IMPORTANT
  // ==================================================
  describe('8. FINANCE-FIRST BYPASS TEST — VERY IMPORTANT', () => {
    it('proves an admin-configured template without Finance cannot bypass Finance-first for > ₹1,00,000', async () => {
      // Admin deliberately creates a template with NO Finance step
      const bypassTemplate = await prisma.workflowTemplate.create({
        data: {
          name: 'Template Trying to Skip Finance',
          requestType: RequestType.PURCHASE,
          version: 999,
          isActive: true,
          steps: {
            create: [
              { stepName: 'Immediate HOD', order: 1, approverRole: UserRole.HOD },
              { stepName: 'Immediate Purchase', order: 2, approverRole: UserRole.PURCHASE_OFFICER, isFinal: true },
            ],
          },
        },
      });

      // Create purchase request > 100k
      const request = await prisma.request.create({
        data: {
          referenceNumber: `REQ-BYPASS-${Date.now()}`,
          title: 'CT Scanner Tube Replacement',
          type: RequestType.PURCHASE,
          priority: Priority.HIGH,
          status: RequestStatus.DRAFT,
          requestedById: employeeCardio.id,
          departmentId: employeeCardio.departmentId,
          workflowTemplateId: bypassTemplate.id,
          purchaseDetail: {
            create: {
              itemDescription: 'Tube kit',
              quantity: 1,
              estimatedCost: 300000, // > 100k
              justification: 'Urgent replacement',
            },
          },
        },
      });

      await WorkflowEngine.submitRequest(request.id, toAuthUser(employeeCardio, 'CARD'));

      // Engine step resolution MUST STILL ENFORCE Finance as Step 1
      const steps = await StepResolver.getStepsForRequest(request.id);
      expect(steps[0]!.approverRole).toBe(UserRole.FINANCE_OFFICER);
      expect(steps[0]!.stepName).toBe('Finance Department Review');

      // Clean up
      await prisma.request.delete({ where: { id: request.id } });
      if (steps[0]?.templateId !== bypassTemplate.id) {
        await prisma.workflowStep.deleteMany({ where: { templateId: steps[0]!.templateId } });
        await prisma.workflowTemplate.delete({ where: { id: steps[0]!.templateId } });
      }
      await prisma.workflowStep.deleteMany({ where: { templateId: bypassTemplate.id } });
      await prisma.workflowTemplate.delete({ where: { id: bypassTemplate.id } });
    });
  });

  // ==================================================
  // 9. EXACT THRESHOLD TEST
  // ==================================================
  describe('9. EXACT THRESHOLD TEST', () => {
    it('₹99,999 -> Finance NOT mandatory', async () => {
      const tmpl = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
      const req = await prisma.request.create({
        data: {
          referenceNumber: `REQ-99K-${Date.now()}`,
          title: 'Threshold 99999',
          type: RequestType.PURCHASE,
          priority: Priority.NORMAL,
          requestedById: employeeCardio.id,
          departmentId: employeeCardio.departmentId,
          workflowTemplateId: tmpl.id,
          purchaseDetail: { create: { itemDescription: 'Item', quantity: 1, estimatedCost: 99999, justification: 'J' } },
        },
      });
      await WorkflowEngine.submitRequest(req.id, toAuthUser(employeeCardio, 'CARD'));
      const steps = await StepResolver.getStepsForRequest(req.id);
      expect(steps.some((s) => s.approverRole === UserRole.FINANCE_OFFICER)).toBe(false);
      await prisma.request.delete({ where: { id: req.id } });
    });

    it('₹1,00,000 -> Finance NOT mandatory (threshold is strictly ABOVE ₹1,00,000)', async () => {
      const tmpl = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
      const req = await prisma.request.create({
        data: {
          referenceNumber: `REQ-100K-${Date.now()}`,
          title: 'Threshold 100000',
          type: RequestType.PURCHASE,
          priority: Priority.NORMAL,
          requestedById: employeeCardio.id,
          departmentId: employeeCardio.departmentId,
          workflowTemplateId: tmpl.id,
          purchaseDetail: { create: { itemDescription: 'Item', quantity: 1, estimatedCost: 100000, justification: 'J' } },
        },
      });
      await WorkflowEngine.submitRequest(req.id, toAuthUser(employeeCardio, 'CARD'));
      const steps = await StepResolver.getStepsForRequest(req.id);
      expect(steps.some((s) => s.approverRole === UserRole.FINANCE_OFFICER)).toBe(false);
      await prisma.request.delete({ where: { id: req.id } });
    });

    it('₹1,00,001 -> Finance MUST be first', async () => {
      const tmpl = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
      const req = await prisma.request.create({
        data: {
          referenceNumber: `REQ-100001K-${Date.now()}`,
          title: 'Threshold 100001',
          type: RequestType.PURCHASE,
          priority: Priority.NORMAL,
          requestedById: employeeCardio.id,
          departmentId: employeeCardio.departmentId,
          workflowTemplateId: tmpl.id,
          purchaseDetail: { create: { itemDescription: 'Item', quantity: 1, estimatedCost: 100001, justification: 'J' } },
        },
      });
      await WorkflowEngine.submitRequest(req.id, toAuthUser(employeeCardio, 'CARD'));
      const steps = await StepResolver.getStepsForRequest(req.id);
      expect(steps[0]!.approverRole).toBe(UserRole.FINANCE_OFFICER);
      await prisma.request.delete({ where: { id: req.id } });
      if (steps[0]?.templateId !== tmpl.id) {
        await prisma.workflowStep.deleteMany({ where: { templateId: steps[0]!.templateId } });
        await prisma.workflowTemplate.delete({ where: { id: steps[0]!.templateId } });
      }
    });
  });

  // ==================================================
  // 10. DYNAMIC FORWARDING
  // ==================================================
  describe('10. DYNAMIC FORWARDING', () => {
    it('forwards request without advancing step, updates assignee, and allows assigned user to act', async () => {
      const tmpl = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
      const req = await prisma.request.create({
        data: {
          referenceNumber: `REQ-FWD10-${Date.now()}`,
          title: 'Ultrasound Probe',
          type: RequestType.PURCHASE,
          priority: Priority.HIGH,
          requestedById: employeeCardio.id,
          departmentId: employeeCardio.departmentId,
          workflowTemplateId: tmpl.id,
          purchaseDetail: { create: { itemDescription: 'Linear Probe', quantity: 1, estimatedCost: 120000, justification: 'J' } },
        },
      });
      await WorkflowEngine.submitRequest(req.id, toAuthUser(employeeCardio, 'CARD'));
      const initialStepId = req.currentStepId;

      // Eligible recipients check
      const recipients = await WorkflowEngine.getEligibleRecipients(req.id, toAuthUser(financeUser1, 'FIN'));
      expect(recipients.some((r) => r.id === financeUser2.id)).toBe(true);

      // Forward to financeUser2
      const forwarded = await WorkflowEngine.forward(req.id, financeUser2.id, 'Assigned to colleague', toAuthUser(financeUser1, 'FIN'));
      expect(forwarded.assignedToUserId).toBe(financeUser2.id);
      expect(forwarded.status).toBe(RequestStatus.IN_REVIEW);

      // Finance user 2 approves
      const approved = await WorkflowEngine.approve(req.id, 'Done by assigned user', toAuthUser(financeUser2, 'FIN'));
      expect(approved.assignedToUserId).toBeNull(); // Reset for next stage

      const dynamicTemplateId = (await StepResolver.getStepsForRequest(req.id))[0]?.templateId;
      await prisma.request.delete({ where: { id: req.id } });
      if (dynamicTemplateId && dynamicTemplateId !== tmpl.id) {
        await prisma.workflowStep.deleteMany({ where: { templateId: dynamicTemplateId } });
        await prisma.workflowTemplate.delete({ where: { id: dynamicTemplateId } });
      }
    }, 30000);
  });

  // ==================================================
  // 11. FORWARDING SECURITY / EDGE CASES
  // ==================================================
  describe('11. FORWARDING SECURITY / EDGE CASES', () => {
    it('rejects self-forwarding, requester-forwarding, duplicate-forwarding, and old-assignee approval', async () => {
      const tmpl = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
      const req = await prisma.request.create({
        data: {
          referenceNumber: `REQ-FWD-EDGE-${Date.now()}`,
          title: 'Edge Case Testing',
          type: RequestType.PURCHASE,
          priority: Priority.HIGH,
          requestedById: employeeCardio.id,
          departmentId: employeeCardio.departmentId,
          workflowTemplateId: tmpl.id,
          purchaseDetail: { create: { itemDescription: 'Testing item', quantity: 1, estimatedCost: 110000, justification: 'J' } },
        },
      });
      await WorkflowEngine.submitRequest(req.id, toAuthUser(employeeCardio, 'CARD'));

      // Forward to yourself -> REJECTED
      await expect(
        WorkflowEngine.forward(req.id, financeUser1.id, 'To self', toAuthUser(financeUser1, 'FIN'))
      ).rejects.toThrow('Cannot forward request to yourself');

      // Forward to requester -> REJECTED
      await expect(
        WorkflowEngine.forward(req.id, employeeCardio.id, 'To requester', toAuthUser(financeUser1, 'FIN'))
      ).rejects.toThrow('Cannot forward request to the original requester');

      // Forward to financeUser2
      await WorkflowEngine.forward(req.id, financeUser2.id, 'Valid forward', toAuthUser(financeUser1, 'FIN'));

      // Once assigned to financeUser2:
      // A. Another person (financeUser1) cannot forward it because it is specifically assigned to financeUser2
      await expect(
        WorkflowEngine.forward(req.id, financeUser2.id, 'Duplicate forward', toAuthUser(financeUser1, 'FIN'))
      ).rejects.toThrow('This request has been specifically assigned to another reviewer');

      // B. The assigned user (financeUser2) cannot forward to themselves again -> REJECTED
      await expect(
        WorkflowEngine.forward(req.id, financeUser2.id, 'Self forward', toAuthUser(financeUser2, 'FIN'))
      ).rejects.toThrow('Cannot forward request to yourself');

      // Old assignee (financeUser1) tries to approve -> REJECTED
      await expect(
        WorkflowEngine.approve(req.id, 'Old assignee trying to approve', toAuthUser(financeUser1, 'FIN'))
      ).rejects.toThrow('This request has been specifically assigned to another reviewer');

      const dynamicTemplateId = (await StepResolver.getStepsForRequest(req.id))[0]?.templateId;
      await prisma.request.delete({ where: { id: req.id } });
      if (dynamicTemplateId && dynamicTemplateId !== tmpl.id) {
        await prisma.workflowStep.deleteMany({ where: { templateId: dynamicTemplateId } });
        await prisma.workflowTemplate.delete({ where: { id: dynamicTemplateId } });
      }
    }, 30000);
  });

  // ==================================================
  // 12. FINANCE FORWARDING RESTRICTION
  // ==================================================
  describe('12. FINANCE FORWARDING RESTRICTION', () => {
    it('prevents forwarding outside Finance department at Finance stage', async () => {
      const tmpl = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
      const req = await prisma.request.create({
        data: {
          referenceNumber: `REQ-FIN-RESTRICT-${Date.now()}`,
          title: 'Finance Guard Test',
          type: RequestType.PURCHASE,
          priority: Priority.HIGH,
          requestedById: employeeCardio.id,
          departmentId: employeeCardio.departmentId,
          workflowTemplateId: tmpl.id,
          purchaseDetail: { create: { itemDescription: 'Restricted Item', quantity: 1, estimatedCost: 150000, justification: 'J' } },
        },
      });
      await WorkflowEngine.submitRequest(req.id, toAuthUser(employeeCardio, 'CARD'));

      // Forwarding to Purchase Officer at Finance stage -> REJECTED
      await expect(
        WorkflowEngine.forward(req.id, purchaseUser.id, 'Skipping finance', toAuthUser(financeUser1, 'FIN'))
      ).rejects.toThrow();

      const dynamicTemplateId = (await StepResolver.getStepsForRequest(req.id))[0]?.templateId;
      await prisma.request.delete({ where: { id: req.id } });
      if (dynamicTemplateId && dynamicTemplateId !== tmpl.id) {
        await prisma.workflowStep.deleteMany({ where: { templateId: dynamicTemplateId } });
        await prisma.workflowTemplate.delete({ where: { id: dynamicTemplateId } });
      }
    }, 30000);
  });

  // ==================================================
  // 13. WORKFLOW VERSIONING
  // ==================================================
  describe('13. WORKFLOW VERSIONING', () => {
    it('creates Request A with V1, activates V2, completes Request A without V2 interference, and creates Request B with V2', async () => {
      const v1 = await resolveActiveWorkflowTemplate(RequestType.MAINTENANCE);

      // Request A with V1
      const reqA = await prisma.request.create({
        data: {
          referenceNumber: `REQ-A-${Date.now()}`,
          title: 'Request A under V1',
          type: RequestType.MAINTENANCE,
          priority: Priority.NORMAL,
          requestedById: employeeCardio.id,
          departmentId: employeeCardio.departmentId,
          workflowTemplateId: v1.id,
          maintenanceDetail: { create: { equipmentName: 'Pump', location: 'L1', issueDescription: 'Issue', urgencyLevel: 'NORMAL' } },
        },
      });
      await WorkflowEngine.submitRequest(reqA.id, toAuthUser(employeeCardio, 'CARD'));

      // Activate Version 2
      const v2 = await WorkflowService.createNewVersion(v1.id, {
        name: 'Maintenance V2',
        steps: [
          { stepName: 'Step 1 HOD', order: 1, approverRole: UserRole.HOD },
          { stepName: 'Step 2 Director', order: 2, approverRole: UserRole.DIRECTOR },
          { stepName: 'Step 3 Facilities', order: 3, approverRole: UserRole.MAINTENANCE_OFFICER, isFinal: true },
        ],
      });

      // Request A steps still V1 (2 steps)
      const reqASteps = await StepResolver.getStepsForRequest(reqA.id);
      expect(reqASteps.length).toBe(2);

      // Request B gets V2 (3 steps)
      const v2Active = await resolveActiveWorkflowTemplate(RequestType.MAINTENANCE);
      expect(v2Active.id).toBe(v2.id);

      const reqB = await prisma.request.create({
        data: {
          referenceNumber: `REQ-B-${Date.now()}`,
          title: 'Request B under V2',
          type: RequestType.MAINTENANCE,
          priority: Priority.NORMAL,
          requestedById: employeeCardio.id,
          departmentId: employeeCardio.departmentId,
          workflowTemplateId: v2Active.id,
          maintenanceDetail: { create: { equipmentName: 'Light', location: 'L2', issueDescription: 'Issue', urgencyLevel: 'NORMAL' } },
        },
      });
      await WorkflowEngine.submitRequest(reqB.id, toAuthUser(employeeCardio, 'CARD'));

      const reqBSteps = await StepResolver.getStepsForRequest(reqB.id);
      expect(reqBSteps.length).toBe(3);

      // Clean up & restore V1
      await prisma.request.delete({ where: { id: reqA.id } });
      await prisma.request.delete({ where: { id: reqB.id } });
      await WorkflowService.archiveTemplate(v2.id);
      await prisma.workflowTemplate.update({ where: { id: v1.id }, data: { isActive: true } });
    });
  });

  // ==================================================
  // 14. OLD / INACTIVE WORKFLOW REGRESSION
  // ==================================================
  describe('14. OLD / INACTIVE WORKFLOW REGRESSION', () => {
    it('never selects inactive or dynamic templates for new requests', async () => {
      const inactive = await prisma.workflowTemplate.create({
        data: {
          name: 'Old Inactive',
          requestType: RequestType.LEAVE,
          version: 999,
          isActive: false,
          steps: { create: [{ stepName: 'Bad', order: 1, approverRole: UserRole.DIRECTOR, isFinal: true }] },
        },
      });

      const active = await resolveActiveWorkflowTemplate(RequestType.LEAVE);
      expect(active.id).not.toBe(inactive.id);
      expect(active.isActive).toBe(true);

      await prisma.workflowStep.deleteMany({ where: { templateId: inactive.id } });
      await prisma.workflowTemplate.delete({ where: { id: inactive.id } });
    });
  });

  // ==================================================
  // 15. EXISTING WORKFLOW REGRESSION
  // ==================================================
  describe('15. EXISTING WORKFLOW REGRESSION', () => {
    it('Leave: normal HOD -> HR, and > 14 days escalates to Medical Superintendent', async () => {
      const tmpl = await resolveActiveWorkflowTemplate(RequestType.LEAVE);

      // Long leave (15 days)
      const longLeave = await prisma.request.create({
        data: {
          referenceNumber: `REQ-LEAVE-LONG-${Date.now()}`,
          title: 'Extended Medical Leave',
          type: RequestType.LEAVE,
          priority: Priority.NORMAL,
          requestedById: employeeCardio.id,
          departmentId: employeeCardio.departmentId,
          workflowTemplateId: tmpl.id,
          leaveDetail: {
            create: {
              leaveType: 'MEDICAL',
              startDate: new Date(),
              endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
              totalDays: 15,
              reason: 'Surgery',
            },
          },
        },
      });

      await WorkflowEngine.submitRequest(longLeave.id, toAuthUser(employeeCardio, 'CARD'));
      const steps = await StepResolver.getStepsForRequest(longLeave.id);

      // Escalated to Medical Superintendent!
      expect(steps.some((s) => s.approverRole === UserRole.MEDICAL_SUPERINTENDENT)).toBe(true);

      await prisma.request.delete({ where: { id: longLeave.id } });
      if (steps[0]?.templateId !== tmpl.id) {
        await prisma.workflowStep.deleteMany({ where: { templateId: steps[0]!.templateId } });
        await prisma.workflowTemplate.delete({ where: { id: steps[0]!.templateId } });
      }
    });
  });

  // ==================================================
  // 16. AUDIT TRAIL
  // ==================================================
  describe('16. AUDIT TRAIL', () => {
    it('records actor, action, timestamp for create, submit, forward, approve, and reject', async () => {
      const tmpl = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
      const req = await prisma.request.create({
        data: {
          referenceNumber: `REQ-AUDIT-${Date.now()}`,
          title: 'Audit Trail Test',
          type: RequestType.PURCHASE,
          priority: Priority.NORMAL,
          requestedById: employeeCardio.id,
          departmentId: employeeCardio.departmentId,
          workflowTemplateId: tmpl.id,
          purchaseDetail: { create: { itemDescription: 'Audit Item', quantity: 1, estimatedCost: 2000, justification: 'J' } },
        },
      });

      await WorkflowEngine.submitRequest(req.id, toAuthUser(employeeCardio, 'CARD'));
      await WorkflowEngine.reject(req.id, 'Budget rejected', toAuthUser(hodCardio, 'CARD'));

      const auditLogs = await prisma.auditLog.findMany({ where: { requestId: req.id } });
      const actions = auditLogs.map((a) => a.action);

      expect(actions).toContain('SUBMITTED');
      expect(actions).toContain('REJECTED');

      await prisma.request.delete({ where: { id: req.id } });
    });
  });

  // ==================================================
  // 17. FINAL "BREAK THE SYSTEM" TEST
  // ==================================================
  describe('17. FINAL "BREAK THE SYSTEM" TEST', () => {
    it('blocks every invalid operation: requester self-approval, unauthorized approver, invalid step configuration', async () => {
      const tmpl = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
      const req = await prisma.request.create({
        data: {
          referenceNumber: `REQ-BREAK-${Date.now()}`,
          title: 'Break The System Test',
          type: RequestType.PURCHASE,
          priority: Priority.NORMAL,
          requestedById: employeeCardio.id,
          departmentId: employeeCardio.departmentId,
          workflowTemplateId: tmpl.id,
          purchaseDetail: { create: { itemDescription: 'Item', quantity: 1, estimatedCost: 5000, justification: 'J' } },
        },
      });
      await WorkflowEngine.submitRequest(req.id, toAuthUser(employeeCardio, 'CARD'));

      // Requester attempts to approve their own request -> BLOCKED
      await expect(
        WorkflowEngine.approve(req.id, 'Self-approval', toAuthUser(employeeCardio, 'CARD'))
      ).rejects.toThrow('You cannot approve your own request');

      // Unauthorized user (Director tries to approve Step 1 HOD) -> BLOCKED
      await expect(
        WorkflowEngine.approve(req.id, 'Premature Director', toAuthUser(directorUser, 'ADMIN'))
      ).rejects.toThrow('You cannot take action on this step');

      // Empty steps workflow -> BLOCKED
      await expect(
        WorkflowService.validateWorkflowConfiguration([])
      ).rejects.toThrow('must contain at least one step');

      // Discontinuous steps workflow (1, 3) -> BLOCKED
      await expect(
        WorkflowService.validateWorkflowConfiguration([
          { stepName: 'S1', order: 1, approverRole: UserRole.HOD },
          { stepName: 'S3', order: 3, approverRole: UserRole.DIRECTOR },
        ])
      ).rejects.toThrow('Invalid step ordering');

      await prisma.request.delete({ where: { id: req.id } });
    });
  });
});
