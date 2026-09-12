import { PrismaClient, RequestType, UserRole, RequestStatus, Priority, ApprovalActionType } from '@prisma/client';
import 'dotenv/config';
import bcrypt from 'bcrypt';

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting comprehensive MediFlow seed...');

  // 0. Clear existing data in dependency order
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.approvalAction.deleteMany();
  await prisma.maintenanceDetail.deleteMany();
  await prisma.purchaseDetail.deleteMany();
  await prisma.leaveDetail.deleteMany();
  await prisma.request.deleteMany();
  await prisma.workflowStep.deleteMany();
  await prisma.workflowTemplate.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.role.deleteMany();
  await prisma.systemTerminology.deleteMany();

  // 1. Roles (authoritative system roles with customizable display names)
  const roleDefinitions = [
    { code: UserRole.ADMIN, displayName: 'System Administrator', description: 'Full system configuration, workflow, and user management', isSystem: true },
    { code: UserRole.DIRECTOR, displayName: 'Hospital Director', description: 'Executive authority for high-value and institutional approvals', isSystem: true },
    { code: UserRole.MEDICAL_SUPERINTENDENT, displayName: 'Medical Superintendent', description: 'Clinical administration and extended leave oversight', isSystem: true },
    { code: UserRole.HOD, displayName: 'Head of Department', description: 'Primary departmental approval for team staff requests', isSystem: true },
    { code: UserRole.HR, displayName: 'Human Resources', description: 'Leave administration and personnel lifecycle processing', isSystem: true },
    { code: UserRole.PURCHASE_OFFICER, displayName: 'Procurement Officer', description: 'Procurement analysis, vendor quotes, and PO processing', isSystem: true },
    { code: UserRole.MAINTENANCE_OFFICER, displayName: 'Facilities Officer', description: 'Equipment repair, facility work orders, and maintenance', isSystem: true },
    { code: UserRole.FINANCE_OFFICER, displayName: 'Finance Officer', description: 'Financial clearance and budgetary review for qualifying expenditures', isSystem: true },
    { code: UserRole.EMPLOYEE, displayName: 'Hospital Staff', description: 'General hospital employee and request originator', isSystem: true },
  ];

  const createdRoles = await Promise.all(
    roleDefinitions.map((r) => prisma.role.create({ data: r }))
  );
  const getRoleId = (code: UserRole) => createdRoles.find((r) => r.code === code)!.id;

  // 2. Departments
  const deps = [
    { name: 'Cardiology', code: 'CARD', displayName: 'Cardiology Department' },
    { name: 'Information Technology', code: 'IT', displayName: 'IT & Bio-Medical Engineering' },
    { name: 'Human Resources', code: 'HR', displayName: 'Human Resources' },
    { name: 'Procurement', code: 'PROC', displayName: 'Procurement & Supply Chain' },
    { name: 'Facilities', code: 'FAC', displayName: 'Facilities & Maintenance' },
    { name: 'Administration', code: 'ADMIN', displayName: 'Hospital Administration' },
    { name: 'Finance', code: 'FIN', displayName: 'Finance & Accounts Department' },
  ];

  const createdDeps = await Promise.all(
    deps.map((d) => prisma.department.create({ data: d }))
  );

  const getDep = (code: string) => createdDeps.find((d) => d.code === code)!.id;

  // 3. Users
  const passwordHash = await bcrypt.hash('password123', 10);

  const userSeedData = [
    { email: 'admin@mediflow.com', employeeId: 'EMP-001', firstName: 'System', lastName: 'Admin', role: UserRole.ADMIN, departmentId: getDep('IT') },
    { email: 'director@mediflow.com', employeeId: 'EMP-002', firstName: 'Hospital', lastName: 'Director', role: UserRole.DIRECTOR, departmentId: getDep('ADMIN') },
    { email: 'medsupt@mediflow.com', employeeId: 'EMP-003', firstName: 'Medical', lastName: 'Superintendent', role: UserRole.MEDICAL_SUPERINTENDENT, departmentId: getDep('ADMIN') },
    // HOD accounts
    { email: 'hod.cardio@mediflow.com', employeeId: 'EMP-004', firstName: 'Cardio', lastName: 'Head', role: UserRole.HOD, departmentId: getDep('CARD') },
    { email: 'hod.hr@mediflow.com', employeeId: 'EMP-014', firstName: 'HR', lastName: 'Head', role: UserRole.HOD, departmentId: getDep('HR') },
    { email: 'hod.proc@mediflow.com', employeeId: 'EMP-015', firstName: 'Procurement', lastName: 'Head', role: UserRole.HOD, departmentId: getDep('PROC') },
    { email: 'hod.it@mediflow.com', employeeId: 'EMP-016', firstName: 'IT', lastName: 'Head', role: UserRole.HOD, departmentId: getDep('IT') },
    { email: 'hod.fac@mediflow.com', employeeId: 'EMP-017', firstName: 'Facilities', lastName: 'Head', role: UserRole.HOD, departmentId: getDep('FAC') },
    { email: 'hod.admin@mediflow.com', employeeId: 'EMP-018', firstName: 'Admin', lastName: 'Head', role: UserRole.HOD, departmentId: getDep('ADMIN') },
    { email: 'hod.fin@mediflow.com', employeeId: 'EMP-019', firstName: 'Finance', lastName: 'Head', role: UserRole.HOD, departmentId: getDep('FIN') },
    // Functional role accounts
    { email: 'hr@mediflow.com', employeeId: 'EMP-005', firstName: 'HR', lastName: 'Manager', role: UserRole.HR, departmentId: getDep('HR') },
    { email: 'purchase@mediflow.com', employeeId: 'EMP-006', firstName: 'Purchase', lastName: 'Officer', role: UserRole.PURCHASE_OFFICER, departmentId: getDep('PROC') },
    { email: 'maintenance@mediflow.com', employeeId: 'EMP-007', firstName: 'Maintenance', lastName: 'Officer', role: UserRole.MAINTENANCE_OFFICER, departmentId: getDep('FAC') },
    { email: 'finance@mediflow.com', employeeId: 'EMP-009', firstName: 'Finance', lastName: 'Officer', role: UserRole.FINANCE_OFFICER, departmentId: getDep('FIN') },
    { email: 'dr.employee@mediflow.com', employeeId: 'EMP-008', firstName: 'Staff', lastName: 'Doctor', role: UserRole.EMPLOYEE, departmentId: getDep('CARD') },
    // Demo employee accounts
    { email: 'employee1@mediflow.com', employeeId: 'EMP-101', firstName: 'Vimal', lastName: 'Francis', role: UserRole.EMPLOYEE, departmentId: getDep('CARD') },
    { email: 'employee2@mediflow.com', employeeId: 'EMP-102', firstName: 'Aashna', lastName: 'Babu', role: UserRole.EMPLOYEE, departmentId: getDep('HR') },
    { email: 'employee3@mediflow.com', employeeId: 'EMP-103', firstName: 'Bestin', lastName: 'Byju', role: UserRole.EMPLOYEE, departmentId: getDep('PROC') },
    { email: 'employee4@mediflow.com', employeeId: 'EMP-104', firstName: 'Adhityan', lastName: 'Kr', role: UserRole.EMPLOYEE, departmentId: getDep('CARD') },
  ];

  const createdUsers = await Promise.all(
    userSeedData.map((u) =>
      prisma.user.create({
        data: {
          ...u,
          roleId: getRoleId(u.role),
          passwordHash,
        },
      })
    )
  );

  const getUserByEmail = (email: string) => createdUsers.find((u) => u.email === email)!;

  // Assign HODs to their respective departments
  const hodAssignments: { email: string; depCode: string }[] = [
    { email: 'hod.cardio@mediflow.com', depCode: 'CARD' },
    { email: 'hod.hr@mediflow.com', depCode: 'HR' },
    { email: 'hod.proc@mediflow.com', depCode: 'PROC' },
    { email: 'hod.it@mediflow.com', depCode: 'IT' },
    { email: 'hod.fac@mediflow.com', depCode: 'FAC' },
    { email: 'hod.admin@mediflow.com', depCode: 'ADMIN' },
    { email: 'hod.fin@mediflow.com', depCode: 'FIN' },
  ];

  await Promise.all(
    hodAssignments.map(async ({ email, depCode }) => {
      const hod = getUserByEmail(email);
      if (hod) {
        await prisma.department.update({
          where: { id: getDep(depCode) },
          data: { hodId: hod.id },
        });
      }
    })
  );

  // 4. Base Workflow Templates (Version 1)
  
  // A. Maintenance Flow (HOD -> Maintenance Officer)
  const tmplMaintenance = await prisma.workflowTemplate.create({
    data: {
      name: 'Standard Maintenance Request',
      requestType: RequestType.MAINTENANCE,
      version: 1,
      isActive: true,
      description: 'Standard flow for facilities repair, bio-medical servicing, and civil maintenance',
      steps: {
        create: [
          { stepName: 'HOD Approval', order: 1, approverRole: UserRole.HOD, isFinal: false, allowDynamicForwarding: true },
          { stepName: 'Facilities Processing', order: 2, approverRole: UserRole.MAINTENANCE_OFFICER, isFinal: true, allowDynamicForwarding: true },
        ],
      },
    },
    include: { steps: { orderBy: { order: 'asc' } } },
  });

  // B. Purchase Flow (HOD -> Purchase Officer)
  // Note: RuleEngine dynamically enforces Finance as Step 1 if cost > 100,000
  const tmplPurchase = await prisma.workflowTemplate.create({
    data: {
      name: 'Standard Purchase Request',
      requestType: RequestType.PURCHASE,
      version: 1,
      isActive: true,
      description: 'Standard flow for medical consumables, pharmaceuticals, and departmental supplies',
      steps: {
        create: [
          { stepName: 'HOD Approval', order: 1, approverRole: UserRole.HOD, isFinal: false, allowDynamicForwarding: true },
          { stepName: 'Procurement Review', order: 2, approverRole: UserRole.PURCHASE_OFFICER, isFinal: true, allowDynamicForwarding: true },
        ],
      },
    },
    include: { steps: { orderBy: { order: 'asc' } } },
  });

  // C. Leave Flow (HOD -> HR)
  const tmplLeave = await prisma.workflowTemplate.create({
    data: {
      name: 'Standard Leave Request',
      requestType: RequestType.LEAVE,
      version: 1,
      isActive: true,
      description: 'Standard flow for employee annual, casual, medical, and conference leave applications',
      steps: {
        create: [
          { stepName: 'HOD Approval', order: 1, approverRole: UserRole.HOD, isFinal: false, allowDynamicForwarding: true },
          { stepName: 'HR Processing', order: 2, approverRole: UserRole.HR, isFinal: true, allowDynamicForwarding: true },
        ],
      },
    },
    include: { steps: { orderBy: { order: 'asc' } } },
  });

  // 5. System Terminology Defaults
  const terminologies = [
    { category: 'REQUEST_TYPE', key: 'REQUEST_TYPE_PURCHASE', label: 'Purchase Request', description: 'Requisition for hospital equipment, drugs, or consumables' },
    { category: 'REQUEST_TYPE', key: 'REQUEST_TYPE_MAINTENANCE', label: 'Maintenance Work Order', description: 'Repair or servicing request for hospital infrastructure' },
    { category: 'REQUEST_TYPE', key: 'REQUEST_TYPE_LEAVE', label: 'Leave Application', description: 'Staff absence and leave requisition' },
    { category: 'STATUS', key: 'STATUS_DRAFT', label: 'Draft', description: 'Request created but not yet submitted' },
    { category: 'STATUS', key: 'STATUS_SUBMITTED', label: 'Submitted', description: 'Request submitted and queued for review' },
    { category: 'STATUS', key: 'STATUS_IN_REVIEW', label: 'Under Review', description: 'Request currently pending action by an approver' },
    { category: 'STATUS', key: 'STATUS_APPROVED', label: 'Approved', description: 'Request fully approved and authorized' },
    { category: 'STATUS', key: 'STATUS_REJECTED', label: 'Rejected', description: 'Request rejected with reviewer feedback' },
    { category: 'STATUS', key: 'STATUS_RETURNED', label: 'Returned for Revision', description: 'Returned to requester for corrections or additional quotes' },
    { category: 'STATUS', key: 'STATUS_CANCELLED', label: 'Cancelled', description: 'Request cancelled by requester or administrator' },
  ];

  await Promise.all(
    terminologies.map((t) => prisma.systemTerminology.create({ data: t }))
  );

  console.log('Seeding realistic demo requests across all workflow scenarios...');

  // Helper shortcuts
  const drEmployee = getUserByEmail('dr.employee@mediflow.com');
  const vimalStaff = getUserByEmail('employee1@mediflow.com');
  const adhityanStaff = getUserByEmail('employee4@mediflow.com');
  const hodCardio = getUserByEmail('hod.cardio@mediflow.com');
  const hodIt = getUserByEmail('hod.it@mediflow.com');
  const financeOfficer = getUserByEmail('finance@mediflow.com');
  const purchaseOfficer = getUserByEmail('purchase@mediflow.com');
  const maintenanceOfficer = getUserByEmail('maintenance@mediflow.com');
  const hrOfficer = getUserByEmail('hr@mediflow.com');
  const director = getUserByEmail('director@mediflow.com');

  // =========================================================================
  // SCENARIO 1: Normal Purchase Request (Under Review at HOD Step 1)
  // =========================================================================
  const req1 = await prisma.request.create({
    data: {
      referenceNumber: 'REQ-PUR-2026-001',
      title: 'Cardiology Ward - Sterile ECG Electrodes & Thermal Ultrasound Paper',
      type: RequestType.PURCHASE,
      priority: Priority.NORMAL,
      status: RequestStatus.IN_REVIEW,
      requestedById: drEmployee.id,
      departmentId: getDep('CARD'),
      workflowTemplateId: tmplPurchase.id,
      currentStepId: tmplPurchase.steps[0].id, // HOD Approval
      submittedAt: new Date(Date.now() - 3600 * 1000 * 4), // 4 hours ago
      purchaseDetail: {
        create: {
          itemDescription: '3M Red Dot Adult Monitoring Electrodes (Pack of 1000) & Sony High Glossy Ultrasound Paper (10 rolls)',
          quantity: 25,
          estimatedCost: 18500.00,
          budgetCode: 'OPEX-CARD-2026',
          justification: 'Ward inventory replenishment for upcoming monthly clinical batch in the intensive care and cardiac recovery suites.',
          vendorName: 'MediEquip Supplies India Pvt Ltd',
        },
      },
      auditLogs: {
        create: [
          {
            actorId: drEmployee.id,
            action: 'SUBMITTED',
            description: `Submitted for approval by ${drEmployee.firstName} ${drEmployee.lastName}`,
            timestamp: new Date(Date.now() - 3600 * 1000 * 4),
          },
        ],
      },
      comments: {
        create: [
          {
            authorId: drEmployee.id,
            content: 'Current stock of ECG electrodes in Ward 3B will deplete in 48 hours. Expedited review appreciated.',
            createdAt: new Date(Date.now() - 3600 * 1000 * 3),
          },
        ],
      },
      notifications: {
        create: [
          {
            recipientId: hodCardio.id,
            message: 'A new purchase request "Cardiology Ward - Sterile ECG Electrodes & Thermal Ultrasound Paper" needs your review for step "HOD Approval".',
            createdAt: new Date(Date.now() - 3600 * 1000 * 4),
          },
        ],
      },
    },
  });

  // =========================================================================
  // SCENARIO 2: High-Value Purchase (> ₹1,00,000) -> Finance-First Invariant
  // Demonstrates dynamic Step 1 Finance injection + Director sign-off
  // =========================================================================
  const dynTmplReq2 = await prisma.workflowTemplate.create({
    data: {
      name: 'Dynamic: Standard Purchase Request for REQ-PUR-2026-002',
      requestType: RequestType.PURCHASE,
      version: 1,
      isActive: false,
      description: 'Custom flow generated by rules engine for request REQ-PUR-2026-002 (> ₹1,00,000 Finance-First)',
      steps: {
        create: [
          { stepName: 'Finance Department Review', order: 1, approverRole: UserRole.FINANCE_OFFICER, isFinal: false, allowDynamicForwarding: true },
          { stepName: 'HOD Approval', order: 2, approverRole: UserRole.HOD, isFinal: false, allowDynamicForwarding: true },
          { stepName: 'Procurement Review', order: 3, approverRole: UserRole.PURCHASE_OFFICER, isFinal: false, allowDynamicForwarding: true },
          { stepName: 'Director Approval', order: 4, approverRole: UserRole.DIRECTOR, isFinal: true, allowDynamicForwarding: false },
        ],
      },
    },
    include: { steps: { orderBy: { order: 'asc' } } },
  });

  const req2 = await prisma.request.create({
    data: {
      referenceNumber: 'REQ-PUR-2026-002',
      title: 'ICU Cardiac Echocardiography & Ultrasound System Acquisition',
      type: RequestType.PURCHASE,
      priority: Priority.HIGH,
      status: RequestStatus.IN_REVIEW,
      requestedById: drEmployee.id,
      departmentId: getDep('CARD'),
      workflowTemplateId: dynTmplReq2.id,
      currentStepId: dynTmplReq2.steps[0].id, // Step 1: Finance Department Review
      submittedAt: new Date(Date.now() - 3600 * 1000 * 6), // 6 hours ago
      purchaseDetail: {
        create: {
          itemDescription: 'Philips Affiniti 70 Portable Echocardiography System with 3 Probes (S5-1 PureWave Cardiac Probe, C9-2 Curved Array, L12-4 Vascular Linear)',
          quantity: 1,
          estimatedCost: 850000.00,
          budgetCode: 'CAPEX-CARDIO-2026-Q3',
          justification: 'Essential clinical replacement for obsolete 12-year-old ultrasound in Coronary Care Unit. Enables bedside cardiac assessment.',
          vendorName: 'Philips Medical Healthcare India Ltd',
        },
      },
      auditLogs: {
        create: [
          {
            actorId: drEmployee.id,
            action: 'SUBMITTED',
            description: `Submitted for approval by ${drEmployee.firstName} ${drEmployee.lastName}. Dynamic Finance-First rule enforced (> ₹1,00,000).`,
            timestamp: new Date(Date.now() - 3600 * 1000 * 6),
          },
        ],
      },
      comments: {
        create: [
          {
            authorId: drEmployee.id,
            content: 'OEM warranty proposal and 5-year Comprehensive Maintenance Contract (CMC) terms are attached in the procurement package.',
            createdAt: new Date(Date.now() - 3600 * 1000 * 5),
          },
        ],
      },
      notifications: {
        create: [
          {
            recipientId: financeOfficer.id,
            message: 'A new high-value purchase request "ICU Cardiac Echocardiography & Ultrasound System Acquisition" (₹8,50,000) needs Finance clearance for step "Finance Department Review".',
            createdAt: new Date(Date.now() - 3600 * 1000 * 6),
          },
        ],
      },
    },
  });

  // =========================================================================
  // SCENARIO 3: HOD Originator Request (No-Self-Approval Rule)
  // HOD initiates maintenance -> Auto-escalates to Hospital Director!
  // =========================================================================
  const dynTmplReq3 = await prisma.workflowTemplate.create({
    data: {
      name: 'Dynamic: Standard Maintenance Request for REQ-MNT-2026-003',
      requestType: RequestType.MAINTENANCE,
      version: 1,
      isActive: false,
      description: 'Custom flow generated by rules engine for request REQ-MNT-2026-003 (HOD No-Self-Approval)',
      steps: {
        create: [
          { stepName: 'Director Approval', order: 1, approverRole: UserRole.DIRECTOR, isFinal: false, allowDynamicForwarding: false },
          { stepName: 'Facilities Processing', order: 2, approverRole: UserRole.MAINTENANCE_OFFICER, isFinal: true, allowDynamicForwarding: true },
        ],
      },
    },
    include: { steps: { orderBy: { order: 'asc' } } },
  });

  const req3 = await prisma.request.create({
    data: {
      referenceNumber: 'REQ-MNT-2026-003',
      title: 'Cath Lab Air Handling Unit (AHU) HEPA Filtration Overhaul',
      type: RequestType.MAINTENANCE,
      priority: Priority.HIGH,
      status: RequestStatus.IN_REVIEW,
      requestedById: hodCardio.id, // Initiated by Head of Cardiology!
      departmentId: getDep('CARD'),
      workflowTemplateId: dynTmplReq3.id,
      currentStepId: dynTmplReq3.steps[0].id, // Auto-escalated to Director Approval!
      submittedAt: new Date(Date.now() - 3600 * 1000 * 8),
      maintenanceDetail: {
        create: {
          location: 'Cardiology Cath Lab Suite 2, 3rd Floor East Wing',
          equipmentName: 'Trane Cleanroom AHU-04 / Terminal HEPA Filter Array',
          urgencyLevel: 'HIGH',
          issueDescription: 'Differential air pressure sensor alarm triggered; HEPA filter replacement, duct sanitization, and laminar air velocity re-certification required before elective angioplasties.',
        },
      },
      auditLogs: {
        create: [
          {
            actorId: hodCardio.id,
            action: 'SUBMITTED',
            description: `Submitted by HOD ${hodCardio.firstName} ${hodCardio.lastName}. No-self-approval rule triggered: auto-escalated to Hospital Director.`,
            timestamp: new Date(Date.now() - 3600 * 1000 * 8),
          },
        ],
      },
      notifications: {
        create: [
          {
            recipientId: director.id,
            message: 'A new maintenance request "Cath Lab Air Handling Unit (AHU) HEPA Filtration Overhaul" submitted by HOD Cardio needs your executive approval for step "Director Approval".',
            createdAt: new Date(Date.now() - 3600 * 1000 * 8),
          },
        ],
      },
    },
  });

  // =========================================================================
  // SCENARIO 4: Dynamic Forwarding (HOD Approved -> Reached Facilities -> Forwarded to IT/Biomedical Head)
  // =========================================================================
  const req4 = await prisma.request.create({
    data: {
      referenceNumber: 'REQ-MNT-2026-004',
      title: 'MRI Chiller Secondary Coolant Loop Refrigerant Leak & Sensor Calibration',
      type: RequestType.MAINTENANCE,
      priority: Priority.EMERGENCY,
      status: RequestStatus.IN_REVIEW,
      requestedById: drEmployee.id,
      departmentId: getDep('CARD'),
      workflowTemplateId: tmplMaintenance.id,
      currentStepId: tmplMaintenance.steps[1].id, // Step 2: Facilities Processing
      assignedToUserId: hodIt.id, // Forwarded and assigned to IT & Bio-Medical Head!
      submittedAt: new Date(Date.now() - 3600 * 1000 * 12),
      maintenanceDetail: {
        create: {
          location: 'Radiology & Imaging Suite, Ground Floor Wing B',
          equipmentName: 'KKT Chiller Dual Circuit Model cBoxX',
          urgencyLevel: 'EMERGENCY',
          issueDescription: 'Secondary coolant loop pressure dropping below safety thresholds. Magnetic Resonance Imaging suite shut down to prevent magnet quench.',
        },
      },
      approvalActions: {
        create: [
          {
            stepId: tmplMaintenance.steps[0].id,
            actorId: hodCardio.id,
            action: ApprovalActionType.APPROVED,
            comment: 'Approved immediately. Emergency priority: imaging operations suspended until chiller pressure is stabilized.',
            takenAt: new Date(Date.now() - 3600 * 1000 * 10),
          },
          {
            stepId: tmplMaintenance.steps[1].id,
            actorId: maintenanceOfficer.id,
            action: ApprovalActionType.FORWARDED,
            comment: 'Forwarded to IT & Bio-Medical Engineering department for specialized OEM chiller protocol and magnet cryogenic monitoring.',
            takenAt: new Date(Date.now() - 3600 * 1000 * 7),
          },
        ],
      },
      auditLogs: {
        create: [
          {
            actorId: drEmployee.id,
            action: 'SUBMITTED',
            description: `Submitted by ${drEmployee.firstName} ${drEmployee.lastName}`,
            timestamp: new Date(Date.now() - 3600 * 1000 * 12),
          },
          {
            actorId: hodCardio.id,
            action: 'STEP_APPROVED',
            description: `Approved by Cardio Head (HOD Approval)`,
            timestamp: new Date(Date.now() - 3600 * 1000 * 10),
          },
          {
            actorId: maintenanceOfficer.id,
            action: 'FORWARDED',
            description: `Forwarded to IT Head (HOD) by Maintenance Officer. Note: Forwarded to IT & Bio-Medical Engineering for OEM chiller protocol.`,
            timestamp: new Date(Date.now() - 3600 * 1000 * 7),
          },
        ],
      },
      comments: {
        create: [
          {
            authorId: maintenanceOfficer.id,
            content: 'Facilities team sealed the physical pipe connection. OEM Siemens Bio-Med specialist required for electronics controller recalibration.',
            createdAt: new Date(Date.now() - 3600 * 1000 * 7),
          },
        ],
      },
      notifications: {
        create: [
          {
            recipientId: hodIt.id,
            message: 'Request "MRI Chiller Secondary Coolant Loop Refrigerant Leak & Sensor Calibration" was forwarded to you by Maintenance Officer for Facilities Processing.',
            createdAt: new Date(Date.now() - 3600 * 1000 * 7),
          },
        ],
      },
    },
  });

  // =========================================================================
  // SCENARIO 5: Fully Approved Completed Purchase Request
  // =========================================================================
  const req5 = await prisma.request.create({
    data: {
      referenceNumber: 'REQ-PUR-2026-005',
      title: 'Emergency Crash Cart Defibrillator Lithium-Ion Battery Packs & Pads',
      type: RequestType.PURCHASE,
      priority: Priority.HIGH,
      status: RequestStatus.APPROVED,
      requestedById: vimalStaff.id,
      departmentId: getDep('CARD'),
      workflowTemplateId: tmplPurchase.id,
      currentStepId: null,
      submittedAt: new Date(Date.now() - 3600 * 1000 * 48), // 2 days ago
      completedAt: new Date(Date.now() - 3600 * 1000 * 14), // Completed 14 hrs ago
      purchaseDetail: {
        create: {
          itemDescription: 'Zoll R Series Rechargeable Lithium-Ion SurePower Battery Packs (4 units) & OneStep Complete Adult CPR Pacing Electrodes (12 packs)',
          quantity: 4,
          estimatedCost: 64000.00,
          budgetCode: 'EMERG-EQUIP-2026',
          justification: 'Mandatory semi-annual preventive replacement for Emergency Room and Cardiac ICU crash carts.',
          vendorName: 'Zoll Medical India Pvt Ltd',
        },
      },
      approvalActions: {
        create: [
          {
            stepId: tmplPurchase.steps[0].id,
            actorId: hodCardio.id,
            action: ApprovalActionType.APPROVED,
            comment: 'Approved for clinical resuscitation readiness and NABH compliance.',
            takenAt: new Date(Date.now() - 3600 * 1000 * 36),
          },
          {
            stepId: tmplPurchase.steps[1].id,
            actorId: purchaseOfficer.id,
            action: ApprovalActionType.APPROVED,
            comment: 'Purchase Order #PO-2026-089 issued to Zoll Medical India; expedited dispatch confirmed.',
            takenAt: new Date(Date.now() - 3600 * 1000 * 14),
          },
        ],
      },
      auditLogs: {
        create: [
          {
            actorId: vimalStaff.id,
            action: 'SUBMITTED',
            description: `Submitted by Vimal Francis`,
            timestamp: new Date(Date.now() - 3600 * 1000 * 48),
          },
          {
            actorId: hodCardio.id,
            action: 'STEP_APPROVED',
            description: `Approved by Cardio Head (HOD Approval)`,
            timestamp: new Date(Date.now() - 3600 * 1000 * 36),
          },
          {
            actorId: purchaseOfficer.id,
            action: 'APPROVED',
            description: `Final approval completed by Purchase Officer`,
            timestamp: new Date(Date.now() - 3600 * 1000 * 14),
          },
        ],
      },
      notifications: {
        create: [
          {
            recipientId: vimalStaff.id,
            message: 'Your request "Emergency Crash Cart Defibrillator Lithium-Ion Battery Packs & Pads" has been approved.',
            createdAt: new Date(Date.now() - 3600 * 1000 * 14),
          },
        ],
      },
    },
  });

  // =========================================================================
  // SCENARIO 6: Rejected Purchase Request (Finance Officer Rejected with Budget Reason)
  // =========================================================================
  const dynTmplReq6 = await prisma.workflowTemplate.create({
    data: {
      name: 'Dynamic: Standard Purchase Request for REQ-PUR-2026-006',
      requestType: RequestType.PURCHASE,
      version: 1,
      isActive: false,
      description: 'Custom flow generated by rules engine for request REQ-PUR-2026-006 (> ₹1,00,000 Finance-First)',
      steps: {
        create: [
          { stepName: 'Finance Department Review', order: 1, approverRole: UserRole.FINANCE_OFFICER, isFinal: false, allowDynamicForwarding: true },
          { stepName: 'HOD Approval', order: 2, approverRole: UserRole.HOD, isFinal: false, allowDynamicForwarding: true },
          { stepName: 'Procurement Review', order: 3, approverRole: UserRole.PURCHASE_OFFICER, isFinal: false, allowDynamicForwarding: true },
          { stepName: 'Director Approval', order: 4, approverRole: UserRole.DIRECTOR, isFinal: true, allowDynamicForwarding: false },
        ],
      },
    },
    include: { steps: { orderBy: { order: 'asc' } } },
  });

  const req6 = await prisma.request.create({
    data: {
      referenceNumber: 'REQ-PUR-2026-006',
      title: 'Executive Ergonomic Leather Recliners for Department Staff Lounge',
      type: RequestType.PURCHASE,
      priority: Priority.LOW,
      status: RequestStatus.REJECTED,
      requestedById: adhityanStaff.id,
      departmentId: getDep('CARD'),
      workflowTemplateId: dynTmplReq6.id,
      currentStepId: null,
      submittedAt: new Date(Date.now() - 3600 * 1000 * 24),
      completedAt: new Date(Date.now() - 3600 * 1000 * 18),
      purchaseDetail: {
        create: {
          itemDescription: 'High-Back Genuine Leather Executive Ergonomic Reclining Chairs',
          quantity: 6,
          estimatedCost: 120000.00,
          budgetCode: 'ADMIN-FURN-2026',
          justification: 'Cardiology doctors rest area furniture upgrade.',
          vendorName: 'Royal Office Comforts Pvt Ltd',
        },
      },
      approvalActions: {
        create: [
          {
            stepId: dynTmplReq6.steps[0].id,
            actorId: financeOfficer.id,
            action: ApprovalActionType.REJECTED,
            comment: 'Rejected: Luxury lounge furniture is outside approved clinical operational budget guidelines for Q3. Please re-submit standard hospital-grade seating requisition.',
            takenAt: new Date(Date.now() - 3600 * 1000 * 18),
          },
        ],
      },
      auditLogs: {
        create: [
          {
            actorId: adhityanStaff.id,
            action: 'SUBMITTED',
            description: `Submitted by Adhityan Kr`,
            timestamp: new Date(Date.now() - 3600 * 1000 * 24),
          },
          {
            actorId: financeOfficer.id,
            action: 'REJECTED',
            description: `Rejected by Finance Officer. Reason: Luxury lounge furniture is outside approved clinical operational budget guidelines for Q3.`,
            timestamp: new Date(Date.now() - 3600 * 1000 * 18),
          },
        ],
      },
      notifications: {
        create: [
          {
            recipientId: adhityanStaff.id,
            message: 'Your request "Executive Ergonomic Leather Recliners for Department Staff Lounge" has been rejected. Reason: Luxury lounge furniture is outside approved clinical operational budget guidelines for Q3. Please re-submit standard hospital-grade seating requisition.',
            createdAt: new Date(Date.now() - 3600 * 1000 * 18),
          },
        ],
      },
    },
  });

  // =========================================================================
  // SCENARIO 7: Staff Leave Application (HOD Approved -> Pending HR Processing)
  // =========================================================================
  const req7 = await prisma.request.create({
    data: {
      referenceNumber: 'REQ-LEV-2026-007',
      title: 'Annual Medical Conference Leave - Asia-Pacific Cardiology Forum',
      type: RequestType.LEAVE,
      priority: Priority.NORMAL,
      status: RequestStatus.IN_REVIEW,
      requestedById: drEmployee.id,
      departmentId: getDep('CARD'),
      workflowTemplateId: tmplLeave.id,
      currentStepId: tmplLeave.steps[1].id, // Step 2: HR Processing
      submittedAt: new Date(Date.now() - 3600 * 1000 * 20),
      leaveDetail: {
        create: {
          leaveType: 'Conference / Academic Leave',
          startDate: new Date('2026-10-10T09:00:00Z'),
          endDate: new Date('2026-10-15T18:00:00Z'),
          totalDays: 6,
          reason: 'Invited speaker and abstract presenter at APAC Interventional Cardiology Summit in Singapore.',
          coveringStaff: 'Dr. Vimal Francis (EMP-101)',
        },
      },
      approvalActions: {
        create: [
          {
            stepId: tmplLeave.steps[0].id,
            actorId: hodCardio.id,
            action: ApprovalActionType.APPROVED,
            comment: 'Approved. Department duty coverage confirmed with Dr. Vimal Francis.',
            takenAt: new Date(Date.now() - 3600 * 1000 * 15),
          },
        ],
      },
      auditLogs: {
        create: [
          {
            actorId: drEmployee.id,
            action: 'SUBMITTED',
            description: `Submitted by Dr. Staff Doctor`,
            timestamp: new Date(Date.now() - 3600 * 1000 * 20),
          },
          {
            actorId: hodCardio.id,
            action: 'STEP_APPROVED',
            description: `Approved by Cardio Head (HOD Approval)`,
            timestamp: new Date(Date.now() - 3600 * 1000 * 15),
          },
        ],
      },
      notifications: {
        create: [
          {
            recipientId: hrOfficer.id,
            message: 'A new leave request "Annual Medical Conference Leave - Asia-Pacific Cardiology Forum" needs your review for step "HR Processing".',
            createdAt: new Date(Date.now() - 3600 * 1000 * 15),
          },
        ],
      },
    },
  });

  // =========================================================================
  // SCENARIO 8: Returned Request (Needs Changes / Resubmission)
  // =========================================================================
  const req8 = await prisma.request.create({
    data: {
      referenceNumber: 'REQ-PUR-2026-008',
      title: 'Bio-Hazard Waste Disposal Heavy-Duty Autoclave Consumables',
      type: RequestType.PURCHASE,
      priority: Priority.NORMAL,
      status: RequestStatus.RETURNED,
      requestedById: drEmployee.id,
      departmentId: getDep('CARD'),
      workflowTemplateId: tmplPurchase.id,
      currentStepId: null,
      submittedAt: new Date(Date.now() - 3600 * 1000 * 30),
      purchaseDetail: {
        create: {
          itemDescription: 'Heavy-Duty Chemical Indicator Autoclave Sterilization Tape & Bio-Hazard Waste Bags (50 rolls / 500 bags)',
          quantity: 50,
          estimatedCost: 42000.00,
          budgetCode: 'STERIL-CARD-2026',
          justification: 'Bi-monthly replenishment of biomedical sterilization and bio-waste segregation consumables.',
          vendorName: 'BioSafe Hospital Solutions',
        },
      },
      approvalActions: {
        create: [
          {
            stepId: tmplPurchase.steps[0].id,
            actorId: hodCardio.id,
            action: ApprovalActionType.RETURNED,
            comment: 'Please attach competitive vendor quotations from at least two certified bio-medical suppliers before resubmitting.',
            takenAt: new Date(Date.now() - 3600 * 1000 * 22),
          },
        ],
      },
      auditLogs: {
        create: [
          {
            actorId: drEmployee.id,
            action: 'SUBMITTED',
            description: `Submitted by Dr. Staff Doctor`,
            timestamp: new Date(Date.now() - 3600 * 1000 * 30),
          },
          {
            actorId: hodCardio.id,
            action: 'RETURNED',
            description: `Returned for changes by Cardio Head. Details: Please attach competitive vendor quotations from at least two certified bio-medical suppliers before resubmitting.`,
            timestamp: new Date(Date.now() - 3600 * 1000 * 22),
          },
        ],
      },
      notifications: {
        create: [
          {
            recipientId: drEmployee.id,
            message: 'Your request "Bio-Hazard Waste Disposal Heavy-Duty Autoclave Consumables" needs changes. Note: Please attach competitive vendor quotations from at least two certified bio-medical suppliers before resubmitting.',
            createdAt: new Date(Date.now() - 3600 * 1000 * 22),
          },
        ],
      },
    },
  });

  console.log('Seed completed successfully! 8 realistic demo scenarios created.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
