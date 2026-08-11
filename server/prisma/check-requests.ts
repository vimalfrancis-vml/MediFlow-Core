import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const requests = await prisma.request.findMany({
    include: {
      currentStep: true,
      purchaseDetail: true,
    }
  });
  console.log(`Found ${requests.length} requests:`);
  requests.forEach(r => {
    console.log(`- Request: ${r.title} (${r.referenceNumber})`);
    console.log(`  Status: ${r.status}`);
    console.log(`  Type: ${r.type}`);
    console.log(`  Current Step: ${r.currentStep ? `${r.currentStep.stepName} (Approver Role: ${r.currentStep.approverRole})` : 'None'}`);
    if (r.purchaseDetail) {
      console.log(`  Purchase Cost: ${r.purchaseDetail.estimatedCost}`);
    }
  });
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
