#!/usr/bin/env tsx

import { catalogueSchemaToolImpl } from '../../src/mastra/tools/catalogue-schema-tool';
import { getPrismaClient } from '../../src/mastra/lib/prisma-client';

/**
 * Bootstrap Script: Create Admin Rule Set
 * 
 * Creates a sample admin rule set through the catalogue schema tool
 * to demonstrate the complete journaling system functionality.
 * 
 * This script:
 * 1. Creates a sample health tracking catalogue 
 * 2. Sets up dynamic tables for water, medication, and exercise tracking
 * 3. Configures reminder rules with escalation policies
 * 4. Demonstrates the complete tool chain
 * 
 * Usage:
 *   npm run bootstrap:admin-rule-set
 *   or
 *   npx tsx scripts/dev/create-admin-rule-set.ts
 */

const SAMPLE_ADMIN_TEXT = `
I want to set up health tracking for our patients with the following categories:

**Water Intake Tracking**
- Track glasses of water consumed daily
- Fields: quantity (number), type (tap/bottled/filtered), time of day
- Remind patients 3 times daily: 8 AM, 2 PM, 8 PM Eastern Time
- Escalate to caregiver after 1 hour if no response
- Tag as: hydration, wellness

**Medication Adherence**
- Track daily medication doses
- Fields: medication_name (text), dosage (text), taken (yes/no), side_effects (text, optional)
- Remind based on individual prescriptions (default: 9 AM, 6 PM)
- Escalate to caregiver after 30 minutes, admin after 2 hours
- Tag as: medication, compliance, safety

**Exercise Activity**
- Track weekly exercise sessions
- Fields: activity_type (walking/swimming/yoga/other), duration_minutes (number), intensity (low/medium/high)
- Weekly reminder on Sundays at 10 AM
- Escalate to caregiver after 1 day
- Tag as: exercise, wellness, mental_health

**Retention Policy**
- Keep journal entries for 1 year (365 days)
- Keep uploaded documents for 6 months (180 days)
`;

