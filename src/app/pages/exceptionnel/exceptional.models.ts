export type { SignatureVisa } from "../../shared/visa.models";
import type { SignatureVisa } from "../../shared/visa.models";

export type ExceptionalOperationType = "astreinte" | "travaux";
export type ExceptionalOperationStatus =
  | "Brouillon"
  | "Planifiée"
  | "En cours"
  | "Signé Agent"
  | "Signé Directeur"
  | "Terminée"
  | "Annulée";
export type SortField = "initiatorName" | "title" | "startDate" | "status" | "type";
export type SortDirection = "asc" | "desc";
export type ModalMode = "create-astreinte" | "create-travaux" | "edit" | "intervention";
export type FilterField = SortField | null;

export interface OperationParticipant {
  userId: string;
  displayName: string;
  email: string;
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
  status: ExceptionalOperationStatus;
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
}

export interface ExceptionalOperationForm {
  type: ExceptionalOperationType;
  initiatorName: string;
  operationManagerName: string;
  title: string;
  startDate: string;
  forecastEndDate: string;
  actualStartDate: string;
  actualEndDate: string;
  status: ExceptionalOperationStatus;
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
