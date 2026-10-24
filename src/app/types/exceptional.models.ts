export type { SignatureVisa } from "./signature.models";
import type { SignatureVisa } from "./signature.models";
import type { ManagedUser } from "./user.models";

export type ExceptionalOperationType = "astreinte" | "travaux";
export type SortField = "initiatorName" | "title" | "startDate" | "type";
export type SortDirection = "asc" | "desc";
export type ModalMode = "create-astreinte" | "create-travaux" | "edit" | "intervention";
export type FilterField = SortField | null;

export interface OperationParticipant {
  /** SQL target used to update a visa without replacing the planning row. */
  id?: string;
  userId: string;
  displayName: string;
  email: string;
  startDate: string;
  endDate: string;
  visa: SignatureVisa;
}

export type SelectableUser = Pick<ManagedUser, "id" | "uid" | "displayName" | "email" | "directionId" | "deletedAt">;

export interface ExceptionalIntervention {
  /** Persisted identity keeps edits from rebuilding another agent's intervention. */
  id?: string;
  date?: string;
  startDate: string;
  endDate: string;
  userId: string;
  userName: string;
  userEmail: string;
  wasOnSite: boolean;
  agentVisa: SignatureVisa;
  label: string;
  comment: string;
  /** External ticket reference; optional for historical interventions. */
  ticket?: string;
}

export interface ExceptionalOperation {
  directionId?: string;
  id: string;
  type: ExceptionalOperationType;
  initiatorName: string;
  initiatorUid: string;
  operationManagerName: string;
  operationManagerUid: string;
  title: string;
  startDate: string;
  forecastEndDate: string;
  actualStartDate: string;
  actualEndDate: string;
  plannedUsers: OperationParticipant[];
  actualUsers: OperationParticipant[];
  visas: {
    initiatorGlobal?: SignatureVisa;
    directorGlobal?: SignatureVisa;
    plannedInitiator: SignatureVisa;
    plannedDirector: SignatureVisa;
    actualInitiator: SignatureVisa;
    actualDirector: SignatureVisa;
  };
  /** Only exceptional on-call periods have interventions; work operations keep this array empty. */
  interventions: ExceptionalIntervention[];
  sentToRhAt?: string;
  /** Date of RH processing, independent of submission. */
  treatedAt?: string;
}

export interface ExceptionalOperationForm {
  directionId?: string;
  type: ExceptionalOperationType;
  initiatorUid: string;
  initiatorName: string;
  operationManagerName: string;
  title: string;
  startDate: string;
  forecastEndDate: string;
  actualStartDate: string;
  actualEndDate: string;
  plannedUsers: OperationParticipant[];
  actualUsers: OperationParticipant[];
}

export interface ExceptionalInterventionForm {
  startDate: string;
  endDate: string;
  userId: string;
  userName: string;
  userEmail: string;
  wasOnSite: boolean;
  label: string;
  comment: string;
  /** External ticket reference; optional for historical interventions. */
  ticket?: string;
}
