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

/**
 * Enhance DATABASE_URL with connection pool parameters if not already present
 * This prevents connection pool exhaustion and timeouts
 */
function enhanceDatabaseUrl(url: string): string {
  // Skip if already has connection_limit or pool_timeout
  if (url.includes('connection_limit') || url.includes('pool_timeout')) {
    return url;
  }

  // Only enhance PostgreSQL URLs
  if (!url.startsWith('postgres://') && !url.startsWith('postgresql://')) {
    return url;
  }

  // Parse URL to add parameters
  const urlObj = new URL(url);
  
  // Set connection pool parameters
  // connection_limit: Maximum number of connections in the pool (increased from default 10)
  // pool_timeout: Maximum time to wait for a connection (increased from default 20s)
  // connect_timeout: Time to wait when establishing connection
  urlObj.searchParams.set('connection_limit', '20');
  urlObj.searchParams.set('pool_timeout', '60');
  urlObj.searchParams.set('connect_timeout', '10');
  
  return urlObj.toString();
}

// Check connection type
const databaseUrl = process.env.DATABASE_URL || '';
const enhancedDatabaseUrl = enhanceDatabaseUrl(databaseUrl);
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
          url: enhancedDatabaseUrl, // Use enhanced URL with pool parameters
        },
      },
    });

    if (process.env.NODE_ENV === 'development') {
      console.log(`[PrismaService] Using Direct PostgreSQL connection`);
      console.log(`[PrismaService] Connection pool: limit=20, timeout=60s`);
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
      datasources: {
        db: {
          url: enhancedDatabaseUrl, // Use enhanced URL with pool parameters
        },
      },
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

/**
 * Gracefully disconnect Prisma Client
 * Call this on application shutdown to release all connections
 */
export async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
    console.log('[PrismaService] Disconnected from database');
  } catch (error: any) {
    console.error('[PrismaService] Error disconnecting:', error.message);
  }
}

export default prisma as PrismaClient;
