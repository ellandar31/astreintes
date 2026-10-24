import { ExceptionalOperation } from "./exceptional.models";
import { RegularIntervention, RegularOnCallPeriod } from "./regular.models";

/** Updates use NULL to clear RH submission/treatment dates; omission preserves them. */
export type RegularPeriodUpdate = Partial<Omit<RegularOnCallPeriod, "id" | "sentToRhAt" | "treatedAt">> & { sentToRhAt?: string | null; treatedAt?: string | null };
export type RegularInterventionUpdate = Partial<Omit<RegularIntervention, "id">>;
export type ExceptionalOperationUpdate = Partial<Omit<ExceptionalOperation, "id" | "sentToRhAt" | "treatedAt">> & { sentToRhAt?: string | null; treatedAt?: string | null };

/** Auth session identity does not carry the application's administrative role. */
export interface StoreAuthUser {
  displayName: string | null;
  email: string | null;
  uid: string;
}

export interface StoreError {
  code?: string;
  message: string;
}

export type StoreUnsubscribe = () => void;
export type DomainObserver<T> = (next: (value: T) => void, error?: (error: unknown) => void) => StoreUnsubscribe;
