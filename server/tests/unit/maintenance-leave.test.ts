import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../../src/db';
import { RequestService } from '../../src/request/request.service';
import { WorkflowEngine, AuthUser } from '../../src/core/WorkflowEngine';
import { StepResolver } from '../../src/core/StepResolver';
import { RequestStatus, RequestType, Priority, UserRole } from '@prisma/client';
import { AppError } from '../../src/middleware/errorHandler';

describe('Maintenance & Leave Request Integration and Edge Cases', () => {
  let employeeUser: any;
  let hodUser: any;
  let maintenanceUser: any;
  let hrUser: any;
  let medsuptUser: any;

  beforeAll(async () => {
    // Fetch seeded users for testing
    employeeUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.EMPLOYEE, department: { code: 'CARD' } } });
    hodUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.HOD, department: { code: 'CARD' } } });
    maintenanceUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.MAINTENANCE_OFFICER } });
    hrUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.HR } });
    medsuptUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.MEDICAL_SUPERINTENDENT } });
  });

  it('should successfully create, edit, submit, and approve a Maintenance request', async () => {
    const actorEmployee: AuthUser = {
      id: employeeUser.id,
      email: employeeUser.email,
      role: employeeUser.role,
      departmentId: employeeUser.departmentId,
      departmentCode: 'CARD',
      firstName: employeeUser.firstName,
      lastName: employeeUser.lastName,
    };

    // 1. Create Draft Maintenance Request
    const details = {
      equipmentName: 'ECG Monitor',
      location: 'Cardiology Room A',
      urgencyLevel: 'HIGH',
      issueDescription: 'Screen keeps flickering.',
      notes: 'Please contact Nurse Jenny.',
    };

    const req = await RequestService.createRequest({
      title: 'ECG Monitor flickering screen',
      type: RequestType.MAINTENANCE,
      priority: Priority.HIGH,
      details,
    }, actorEmployee);

    expect(req.type).toBe(RequestType.MAINTENANCE);
    expect(req.status).toBe(RequestStatus.DRAFT);

    // Verify it is created in MaintenanceDetail with plain text serialization
    const maintDetail = await prisma.maintenanceDetail.findUniqueOrThrow({
      where: { requestId: req.id },
    });
    expect(maintDetail.equipmentName).toBe('ECG Monitor');
    expect(maintDetail.location).toBe('Cardiology Room A');
    expect(maintDetail.urgencyLevel).toBe('HIGH');
    expect(maintDetail.issueDescription).toContain('Issue Description:\nScreen keeps flickering.');
    expect(maintDetail.issueDescription).toContain('Notes:\nPlease contact Nurse Jenny.');

    // 2. Edit Draft Maintenance Request
    const updatedDetails = {
      equipmentName: 'ECG Monitor V2',
      location: 'Cardiology Room B',
      urgencyLevel: 'EMERGENCY',
      issueDescription: 'Screen is completely black now.',
      notes: 'Urgent repair required.',
    };

    const edited = await RequestService.editRequest(req.id, {
      title: 'ECG Monitor completely black screen',
      priority: Priority.EMERGENCY,
      details: updatedDetails,
    }, actorEmployee);

    const maintDetailEdited = await prisma.maintenanceDetail.findUniqueOrThrow({
      where: { requestId: req.id },
    });
    expect(maintDetailEdited.equipmentName).toBe('ECG Monitor V2');
    expect(maintDetailEdited.location).toBe('Cardiology Room B');
    expect(maintDetailEdited.urgencyLevel).toBe('EMERGENCY');
    expect(maintDetailEdited.issueDescription).toContain('Screen is completely black now.');

    // 3. Submit request
    const submitted = await WorkflowEngine.submitRequest(req.id, actorEmployee);
    expect(submitted.status).toBe(RequestStatus.IN_REVIEW);

    // Verify steps resolved: HOD Approval -> Facilities Processing
    const steps = await StepResolver.getStepsForRequest(req.id);
    expect(steps.length).toBe(2);
    expect(steps[0]?.approverRole).toBe(UserRole.HOD);
    expect(steps[1]?.approverRole).toBe(UserRole.MAINTENANCE_OFFICER);

    // 4. HOD approves
    const actorHod: AuthUser = {
      id: hodUser.id,
      email: hodUser.email,
      role: hodUser.role,
      departmentId: hodUser.departmentId,
      departmentCode: 'CARD',
      firstName: hodUser.firstName,
      lastName: hodUser.lastName,
    };
    await WorkflowEngine.approve(req.id, 'HOD Approved', actorHod);

    // 5. Maintenance Officer approves
    const actorMaint: AuthUser = {
      id: maintenanceUser.id,
      email: maintenanceUser.email,
      role: maintenanceUser.role,
      departmentId: maintenanceUser.departmentId,
      departmentCode: 'FAC',
      firstName: maintenanceUser.firstName,
      lastName: maintenanceUser.lastName,
    };
    const completed = await WorkflowEngine.approve(req.id, 'Repair completed', actorMaint);
    expect(completed.status).toBe(RequestStatus.APPROVED);
    expect(completed.currentStepId).toBeNull();

    // Clean up
    await prisma.request.delete({ where: { id: req.id } });
  });

  it('should successfully calculate leave total days strictly on backend and inject Medical Superintendent for leaves > 14 days', async () => {
    const actorEmployee: AuthUser = {
      id: employeeUser.id,
      email: employeeUser.email,
      role: employeeUser.role,
      departmentId: employeeUser.departmentId,
      departmentCode: 'CARD',
      firstName: employeeUser.firstName,
      lastName: employeeUser.lastName,
    };

    // 15 days leave (triggers RULE_002)
    const startDate = '2026-08-01';
    const endDate = '2026-08-15';

    const details = {
      leaveType: 'Annual',
      startDate,
      endDate,
      totalDays: 1, // Will be ignored and calculated as 15 on backend
      reason: 'Medical recovery.',
      coveringStaff: 'Dr. John Doe',
    };

    const req = await RequestService.createRequest({
      title: '15 Days Sick Leave',
      type: RequestType.LEAVE,
      priority: Priority.NORMAL,
      details,
    }, actorEmployee);

    expect(req.status).toBe(RequestStatus.DRAFT);

    const leaveDetail = await prisma.leaveDetail.findUniqueOrThrow({
      where: { requestId: req.id },
    });
    // Verify client totalDays value was ignored and backend calculated 15 days
    expect(leaveDetail.totalDays).toBe(15);
    expect(leaveDetail.coveringStaff).toBe('Dr. John Doe');

    // Submit request
    await WorkflowEngine.submitRequest(req.id, actorEmployee);

    // Verify steps list contains 3 steps because totalDays > 14: HOD Approval -> Medical Superintendent Approval -> HR Processing
    const steps = await StepResolver.getStepsForRequest(req.id);
    expect(steps.length).toBe(3);
    expect(steps[0]?.approverRole).toBe(UserRole.HOD);
    expect(steps[1]?.approverRole).toBe(UserRole.MEDICAL_SUPERINTENDENT);
    expect(steps[2]?.approverRole).toBe(UserRole.HR);

    // Clean up request & dynamic template
    await prisma.request.delete({ where: { id: req.id } });
    await prisma.workflowTemplate.delete({ where: { id: steps[0]!.templateId } });
  });

  it('should reject Maintenance requests missing required details fields', async () => {
    const actorEmployee: AuthUser = {
      id: employeeUser.id,
      email: employeeUser.email,
      role: employeeUser.role,
      departmentId: employeeUser.departmentId,
      departmentCode: 'CARD',
      firstName: employeeUser.firstName,
      lastName: employeeUser.lastName,
    };

    // Missing location
    const details = {
      equipmentName: 'ECG Monitor',
      urgencyLevel: 'HIGH',
      issueDescription: 'Screen flickering.',
    };

    await expect(
      RequestService.createRequest({
        title: 'Broken ECG',
        type: RequestType.MAINTENANCE,
        priority: Priority.HIGH,
        details,
      }, actorEmployee)
    ).rejects.toThrow('Location is required.');
  });

  it('should reject Leave requests with invalid date ranges', async () => {
    const actorEmployee: AuthUser = {
      id: employeeUser.id,
      email: employeeUser.email,
      role: employeeUser.role,
      departmentId: employeeUser.departmentId,
      departmentCode: 'CARD',
      firstName: employeeUser.firstName,
      lastName: employeeUser.lastName,
    };

    // End date before start date
    const details = {
      leaveType: 'Annual',
      startDate: '2026-08-10',
      endDate: '2026-08-05',
      reason: 'Vacation',
    };

    await expect(
      RequestService.createRequest({
        title: 'Invalid Leave Dates',
        type: RequestType.LEAVE,
        priority: Priority.NORMAL,
        details,
      }, actorEmployee)
    ).rejects.toThrow('End date cannot be before the start date.');
  });

  it('should reject invalid urgencyLevel enum values', async () => {
    const actorEmployee: AuthUser = {
      id: employeeUser.id,
      email: employeeUser.email,
      role: employeeUser.role,
      departmentId: employeeUser.departmentId,
      departmentCode: 'CARD',
      firstName: employeeUser.firstName,
      lastName: employeeUser.lastName,
    };

    const details = {
      equipmentName: 'Patient Monitor',
      location: 'Ward B',
      urgencyLevel: 'SUPER_URGENT', // Invalid enum
      issueDescription: 'Battery failure.',
    };

    await expect(
      RequestService.createRequest({
        title: 'Urgency Test',
        type: RequestType.MAINTENANCE,
        priority: Priority.HIGH,
        details,
      }, actorEmployee)
    ).rejects.toThrow('Urgency level must be Low, Normal, High, or Emergency.');
  });

  it('should prevent editing requests that are already submitted, approved, or rejected', async () => {
    const actorEmployee: AuthUser = {
      id: employeeUser.id,
      email: employeeUser.email,
      role: employeeUser.role,
      departmentId: employeeUser.departmentId,
      departmentCode: 'CARD',
      firstName: employeeUser.firstName,
      lastName: employeeUser.lastName,
    };

    // Create Maintenance Request draft
    const req = await RequestService.createRequest({
      title: 'Maint Edit Test',
      type: RequestType.MAINTENANCE,
      priority: Priority.NORMAL,
      details: {
        equipmentName: 'AC Unit',
        location: 'Server Room',
        urgencyLevel: 'NORMAL',
        issueDescription: 'Not cooling.',
      },
    }, actorEmployee);

    // Submit it
    await WorkflowEngine.submitRequest(req.id, actorEmployee);

    // Attempt to edit after submission
    await expect(
      RequestService.editRequest(req.id, {
        title: 'Should fail',
        details: { equipmentName: 'AC Unit v2' },
      }, actorEmployee)
    ).rejects.toThrow('Only draft or returned requests can be edited.');

    // Clean up
    await prisma.request.delete({ where: { id: req.id } });
  });

  it('Leave date validation — same-day leave should be accepted (1 day)', async () => {
    const actorEmployee: AuthUser = {
      id: employeeUser.id,
      email: employeeUser.email,
      role: employeeUser.role,
      departmentId: employeeUser.departmentId,
      departmentCode: 'CARD',
      firstName: employeeUser.firstName,
      lastName: employeeUser.lastName,
    };

    const req = await RequestService.createRequest({
      title: 'Same Day Leave',
      type: RequestType.LEAVE,
      priority: Priority.NORMAL,
      details: {
        leaveType: 'Casual',
        startDate: '2026-09-01',
        endDate: '2026-09-01',
        reason: 'Personal work.',
      },
    }, actorEmployee);

    const leaveDetail = await prisma.leaveDetail.findUniqueOrThrow({ where: { requestId: req.id } });
    expect(leaveDetail.totalDays).toBe(1);

    await prisma.request.delete({ where: { id: req.id } });
  });

  it('Leave date validation — month boundary (Jan 31 → Feb 1) should be accepted', async () => {
    const actorEmployee: AuthUser = {
      id: employeeUser.id,
      email: employeeUser.email,
      role: employeeUser.role,
      departmentId: employeeUser.departmentId,
      departmentCode: 'CARD',
      firstName: employeeUser.firstName,
      lastName: employeeUser.lastName,
    };

    const req = await RequestService.createRequest({
      title: 'Month Boundary Leave',
      type: RequestType.LEAVE,
      priority: Priority.NORMAL,
      details: {
        leaveType: 'Annual',
        startDate: '2026-01-31',
        endDate: '2026-02-01',
        reason: 'Rest.',
      },
    }, actorEmployee);

    const leaveDetail = await prisma.leaveDetail.findUniqueOrThrow({ where: { requestId: req.id } });
    expect(leaveDetail.totalDays).toBe(2);

    await prisma.request.delete({ where: { id: req.id } });
  });

  it('Leave date validation — year boundary (Dec 31 → Jan 1 next year) should be accepted', async () => {
    const actorEmployee: AuthUser = {
      id: employeeUser.id,
      email: employeeUser.email,
      role: employeeUser.role,
      departmentId: employeeUser.departmentId,
      departmentCode: 'CARD',
      firstName: employeeUser.firstName,
      lastName: employeeUser.lastName,
    };

    const req = await RequestService.createRequest({
      title: 'Year Boundary Leave',
      type: RequestType.LEAVE,
      priority: Priority.NORMAL,
      details: {
        leaveType: 'Annual',
        startDate: '2026-12-31',
        endDate: '2027-01-01',
        reason: 'New Year.',
      },
    }, actorEmployee);

    const leaveDetail = await prisma.leaveDetail.findUniqueOrThrow({ where: { requestId: req.id } });
    expect(leaveDetail.totalDays).toBe(2);

    await prisma.request.delete({ where: { id: req.id } });
  });

  it('Leave date validation — leap year date (Feb 28 → Feb 29) should be accepted', async () => {
    const actorEmployee: AuthUser = {
      id: employeeUser.id,
      email: employeeUser.email,
      role: employeeUser.role,
      departmentId: employeeUser.departmentId,
      departmentCode: 'CARD',
      firstName: employeeUser.firstName,
      lastName: employeeUser.lastName,
    };

    // 2028 is a leap year
    const req = await RequestService.createRequest({
      title: 'Leap Year Leave',
      type: RequestType.LEAVE,
      priority: Priority.NORMAL,
      details: {
        leaveType: 'Sick',
        startDate: '2028-02-28',
        endDate: '2028-02-29',
        reason: 'Medical appointment.',
      },
    }, actorEmployee);

    const leaveDetail = await prisma.leaveDetail.findUniqueOrThrow({ where: { requestId: req.id } });
    expect(leaveDetail.totalDays).toBe(2);

    await prisma.request.delete({ where: { id: req.id } });
  });

  it('Leave date validation — end before start must be rejected by backend regardless of frontend', async () => {
    const actorEmployee: AuthUser = {
      id: employeeUser.id,
      email: employeeUser.email,
      role: employeeUser.role,
      departmentId: employeeUser.departmentId,
      departmentCode: 'CARD',
      firstName: employeeUser.firstName,
      lastName: employeeUser.lastName,
    };

    await expect(
      RequestService.createRequest({
        title: 'Invalid Date Range',
        type: RequestType.LEAVE,
        priority: Priority.NORMAL,
        details: {
          leaveType: 'Annual',
          startDate: '2026-08-10',
          endDate: '2026-08-05',
          reason: 'Test.',
        },
      }, actorEmployee)
    ).rejects.toThrow('End date cannot be before the start date.');
  });

  it('Leave date validation — invalid date format must be rejected by backend', async () => {
    const actorEmployee: AuthUser = {
      id: employeeUser.id,
      email: employeeUser.email,
      role: employeeUser.role,
      departmentId: employeeUser.departmentId,
      departmentCode: 'CARD',
      firstName: employeeUser.firstName,
      lastName: employeeUser.lastName,
    };

    await expect(
      RequestService.createRequest({
        title: 'Malformed Date',
        type: RequestType.LEAVE,
        priority: Priority.NORMAL,
        details: {
          leaveType: 'Annual',
          startDate: 'not-a-date',
          endDate: '2026-08-10',
          reason: 'Test.',
        },
      }, actorEmployee)
    ).rejects.toThrow('Invalid date format.');
  });
}, 30000);

