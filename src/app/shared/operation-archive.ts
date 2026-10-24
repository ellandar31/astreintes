/** Sent or treated operations belong to history; export selectors keep the complete data. */
export function isArchivedOperation(operation: { sentToRhAt?: unknown; treatedAt?: unknown }): boolean {
  return Boolean(operation.sentToRhAt || operation.treatedAt);
}
