import { ExceptionalOperation } from "./exceptional.models";
import { RegularIntervention, RegularOnCallPeriod } from "./regular.models";

/** Updates use NULL to explicitly cancel an RH send; omission preserves its timestamp. */
export type RegularPeriodUpdate = Partial<Omit<RegularOnCallPeriod, "id" | "sentToRhAt">> & { sentToRhAt?: string | null };
export type RegularInterventionUpdate = Partial<Omit<RegularIntervention, "id">>;
export type ExceptionalOperationUpdate = Partial<Omit<ExceptionalOperation, "id" | "sentToRhAt">> & { sentToRhAt?: string | null };

export interface RhExportConfiguration {
  generationApiUrl: string;
}

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
