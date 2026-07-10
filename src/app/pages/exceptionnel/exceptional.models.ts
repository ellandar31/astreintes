export type { SignatureVisa } from "../../shared/visa.models";
import type { SignatureVisa } from "../../shared/visa.models";

export type ExceptionalOperationType = "astreinte" | "travaux";
export type SortField = "initiatorName" | "title" | "startDate" | "type";
export type SortDirection = "asc" | "desc";
export type ModalMode = "create-astreinte" | "create-travaux" | "edit" | "intervention";
export type FilterField = SortField | null;

export interface OperationParticipant {
  userId: string;
  displayName: string;
  email: string;
  startDate: string;
  endDate: string;
  visa: SignatureVisa;
}

export interface SelectableUser {
  id: string;
  uid?: string;
  displayName: string;
  email: string;
}

export interface ExceptionalIntervention {
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
}

export interface ExceptionalOperation {
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
  interventions: ExceptionalIntervention[];
  sentToRhAt?: string;
}

export interface ExceptionalOperationForm {
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
}
