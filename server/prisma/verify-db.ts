import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- MediFlow Core Verification ---');
  
  // 1. Departments Check
  const depCount = await prisma.department.count();
  const departments = await prisma.department.findMany({ select: { name: true, code: true } });
  console.log(`Departments: ${depCount}`);
  departments.forEach(d => console.log(`  - [${d.code}] ${d.name}`));

  // 2. Users Check
  const userCount = await prisma.user.count();
  const users = await prisma.user.findMany({ select: { email: true, role: true, department: { select: { code: true } } } });
  console.log(`Users: ${userCount}`);
  users.forEach(u => console.log(`  - ${u.email} (${u.role}) in Dept: ${u.department.code}`));

  // 3. Workflow Templates Check
  const templateCount = await prisma.workflowTemplate.count();
  const templates = await prisma.workflowTemplate.findMany({
    select: {
      name: true,
      requestType: true,
      steps: {
        select: {
          stepName: true,
          order: true,
          approverRole: true,
        },
        orderBy: { order: 'asc' },
      },
    },
  });
  console.log(`Workflow Templates: ${templateCount}`);
  templates.forEach(t => {
    console.log(`  - Flow: ${t.name} (${t.requestType})`);
    t.steps.forEach(s => {
      console.log(`    Step ${s.order}: ${s.stepName} (${s.approverRole})`);
    });
  });

  console.log('---------------------------------');
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
