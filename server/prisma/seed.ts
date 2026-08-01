import { PrismaClient, RequestType, UserRole } from '@prisma/client';
import 'dotenv/config';
import bcrypt from 'bcrypt';

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting seed...');

  // Clear existing data (optional, but good for idempotent seeds)
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

  // 1. Departments
  const deps = [
    { name: 'Cardiology', code: 'CARD' },
    { name: 'Information Technology', code: 'IT' },
    { name: 'Human Resources', code: 'HR' },
    { name: 'Procurement', code: 'PROC' },
    { name: 'Facilities', code: 'FAC' },
    { name: 'Administration', code: 'ADMIN' },
  ];

  const createdDeps = await Promise.all(
    deps.map((d) => prisma.department.create({ data: d }))
  );

  const getDep = (code: string) => createdDeps.find((d) => d.code === code)!.id;

  // 2. Users
  const passwordHash = await bcrypt.hash('password123', 10);

  // HOD users — one for each department that employees belong to.
  // Without a HOD, the WorkflowEngine cannot route step-1 (HOD Approval)
  // for employees in that department, causing workflow inconsistency.
  const users = [
    { email: 'admin@mediflow.com', employeeId: 'EMP-001', firstName: 'System', lastName: 'Admin', role: UserRole.ADMIN, departmentId: getDep('IT') },
    { email: 'director@mediflow.com', employeeId: 'EMP-002', firstName: 'Hospital', lastName: 'Director', role: UserRole.DIRECTOR, departmentId: getDep('ADMIN') },
    { email: 'medsupt@mediflow.com', employeeId: 'EMP-003', firstName: 'Medical', lastName: 'Superintendent', role: UserRole.MEDICAL_SUPERINTENDENT, departmentId: getDep('ADMIN') },
    // HOD accounts — one per department that has employees
    { email: 'hod.cardio@mediflow.com', employeeId: 'EMP-004', firstName: 'Cardio', lastName: 'Head', role: UserRole.HOD, departmentId: getDep('CARD') },
    { email: 'hod.hr@mediflow.com', employeeId: 'EMP-014', firstName: 'HR', lastName: 'Head', role: UserRole.HOD, departmentId: getDep('HR') },
    { email: 'hod.proc@mediflow.com', employeeId: 'EMP-015', firstName: 'Procurement', lastName: 'Head', role: UserRole.HOD, departmentId: getDep('PROC') },
    { email: 'hod.it@mediflow.com', employeeId: 'EMP-016', firstName: 'IT', lastName: 'Head', role: UserRole.HOD, departmentId: getDep('IT') },
    { email: 'hod.fac@mediflow.com', employeeId: 'EMP-017', firstName: 'Facilities', lastName: 'Head', role: UserRole.HOD, departmentId: getDep('FAC') },
    { email: 'hod.admin@mediflow.com', employeeId: 'EMP-018', firstName: 'Admin', lastName: 'Head', role: UserRole.HOD, departmentId: getDep('ADMIN') },
    // Functional role accounts
    { email: 'hr@mediflow.com', employeeId: 'EMP-005', firstName: 'HR', lastName: 'Manager', role: UserRole.HR, departmentId: getDep('HR') },
    { email: 'purchase@mediflow.com', employeeId: 'EMP-006', firstName: 'Purchase', lastName: 'Officer', role: UserRole.PURCHASE_OFFICER, departmentId: getDep('PROC') },
    { email: 'maintenance@mediflow.com', employeeId: 'EMP-007', firstName: 'Maintenance', lastName: 'Officer', role: UserRole.MAINTENANCE_OFFICER, departmentId: getDep('FAC') },
    { email: 'dr.employee@mediflow.com', employeeId: 'EMP-008', firstName: 'Staff', lastName: 'Doctor', role: UserRole.EMPLOYEE, departmentId: getDep('CARD') },
    // Demo employee accounts for testing (different departments)
    { email: 'employee1@mediflow.com', employeeId: 'EMP-101', firstName: 'Vimal', lastName: 'Francis', role: UserRole.EMPLOYEE, departmentId: getDep('CARD') },
    { email: 'employee2@mediflow.com', employeeId: 'EMP-102', firstName: 'Aashna', lastName: 'Babu', role: UserRole.EMPLOYEE, departmentId: getDep('HR') },
    { email: 'employee3@mediflow.com', employeeId: 'EMP-103', firstName: 'Bestin', lastName: 'Byju', role: UserRole.EMPLOYEE, departmentId: getDep('PROC') },
    { email: 'employee4@mediflow.com', employeeId: 'EMP-104', firstName: 'Adhityan', lastName: 'Kr', role: UserRole.EMPLOYEE, departmentId: getDep('CARD') },
  ];

  await Promise.all(
    users.map((u) => prisma.user.create({ data: { ...u, passwordHash } }))
  );

  // Assign HODs to their respective departments.
  // This is critical: the WorkflowEngine uses request.departmentId and
  // user.departmentId together to scope HOD approvals correctly.
  const hodAssignments: { email: string; depCode: string }[] = [
    { email: 'hod.cardio@mediflow.com', depCode: 'CARD' },
    { email: 'hod.hr@mediflow.com', depCode: 'HR' },
    { email: 'hod.proc@mediflow.com', depCode: 'PROC' },
    { email: 'hod.it@mediflow.com', depCode: 'IT' },
    { email: 'hod.fac@mediflow.com', depCode: 'FAC' },
    { email: 'hod.admin@mediflow.com', depCode: 'ADMIN' },
  ];

  await Promise.all(
    hodAssignments.map(async ({ email, depCode }) => {
      const hod = await prisma.user.findUnique({ where: { email } });
      if (hod) {
        await prisma.department.update({
          where: { id: getDep(depCode) },
          data: { hodId: hod.id },
        });
      }
    })
  );

  // 3. Workflow Templates
  
  // A. Maintenance Flow (HOD -> Maintenance Officer)
  await prisma.workflowTemplate.create({
    data: {
      name: 'Standard Maintenance Request',
      requestType: RequestType.MAINTENANCE,
      description: 'Default flow for maintenance and repairs',
      steps: {
        create: [
          { stepName: 'HOD Approval', order: 1, approverRole: UserRole.HOD, isFinal: false },
          { stepName: 'Facilities Processing', order: 2, approverRole: UserRole.MAINTENANCE_OFFICER, isFinal: true },
        ],
      },
    },
  });

  // B. Purchase Flow (HOD -> Purchase Officer)
  // Note: RuleEngine will dynamically inject Director if cost > 100000
  await prisma.workflowTemplate.create({
    data: {
      name: 'Standard Purchase Request',
      requestType: RequestType.PURCHASE,
      description: 'Default flow for buying items or equipment',
      steps: {
        create: [
          { stepName: 'HOD Approval', order: 1, approverRole: UserRole.HOD, isFinal: false },
          { stepName: 'Procurement Review', order: 2, approverRole: UserRole.PURCHASE_OFFICER, isFinal: true },
        ],
      },
    },
  });

  // C. Leave Flow (HOD -> HR)
  await prisma.workflowTemplate.create({
    data: {
      name: 'Standard Leave Request',
      requestType: RequestType.LEAVE,
      description: 'Default flow for staff leave applications',
      steps: {
        create: [
          { stepName: 'HOD Approval', order: 1, approverRole: UserRole.HOD, isFinal: false },
          { stepName: 'HR Processing', order: 2, approverRole: UserRole.HR, isFinal: true },
        ],
      },
    },
  });

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
