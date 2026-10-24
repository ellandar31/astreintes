/** Retention is measured from RH treatment, never from the operation dates. */
export type RhRetentionYears = 1 | 2;
export type RhPurgeOperationType = "regular" | "exceptionalOnCall" | "exceptionalWork";
export interface RhPurgeOperation {
  id: string;
  type: RhPurgeOperationType;
  title: string;
  treatedAt: string;
  /** User purge only: preview whether the last participant will be removed. */
  deleteOperation?: boolean;
}
