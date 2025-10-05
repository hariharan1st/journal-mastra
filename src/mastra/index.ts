
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';

// Import new journaling agents and workflows
import { adminCatalogueAgent } from './agents/admin-catalogue-agent';
import { catalogueSyncWorkflow } from './workflows/catalogue-sync-workflow';

// Import weather demo (keeping for now)
import { weatherWorkflow } from './workflows/weather-workflow';
import { weatherAgent } from './agents/weather-agent';

/**
 * Main Mastra application configuration
 * 
 * Registers:
 * - Admin catalogue agent for processing schema configurations
 * - Catalogue sync workflow for orchestrating database updates
 * - Weather demo (preserved for compatibility)
 * 
 * Note: LibSQL storage is used for Mastra telemetry and evaluation data,
 * while PostgreSQL (via Prisma) handles journaling data.
 */
export const mastra = new Mastra({
  workflows: { 
    catalogueSyncWorkflow,
    weatherWorkflow, // Keep weather demo for now
  },
  agents: { 
    adminCatalogueAgent,
    weatherAgent, // Keep weather demo for now
  },
  storage: new LibSQLStore({
    // LibSQL for Mastra telemetry - coexists with Prisma-backed PostgreSQL
    url: "file:../mastra.db",
  }),
  logger: new PinoLogger({
    name: 'journal-mastra',
    level: 'info',
  }),
});
