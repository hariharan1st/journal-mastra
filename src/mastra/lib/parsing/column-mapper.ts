/**
 * Column mapping utilities for converting logical field names to physical database column names
 */

/**
 * Apply column mappings to field values
 *
 * @param fields - Record of logical field names to values
 * @param mappings - Optional mapping from logical to physical column names
 * @returns Record with physical column names
 */
export function applyColumnMappings(
  fields: Record<string, any>,
  mappings?: Record<string, string>
): Record<string, any> {
  if (!mappings) {
    // No mappings defined, return as-is
    return fields;
  }

  const mapped: Record<string, any> = {};

  for (const [logicalName, value] of Object.entries(fields)) {
    // Use mapped name if it exists, otherwise use logical name
    const physicalName = mappings[logicalName] || logicalName;
    mapped[physicalName] = value;
  }

  return mapped;
}

/**
 * Reverse column mappings (physical -> logical)
 *
 * @param mappings - Mapping from logical to physical column names
 * @returns Reversed mapping from physical to logical names
 */
export function reverseColumnMappings(
  mappings: Record<string, string>
): Record<string, string> {
  const reversed: Record<string, string> = {};

  for (const [logical, physical] of Object.entries(mappings)) {
    reversed[physical] = logical;
  }

  return reversed;
}

/**
 * Validate that all mapped columns exist in the field list
 *
 * @param fieldNames - Array of logical field names
 * @param mappings - Mapping from logical to physical column names
 * @throws Error if mapping references non-existent field
 */
export function validateColumnMappings(
  fieldNames: string[],
  mappings?: Record<string, string>
): void {
  if (!mappings) {
    return;
  }

  const fieldSet = new Set(fieldNames);

  for (const logicalName of Object.keys(mappings)) {
    if (!fieldSet.has(logicalName)) {
      throw new Error(
        `Column mapping references unknown field: '${logicalName}'`
      );
    }
  }
}
