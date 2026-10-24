
export type UserRole = 0 | 1 | 2 | 3;

/** Administrative projection; signature fields belong to the full application profile. */
export interface ManagedUser {
  id: string;
  uid?: string;
  email: string;
  displayName: string;
  trigram?: string;
  directionId?: string | null;
  /** Company departure date; this does not delete the Auth account. */
  deletedAt?: string | null;
  role: UserRole;
  /** Independent export permission; never grants director or planning privileges. */
  isRh?: boolean;
  lastLoginAt?: unknown;
}

/** Application identity, distinct from the Supabase authentication UUID in uid. */
export interface ApplicationUser extends ManagedUser {
  uid: string;
  signatureName: string;
  lastLoginAt?: string;
}
