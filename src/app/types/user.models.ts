import { VisaSignatureMode } from "./signature.models";

export type UserRole = 0 | 1 | 2 | 3;

/** Administrative projection; signature fields belong to the full application profile. */
export interface ManagedUser {
  id: string;
  uid?: string;
  email: string;
  displayName: string;
  role: UserRole;
  lastLoginAt?: unknown;
}

/** Application identity, distinct from the Supabase authentication UUID in uid. */
export interface ApplicationUser extends ManagedUser {
  uid: string;
  signatureMode: VisaSignatureMode;
  signatureName: string;
  signatureImage: string;
  signatureDrawing: string;
  lastLoginAt?: string;
}
