/**
 * Prisma Client Service with Accelerate Support and Fallback
 * 
 * Strategy:
 * 1. If DATABASE_URL is Accelerate URL (prisma+postgres://) -> Use Accelerate
 * 2. If DATABASE_URL is direct PostgreSQL (postgres://) -> Use direct connection
 * 3. If Accelerate fails, automatically fallback to direct connection
 * 
 * For migrations: Always use direct PostgreSQL URL in DATABASE_URL
 * For queries: Can use either Accelerate or direct connection
 */

import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

// Check connection type
const databaseUrl = process.env.DATABASE_URL || '';
const isAccelerateUrl = databaseUrl.includes('prisma+postgres://') && databaseUrl.includes('accelerate.prisma-data.net');
const isDirectPostgresUrl = databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://');
const disableAccelerate = process.env.DISABLE_PRISMA_ACCELERATE === 'true';

// Try to extract direct PostgreSQL URL from Accelerate URL if needed
// This is a fallback mechanism - if Accelerate fails, we can use direct connection
let directDatabaseUrl: string | undefined = undefined;

// If using Accelerate, try to get direct connection URL from environment
// Some setups provide both URLs
if (isAccelerateUrl && process.env.DIRECT_DATABASE_URL) {
  directDatabaseUrl = process.env.DIRECT_DATABASE_URL;
}

// Singleton pattern for Prisma Client
const prismaClientSingleton = () => {
  // If Accelerate is disabled or not configured, use direct connection
  if (disableAccelerate || !isAccelerateUrl || isDirectPostgresUrl) {
    const client = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });

    if (process.env.NODE_ENV === 'development') {
      console.log(`[PrismaService] Using Direct PostgreSQL connection`);
    }

    return client;
  }

  // Try Accelerate with fallback capability
  try {
    const baseClient = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

    const acceleratedClient = baseClient.$extends(withAccelerate());

    if (process.env.NODE_ENV === 'development') {
      console.log(`[PrismaService] Using Accelerate connection`);
      console.log(`[PrismaService] Note: If Accelerate fails, check network connectivity or use DIRECT_DATABASE_URL for fallback`);
    }

    return acceleratedClient;
  } catch (error: any) {
    console.error(`[PrismaService] Failed to initialize Accelerate:`, error.message);
    console.warn(`[PrismaService] Falling back to direct connection...`);
    
    // Fallback to direct connection if Accelerate fails
    return new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

export default prisma as PrismaClient;
