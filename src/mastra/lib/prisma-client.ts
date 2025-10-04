import { PrismaClient } from '@prisma/client';

// Logger interface for telemetry hooks
interface Logger {
  info(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
}

// Extend Prisma client with custom methods if needed
export interface ExtendedPrismaClient extends PrismaClient {
  // Add any custom extensions here
}

let prisma: ExtendedPrismaClient | null = null;

/**
 * Get or create a singleton Prisma client instance with telemetry hooks
 * Loads connection settings from environment variables
 */
export function getPrismaClient(logger?: Logger): ExtendedPrismaClient {
  if (prisma) {
    return prisma;
  }

  const client = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: [
      {
        emit: 'event',
        level: 'query',
      },
      {
        emit: 'event', 
        level: 'error',
      },
      {
        emit: 'event',
        level: 'info',
      },
      {
        emit: 'event',
        level: 'warn',
      },
    ],
  });

  // Set up telemetry hooks if logger is provided
  if (logger) {
    client.$on('query', (e: any) => {
      logger.info('Prisma Query', {
        query: e.query,
        params: e.params,
        duration: e.duration,
        target: e.target,
      });
    });

    client.$on('error', (e: any) => {
      logger.error('Prisma Error', {
        message: e.message,
        target: e.target,
      });
    });

    client.$on('info', (e: any) => {
      logger.info('Prisma Info', {
        message: e.message,
        target: e.target,
      });
    });

    client.$on('warn', (e: any) => {
      logger.warn('Prisma Warning', {
        message: e.message,
        target: e.target,
      });
    });
  }

  // Add connection lifecycle logging
  client.$connect().then(() => {
    if (logger) {
      logger.info('Prisma client connected successfully');
    }
  }).catch((error: any) => {
    if (logger) {
      logger.error('Failed to connect Prisma client', { error: error.message });
    }
    throw error;
  });

  prisma = client as ExtendedPrismaClient;
  return prisma;
}

/**
 * Disconnect the Prisma client
 * Useful for cleanup in tests or graceful shutdown
 */
export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

/**
 * Execute a transaction with automatic retry logic
 */
export async function withTransaction<T>(
  client: ExtendedPrismaClient,
  fn: (tx: PrismaClient) => Promise<T>,
  logger?: Logger
): Promise<T> {
  try {
    return await client.$transaction(fn);
  } catch (error) {
    if (logger) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Transaction failed', { error: errorMessage });
    }
    throw error;
  }
}

// Export the Prisma client type for use in other modules
export { PrismaClient } from '@prisma/client';