async function createAdminRuleSet() {
  console.log('🚀 Starting Admin Rule Set Bootstrap...\n');

  try {
    // Prepare the catalogue request
    const catalogueRequest = {
      adminRuleSetId: null, // Create new rule set
      parsedAt: new Date().toISOString(),
      sourceText: SAMPLE_ADMIN_TEXT,
      metrics: [
        {
          slug: 'water-intake',
          displayName: 'Water Intake',
          description: 'Daily water consumption tracking',
          fields: [
            {
              name: 'quantity',
              label: 'Number of glasses',
              dataType: 'integer' as const,
              required: true,
            },
            {
              name: 'water_type',
              label: 'Type of water',
              dataType: 'enum' as const,
              enumValues: ['tap', 'bottled', 'filtered'],
              required: false,
            },
            {
              name: 'time_consumed',
              label: 'Time consumed',
              dataType: 'datetime' as const,
              required: false,
            },
          ],
          reminderPolicy: {
            schedule: '0 8,14,20 * * *', // 8 AM, 2 PM, 8 PM daily
            timezone: 'America/New_York',
            escalation: {
              notifyCaregiverAfterMinutes: 60,
            },
          },
          analyticsTags: ['hydration', 'wellness'],
        },
        {
          slug: 'medication',
          displayName: 'Medication Adherence',
          description: 'Daily medication tracking and adherence monitoring',
          fields: [
            {
              name: 'medication_name',
              label: 'Medication name',
              dataType: 'text' as const,
              required: true,
            },
            {
              name: 'dosage',
              label: 'Dosage taken',
              dataType: 'text' as const,
              required: true,
            },
            {
              name: 'taken',
              label: 'Medication taken',
              dataType: 'boolean' as const,
              required: true,
            },
            {
              name: 'side_effects',
              label: 'Side effects noted',
              dataType: 'text' as const,
              required: false,
            },
          ],
          reminderPolicy: {
            schedule: '0 9,18 * * *', // 9 AM, 6 PM daily
            timezone: 'America/New_York',
            escalation: {
              notifyCaregiverAfterMinutes: 30,
              notifyAdminAfterMinutes: 120,
            },
          },
          analyticsTags: ['medication', 'compliance', 'safety'],
        },
        {
          slug: 'exercise',
          displayName: 'Exercise Activity',
          description: 'Weekly exercise and physical activity tracking',
          fields: [
            {
              name: 'activity_type',
              label: 'Type of activity',
              dataType: 'enum' as const,
              enumValues: ['walking', 'swimming', 'yoga', 'other'],
              required: true,
            },
            {
              name: 'duration_minutes',
              label: 'Duration in minutes',
              dataType: 'integer' as const,
              required: true,
            },
            {
              name: 'intensity',
              label: 'Exercise intensity',
              dataType: 'enum' as const,
              enumValues: ['low', 'medium', 'high'],
              required: true,
            },
          ],
          reminderPolicy: {
            schedule: '0 10 * * 0', // Sunday at 10 AM
            timezone: 'America/New_York',
            escalation: {
              notifyCaregiverAfterMinutes: 1440, // 1 day
            },
          },
          analyticsTags: ['exercise', 'wellness', 'mental_health'],
        },
      ],
      retention: {
        journalRetentionDays: 365,
        documentRetentionDays: 180,
      },
    };

    console.log('📝 Processing catalogue configuration...');
    
    // Execute the catalogue schema tool
    const response = await catalogueSchemaToolImpl.processSchemaUpdate(
      catalogueRequest,
      'bootstrap-script'
    );

    console.log('✅ Admin Rule Set created successfully!\n');
    console.log('📊 Results:');
    console.log(`   Rule Set ID: ${response.ruleSetId}`);
    console.log(`   Version: ${response.version}`);
    console.log(`   Tables affected: ${response.actions.length}`);
    console.log(`   Reminder rules: ${response.reminderActions?.length || 0}`);
    console.log(`   Audit Event ID: ${response.auditEventId}\n`);

    // Display table actions
    if (response.actions.length > 0) {
      console.log('🗃️  Database Changes:');
      response.actions.forEach((action: any) => {
        switch (action.type) {
          case 'create_table':
            console.log(`   ➕ Created table: ${action.tableName}`);
            if (action.columns) {
              action.columns.forEach((col: any) => {
                console.log(`      - ${col.name}: ${col.sqlType}${col.nullable ? ' (nullable)' : ''}`);
              });
            }
            break;
          case 'alter_table_add_columns':
            console.log(`   🔧 Modified table: ${action.tableName}`);
            if (action.columns) {
              action.columns.forEach((col: any) => {
                console.log(`      + Added ${col.name}: ${col.sqlType}${col.nullable ? ' (nullable)' : ''}`);
              });
            }
            break;
          case 'no_change':
            console.log(`   ✓ No changes needed: ${action.tableName}`);
            break;
        }
      });
      console.log();
    }

    // Display reminder actions
    if (response.reminderActions && response.reminderActions.length > 0) {
      console.log('⏰ Reminder Rules:');
      response.reminderActions.forEach((action: any) => {
        switch (action.type) {
          case 'upsert_rule':
            console.log(`   📅 Set reminder: ${action.reminderRuleId}`);
            console.log(`      Schedule: ${action.schedule} (${action.timezone})`);
            break;
          case 'disable_rule':
            console.log(`   ❌ Disabled rule: ${action.reminderRuleId}`);
            break;
        }
      });
      console.log();
    }

    console.log('🎉 Bootstrap completed! The system is ready for journaling.');
    console.log('\nNext steps:');
    console.log('1. Start the Mastra service: npm run dev');
    console.log('2. Test with admin agent configuration');
    console.log('3. Try journal entries for the configured categories');

  } catch (error) {
    console.error('❌ Bootstrap failed:', error);
    
    if (error instanceof Error) {
      console.error('\nError details:', error.message);
      if (error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
    }
    
    process.exit(1);
  } finally {
    // Ensure Prisma connection is closed
    const prisma = getPrismaClient();
    await prisma.$disconnect();
  }
}

// Run the bootstrap if this file is executed directly
if (require.main === module) {
  createAdminRuleSet().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { createAdminRuleSet };