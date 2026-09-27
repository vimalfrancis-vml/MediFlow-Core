import { prisma } from '../src/db';

async function main() {
  console.log('Restoring baseline active templates...');

  console.log('Cleaning test requests and extra workflow templates...');

  // Delete all request child tables and requests
  await prisma.auditLog.deleteMany({});
  await prisma.approvalAction.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.maintenanceDetail.deleteMany({});
  await prisma.generalDetail.deleteMany({});
  await prisma.purchaseDetail.deleteMany({});
  await prisma.leaveDetail.deleteMany({});
  await prisma.request.deleteMany({});

  // Delete all workflow steps for non-seed templates (version > 1 or dynamic)
  const extraTemplates = await prisma.workflowTemplate.findMany({
    where: {
      OR: [
        { version: { gt: 1 } },
        { name: { startsWith: 'Dynamic:' } },
      ],
    },
    select: { id: true },
  });

  if (extraTemplates.length > 0) {
    const extraIds = extraTemplates.map(t => t.id);
    await prisma.workflowStep.deleteMany({ where: { templateId: { in: extraIds } } });
    await prisma.workflowTemplate.deleteMany({ where: { id: { in: extraIds } } });
  }

  // Ensure baseline v1 templates are active
  await prisma.workflowTemplate.updateMany({
    where: {
      name: 'Standard Maintenance Request',
      version: 1,
    },
    data: { isActive: true },
  });

  await prisma.workflowTemplate.updateMany({
    where: {
      name: 'Standard Purchase Request',
      version: 1,
    },
    data: { isActive: true },
  });

  await prisma.workflowTemplate.updateMany({
    where: {
      name: 'Standard Leave Request',
      version: 1,
    },
    data: { isActive: true },
  });

  await prisma.workflowTemplate.updateMany({
    where: {
      name: 'General Operational Request',
      version: 1,
    },
    data: { isActive: true },
  });

  const active = await prisma.workflowTemplate.findMany({
    where: { isActive: true },
    select: { id: true, name: true, requestType: true, version: true, isActive: true },
  });

  console.log('Active canonical templates:', active);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
