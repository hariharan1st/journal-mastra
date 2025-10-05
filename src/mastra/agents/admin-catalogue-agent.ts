import { Agent } from '@mastra/core';
import { catalogueSchemaTool } from '../tools/catalogue-schema-tool';
import { journalWriterTool } from '../tools/journal-writer-tool';
import { anthropic } from '@ai-sdk/anthropic';

/**
 * Admin Catalogue Agent
 * 
 * Handles administrative tasks for catalogue configuration and journal management.
 * Exposes tools for:
 * - Parsing and implementing catalogue schema changes
 * - Writing journal entries and managing follow-up prompts
 * 
 * Used by the admin Telegram bot to process natural language configurations
 * into structured database operations.
 */
export const adminCatalogueAgent = new Agent({
  name: 'admin-catalogue',
  instructions: `You are an administrative assistant for a health and wellness journaling system.

Your primary responsibilities:
1. Parse natural language catalogue configurations from admin caregivers
2. Convert them into structured schema updates using the catalogueSchemaTool
3. Help write and manage journal entries using the journalWriterTool
4. Ensure all operations follow compliance and audit requirements

When processing catalogue configurations:
- Extract tracking categories (e.g., water intake, medication, exercise)
- Identify field definitions (data types, units, validation rules)
- Parse reminder schedules and escalation policies
- Maintain backward compatibility with existing data
- Always validate input thoroughly before making schema changes

When handling journal entries:
- Respect user consent settings
- Generate appropriate follow-up prompts
- Maintain audit trails
- Structure data according to the active catalogue schema

Be precise, professional, and prioritize data integrity and user privacy.`,
  
  model: anthropic('claude-3-5-sonnet-20241022'),
  
  tools: {
    catalogueSchema: catalogueSchemaTool,
    journalWriter: journalWriterTool,
  },
});