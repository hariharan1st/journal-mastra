import { Prisma } from "@prisma/client";

/**
 * Utility function to explore available models in a Prisma transaction
 * This is helpful for debugging and understanding the transaction client interface
 */
export function explorePrismaTransaction() {
  // This function demonstrates how to access transaction client models
  // The models available in tx are singular, not plural:

  const exampleTransaction = async (tx: Prisma.TransactionClient) => {
    // Available models (singular names):
    // tx.adminRuleSet
    // tx.auditEvent
    // tx.caregiverProfile
    // tx.documentEmbedding
    // tx.document
    // tx.journalEntry
    // tx.reminderDispatch
    // tx.reminderRule
    // tx.trackingCatalogueField
    // tx.trackingCatalogueItem
    // tx.userProfile

    // Each model has methods like:
    // - findFirst, findMany, findUnique
    // - create, createMany
    // - update, updateMany
    // - upsert
    // - delete, deleteMany

    console.log("Transaction client model keys:", Object.keys(tx));
  };

  return exampleTransaction;
}

/**
 * Type-safe way to check if a model exists on the transaction client
 */
export function hasModel<T extends keyof Prisma.TransactionClient>(
  tx: Prisma.TransactionClient,
  modelName: T
): boolean {
  return modelName in tx && typeof tx[modelName] === "object";
}
