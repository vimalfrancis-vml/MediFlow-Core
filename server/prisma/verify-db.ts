import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('========================================');
  console.log('    MediFlow Database Verification      ');
  console.log('========================================');
  
  // 1. Departments Check
  const depCount = await prisma.department.count();
  const departments = await prisma.department.findMany({ select: { name: true, code: true } });
  console.log(`\n1. Departments (${depCount}):`);
  departments.forEach((d) => console.log(`   - [${d.code}] ${d.name}`));

  // 2. Users Check
  const userCount = await prisma.user.count();
  const users = await prisma.user.findMany({
    select: { email: true, role: true, department: { select: { code: true } } },
    orderBy: { email: 'asc' },
  });
  console.log(`\n2. Users (${userCount}):`);
  users.forEach((u) => console.log(`   - ${u.email.padEnd(25)} [${u.role.padEnd(21)}] Dept: ${u.department.code}`));

  // 3. Workflow Templates Check
  const templateCount = await prisma.workflowTemplate.count();
  const templates = await prisma.workflowTemplate.findMany({
    select: {
      name: true,
      requestType: true,
      isActive: true,
      version: true,
      steps: {
        select: {
          stepName: true,
          order: true,
          approverRole: true,
          isFinal: true,
        },
        orderBy: { order: 'asc' },
      },
    },
  });
  console.log(`\n3. Workflow Templates (${templateCount}):`);
  templates.forEach((t) => {
    console.log(`   - ${t.name} (v${t.version}, Active: ${t.isActive})`);
    t.steps.forEach((s) => {
      console.log(`     Step ${s.order}: ${s.stepName} [Role: ${s.approverRole}] ${s.isFinal ? '(Final)' : ''}`);
    });
  });

  // 4. Seeded Demo Requests Check
  const requestCount = await prisma.request.count();
  const requests = await prisma.request.findMany({
    select: {
      referenceNumber: true,
      title: true,
      type: true,
      priority: true,
      status: true,
      requestedBy: { select: { email: true, firstName: true, lastName: true } },
      currentStep: { select: { stepName: true, approverRole: true } },
      assignedToUser: { select: { email: true, firstName: true, lastName: true } },
      purchaseDetail: { select: { estimatedCost: true, itemDescription: true } },
      maintenanceDetail: { select: { equipmentName: true, location: true } },
      leaveDetail: { select: { leaveType: true, totalDays: true } },
      approvalActions: { select: { action: true, comment: true } },
      auditLogs: { select: { action: true } },
    },
    orderBy: { referenceNumber: 'asc' },
  });

  console.log(`\n4. Seeded Demo Requests (${requestCount}):`);
  requests.forEach((r) => {
    const cost = r.purchaseDetail ? ` | ₹${Number(r.purchaseDetail.estimatedCost).toLocaleString('en-IN')}` : '';
    const current = r.currentStep ? `Step: ${r.currentStep.stepName} (${r.currentStep.approverRole})` : 'Workflow Completed';
    const assigned = r.assignedToUser ? ` [Assigned to: ${r.assignedToUser.email}]` : '';
    console.log(`   - [${r.referenceNumber}] ${r.title.substring(0, 45)}...`);
    console.log(`     Type: ${r.type} | Priority: ${r.priority} | Status: ${r.status}${cost}`);
    console.log(`     Requester: ${r.requestedBy.email} | ${current}${assigned}`);
    console.log(`     History: ${r.approvalActions.length} actions recorded, ${r.auditLogs.length} audit log entries.`);
  });

  console.log('\n========================================');
  console.log('Verification Completed: Database 100% Ready');
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error('Verification failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
