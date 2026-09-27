import 'dotenv/config';
import { Pool } from 'pg';

async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set.');
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    console.log('Running safe additive migration for General Request...');

    // 1. Add 'GENERAL' to RequestType enum
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type typ
          JOIN pg_enum enm ON typ.oid = enm.enumtypid
          WHERE typ.typname = 'RequestType' AND enm.enumlabel = 'GENERAL'
        ) THEN
          ALTER TYPE "RequestType" ADD VALUE 'GENERAL';
        END IF;
      END
      $$;
    `);
    console.log('Enum RequestType updated with GENERAL.');

    // 2. Create GeneralDetail table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "GeneralDetail" (
        "id" TEXT NOT NULL,
        "requestId" TEXT NOT NULL,
        "subject" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "targetDepartmentId" TEXT,
        "targetUserId" TEXT,
        "requiredDate" TIMESTAMP(3),
        "endDate" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "GeneralDetail_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('GeneralDetail table verified/created.');

    // 3. Unique index on requestId
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "GeneralDetail_requestId_key" ON "GeneralDetail"("requestId");
    `);

    // 4. Foreign key constraints if not exists
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'GeneralDetail_requestId_fkey'
        ) THEN
          ALTER TABLE "GeneralDetail"
          ADD CONSTRAINT "GeneralDetail_requestId_fkey"
          FOREIGN KEY ("requestId") REFERENCES "Request"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'GeneralDetail_targetDepartmentId_fkey'
        ) THEN
          ALTER TABLE "GeneralDetail"
          ADD CONSTRAINT "GeneralDetail_targetDepartmentId_fkey"
          FOREIGN KEY ("targetDepartmentId") REFERENCES "Department"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'GeneralDetail_targetUserId_fkey'
        ) THEN
          ALTER TABLE "GeneralDetail"
          ADD CONSTRAINT "GeneralDetail_targetUserId_fkey"
          FOREIGN KEY ("targetUserId") REFERENCES "User"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END
      $$;
    `);
    console.log('Foreign keys verified.');

    console.log('Migration completed successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
