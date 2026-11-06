import 'dotenv/config';
import net from 'net';
import dns from 'dns';

// Fix Node 24 Happy Eyeballs IPv6 hanging on networks without outbound IPv6 routing
if (typeof net.setDefaultAutoSelectFamily === 'function') {
  net.setDefaultAutoSelectFamily(false);
}
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

if (!process.env.DATABASE_URL) {
  throw new Error('[FATAL] DATABASE_URL environment variable is not set. Cannot start server.');
}

// Global singleton pattern to prevent connection leaks across nodemon / hot-reloads
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; pool?: Pool };

if (!globalForPrisma.pool) {
  globalForPrisma.pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
    keepAlive: true,
  });

  globalForPrisma.pool.on('error', (err) => {
    console.warn('[pg-pool] Idle client connection closed by server:', err.message);
  });
}

if (!globalForPrisma.prisma) {
  const adapter = new PrismaPg(globalForPrisma.pool);
  globalForPrisma.prisma = new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma;
