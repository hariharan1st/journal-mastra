# Prisma Transaction Client Model Names - TypeScript Guide

## The Issue

The error `TypeError: Cannot read properties of undefined (reading 'updateMany')` occurred because we were using incorrect model names in Prisma transaction clients.

## Key Differences: Regular Prisma Client vs Transaction Client

### Regular Prisma Client (plural names):

```typescript
const prisma = new PrismaClient();

// Uses PLURAL model names
await prisma.adminRuleSets.findMany();
await prisma.auditEvents.create();
await prisma.trackingCatalogueItems.findFirst();
await prisma.reminderRules.updateMany();
```

### Transaction Client (singular names):

```typescript
await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
  // Uses SINGULAR model names
  await tx.adminRuleSet.findMany(); // NOT adminRuleSets
  await tx.auditEvent.create(); // NOT auditEvents
  await tx.trackingCatalogueItem.findFirst(); // NOT trackingCatalogueItems
  await tx.reminderRule.updateMany(); // NOT reminderRules
});
```

## Model Name Mapping

Based on the Prisma schema, here are the correct mappings:

| Schema Model             | Regular Client            | Transaction Client       |
| ------------------------ | ------------------------- | ------------------------ |
| `AdminRuleSet`           | `adminRuleSets`           | `adminRuleSet`           |
| `AuditEvent`             | `auditEvents`             | `auditEvent`             |
| `CaregiverProfile`       | `caregiverProfiles`       | `caregiverProfile`       |
| `DocumentEmbedding`      | `documentEmbeddings`      | `documentEmbedding`      |
| `Document`               | `documents`               | `document`               |
| `JournalEntryTable`      | `journalEntryTables`      | `journalEntryTable`      |
| `ReminderDispatch`       | `reminderDispatches`      | `reminderDispatch`       |
| `ReminderRule`           | `reminderRules`           | `reminderRule`           |
| `TrackingCatalogueField` | `trackingCatalogueFields` | `trackingCatalogueField` |
| `TrackingCatalogueItem`  | `trackingCatalogueItems`  | `trackingCatalogueItem`  |
| `UserProfile`            | `userProfiles`            | `userProfile`            |

## How to Inspect Available Models in TypeScript

### Method 1: Type-safe inspection

```typescript
import { Prisma } from "@prisma/client";

const transaction = async (tx: Prisma.TransactionClient) => {
  // TypeScript IntelliSense will show available properties
  // Just type "tx." and your IDE will show all available models

  // Check if a model exists
  const hasAdminRuleSet = "adminRuleSet" in tx;
  console.log("Available models:", Object.keys(tx));
};
```

### Method 2: Runtime exploration utility

```typescript
export function explorePrismaTransaction() {
  const exampleTransaction = async (tx: Prisma.TransactionClient) => {
    console.log("Transaction client model keys:", Object.keys(tx));

    // Each model has methods like:
    // - findFirst, findMany, findUnique
    // - create, createMany
    // - update, updateMany
    // - upsert
    // - delete, deleteMany
  };

  return exampleTransaction;
}
```

### Method 3: TypeScript utility function

```typescript
export function hasModel<T extends keyof Prisma.TransactionClient>(
  tx: Prisma.TransactionClient,
  modelName: T
): boolean {
  return modelName in tx && typeof tx[modelName] === "object";
}

// Usage:
const hasAdminRuleSet = hasModel(tx, "adminRuleSet"); // true
const hasWrongName = hasModel(tx, "adminRuleSets"); // false
```

## Best Practices

1. **Always use TypeScript**: The type system will catch these errors at compile time
2. **Use proper typing**: Type transaction parameters as `Prisma.TransactionClient`
3. **Enable strict mode**: Helps catch undefined property access
4. **Use IDE autocomplete**: Let your IDE suggest the correct model names
5. **Test thoroughly**: Run `npx tsc --noEmit` to catch type errors

## Fixed Files in This Project

- `src/mastra/tools/catalogue-schema-tool.ts` - Fixed adminRuleSets → adminRuleSet
- `src/mastra/services/reminder-rule-service.ts` - Fixed reminderRules → reminderRule
- `src/mastra/tools/journal-writer-tool.ts` - Fixed multiple snake_case models
- `src/mastra/workflows/catalogue-sync-workflow.ts` - Fixed auditEvents → auditEvent
- `src/mastra/lib/prisma-client.ts` - Fixed transaction client typing
