import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/db';
import { DepartmentService } from '../../src/services/department.service';
import { RoleService } from '../../src/services/role.service';
import { WorkflowService } from '../../src/services/workflow.service';
import { TerminologyService } from '../../src/services/terminology.service';
import { AuditService } from '../../src/services/audit.service';
import { RequestType, UserRole } from '@prisma/client';

describe('Administrative Configuration Audit Logging', { timeout: 30000 }, () => {
  let adminUser: any;
  const createdDeptIds: string[] = [];
  const createdTemplateIds: string[] = [];
  let originalPurchaseLabel: string;

  beforeAll(async () => {
    adminUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.ADMIN },
    });

    const origTerm = await TerminologyService.getTerminologyByKey('REQUEST_TYPE_PURCHASE');
    originalPurchaseLabel = origTerm.label;
  });

  afterAll(async () => {
    // 1. Restore terminology
    try {
      await TerminologyService.updateTerminology('REQUEST_TYPE_PURCHASE', {
        label: originalPurchaseLabel,
      });
    } catch {
      // ignore
    }

    // 2. Clean up workflow templates and steps
    if (createdTemplateIds.length > 0) {
      await prisma.workflowStep.deleteMany({
        where: { templateId: { in: createdTemplateIds } },
      });
      await prisma.workflowTemplate.deleteMany({
        where: { id: { in: createdTemplateIds } },
      });
    }

    // Restore canonical base General Operational Request template as active
    await prisma.workflowTemplate.updateMany({
      where: {
        name: 'General Operational Request',
        requestType: RequestType.GENERAL,
        deletedAt: null,
      },
      data: { isActive: true },
    });

    // 3. Clean up departments
    if (createdDeptIds.length > 0) {
      await prisma.department.deleteMany({
        where: { id: { in: createdDeptIds } },
      });
    }

    // 4. Clean up audit logs created for these test entities
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { action: 'DEPARTMENT_CREATED' },
          { action: 'DEPARTMENT_UPDATED' },
          { action: 'ROLE_UPDATED' },
          { action: 'WORKFLOW_TEMPLATE_CREATED' },
          { action: 'WORKFLOW_VERSION_CREATED' },
          { action: 'WORKFLOW_ARCHIVED' },
          { action: 'TERMINOLOGY_UPDATED' },
        ],
        timestamp: { gte: new Date(Date.now() - 60000) },
      },
    });
  });

  describe('1. Department Configuration Audit Logging', () => {
    it('creates an audit log entry atomically when a new department is created', async () => {
      const code = `TEST_AUD_${Date.now() % 10000}`;
      const dept = await DepartmentService.createDepartment(
        {
          name: `Audit Test Dept ${code}`,
          code,
          displayName: 'Audit Department',
        },
        adminUser
      );
      createdDeptIds.push(dept.id);

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'DEPARTMENT_CREATED',
          actorId: adminUser.id,
          description: { contains: code },
        },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.actorId).toBe(adminUser.id);
      expect(auditLog?.requestId).toBeNull();
      expect(auditLog?.description).toContain(`Department "Audit Test Dept ${code}" (${code}) was created.`);
    });

    it('creates an audit log entry when department properties are updated', async () => {
      const deptId = createdDeptIds[0]!;
      const updated = await DepartmentService.updateDepartment(
        deptId,
        {
          displayName: 'Renamed Audit Dept',
        },
        adminUser
      );

      expect(updated.displayName).toBe('Renamed Audit Dept');

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'DEPARTMENT_UPDATED',
          actorId: adminUser.id,
          description: { contains: 'Renamed Audit Dept' },
        },
        orderBy: { timestamp: 'desc' },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.actorId).toBe(adminUser.id);
      expect(auditLog?.description).toContain('Display name changed from "Audit Department" to "Renamed Audit Dept"');
    });

    it('does not create any audit log if department creation fails validation', async () => {
      const existingCode = (await prisma.department.findFirstOrThrow()).code;
      const initialLogs = await prisma.auditLog.count({
        where: { action: 'DEPARTMENT_CREATED' },
      });

      await expect(
        DepartmentService.createDepartment(
          {
            name: 'Duplicate Dept',
            code: existingCode,
          },
          adminUser
        )
      ).rejects.toThrow(`already exists`);

      const currentLogs = await prisma.auditLog.count({
        where: { action: 'DEPARTMENT_CREATED' },
      });
      expect(currentLogs).toBe(initialLogs);
    });
  });

  describe('2. Role Configuration Audit Logging', () => {
    it('creates an audit log entry when a role is updated', async () => {
      const role = await prisma.role.findFirstOrThrow({
        where: { code: UserRole.EMPLOYEE },
      });

      const originalDesc = role.description;
      const testDesc = `Updated description for audit test ${Date.now()}`;

      await RoleService.updateRole(
        role.id,
        {
          description: testDesc,
        },
        adminUser
      );

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'ROLE_UPDATED',
          actorId: adminUser.id,
          description: { contains: 'Description updated' },
        },
        orderBy: { timestamp: 'desc' },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.actorId).toBe(adminUser.id);
      expect(auditLog?.description).toContain(`Role "${role.code}" updated: Description updated.`);

      // Restore original description
      await RoleService.updateRole(role.id, { description: originalDesc ?? undefined }, adminUser);
    });

    it('does not create an audit log if role deactivation is rejected', async () => {
      const role = await prisma.role.findFirstOrThrow({
        where: { code: UserRole.ADMIN },
      });

      const initialLogs = await prisma.auditLog.count({
        where: { action: 'ROLE_UPDATED' },
      });

      await expect(
        RoleService.updateRole(role.id, { isActive: false }, adminUser)
      ).rejects.toThrow('Cannot deactivate a built-in system role');

      const currentLogs = await prisma.auditLog.count({
        where: { action: 'ROLE_UPDATED' },
      });
      expect(currentLogs).toBe(initialLogs);
    });
  });

  describe('3. Workflow Template Audit Logging', () => {
    let createdTemplate: any;

    it('creates an audit log when a new workflow template is created', async () => {
      const templateName = `Audit Test Workflow ${Date.now()}`;
      createdTemplate = await WorkflowService.createTemplate(
        {
          name: templateName,
          requestType: RequestType.GENERAL,
          steps: [
            { stepName: 'Initial Review', order: 1, approverRole: UserRole.HOD },
            { stepName: 'Final Approval', order: 2, approverRole: UserRole.DIRECTOR },
          ],
        },
        adminUser
      );
      createdTemplateIds.push(createdTemplate.id);

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'WORKFLOW_TEMPLATE_CREATED',
          actorId: adminUser.id,
          description: { contains: templateName },
        },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.actorId).toBe(adminUser.id);
      expect(auditLog?.description).toContain(`Workflow template "${templateName}"`);
      expect(auditLog?.description).toContain('with 2 steps');
    });

    it('creates an audit log when a new version of a workflow template is created', async () => {
      const newVersion = await WorkflowService.createNewVersion(
        createdTemplate.id,
        {
          steps: [
            { stepName: 'Step 1 - Review', order: 1, approverRole: UserRole.HOD },
            { stepName: 'Step 2 - Finance', order: 2, approverRole: UserRole.FINANCE_OFFICER },
            { stepName: 'Step 3 - Final Approval', order: 3, approverRole: UserRole.DIRECTOR },
          ],
        },
        adminUser
      );
      createdTemplateIds.push(newVersion.id);

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'WORKFLOW_VERSION_CREATED',
          actorId: adminUser.id,
          description: { contains: `New version v${newVersion.version}` },
        },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.actorId).toBe(adminUser.id);
      expect(auditLog?.description).toContain(`with 3 steps`);
    });

    it('creates an audit log when a workflow template is archived', async () => {
      // Archive the original created template (which is inactive now because newVersion is active)
      await WorkflowService.archiveTemplate(createdTemplate.id, adminUser);

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'WORKFLOW_ARCHIVED',
          actorId: adminUser.id,
          description: { contains: createdTemplate.name },
        },
        orderBy: { timestamp: 'desc' },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.actorId).toBe(adminUser.id);
      expect(auditLog?.description).toContain('was archived');
    });

    it('does not create an audit log if workflow creation fails validation', async () => {
      const initialLogs = await prisma.auditLog.count({
        where: { action: 'WORKFLOW_TEMPLATE_CREATED' },
      });

      await expect(
        WorkflowService.createTemplate(
          {
            name: 'Invalid Workflow',
            requestType: RequestType.GENERAL,
            steps: [], // empty steps rejected
          },
          adminUser
        )
      ).rejects.toThrow();

      const currentLogs = await prisma.auditLog.count({
        where: { action: 'WORKFLOW_TEMPLATE_CREATED' },
      });
      expect(currentLogs).toBe(initialLogs);
    });
  });

  describe('4. Terminology Audit Logging', () => {
    it('creates an audit log when a terminology label is updated', async () => {
      const testLabel = `Purchasing & Proc ${Date.now() % 1000}`;
      await TerminologyService.updateTerminology(
        'REQUEST_TYPE_PURCHASE',
        {
          label: testLabel,
        },
        adminUser
      );

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'TERMINOLOGY_UPDATED',
          actorId: adminUser.id,
          description: { contains: testLabel },
        },
        orderBy: { timestamp: 'desc' },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.actorId).toBe(adminUser.id);
      expect(auditLog?.description).toContain(`System terminology "REQUEST_TYPE_PURCHASE" updated: Label changed from`);
      expect(auditLog?.description).toContain(`to "${testLabel}"`);
    });

    it('does not create an audit log if terminology update has empty label', async () => {
      const initialLogs = await prisma.auditLog.count({
        where: { action: 'TERMINOLOGY_UPDATED' },
      });

      await expect(
        TerminologyService.updateTerminology(
          'REQUEST_TYPE_PURCHASE',
          {
            label: '   ',
          },
          adminUser
        )
      ).rejects.toThrow('Display label is required');

      const currentLogs = await prisma.auditLog.count({
        where: { action: 'TERMINOLOGY_UPDATED' },
      });
      expect(currentLogs).toBe(initialLogs);
    });
  });

  describe('5. Audit Service Querying & Enrichment', () => {
    it('retrieves administrative audit logs with enriched actor and null requestId', async () => {
      const result = await AuditService.getAuditLogs({
        action: 'DEPARTMENT_CREATED',
        actorId: adminUser.id,
        limit: 5,
      });

      expect(result.items.length).toBeGreaterThan(0);
      const log = result.items[0]!;
      expect(log.action).toBe('DEPARTMENT_CREATED');
      expect(log.requestId).toBeNull();
      expect(log.request).toBeNull();
      expect(log.actor).toBeDefined();
      expect(log.actor?.id).toBe(adminUser.id);
      expect(log.actor?.email).toBe(adminUser.email);
      // Ensure no passwords or hashes leak
      expect((log.actor as any).password).toBeUndefined();
      expect((log.actor as any).passwordHash).toBeUndefined();
    });
  });
});

