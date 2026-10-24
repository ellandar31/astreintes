
export type UserRole = 0 | 1 | 2 | 3 | 4;

/** Administrative projection; signature fields belong to the full application profile. */
export interface ManagedUser {
  id: string;
  uid?: string;
  email: string;
  displayName: string;
  trigram?: string;
  /** Company departure date; this does not delete the Auth account. */
  deletedAt?: string | null;
  role: UserRole;
  lastLoginAt?: unknown;
}

/** Application identity, distinct from the Supabase authentication UUID in uid. */
export interface ApplicationUser extends ManagedUser {
  uid: string;
  signatureName: string;
  lastLoginAt?: string;
}
