import { SignatureVisa } from "./signature.models";
import { Team } from "./settings.models";
import { ManagedUser } from "./user.models";

export type RegularTeam = Team;
export type RegularUser = Pick<ManagedUser, "id" | "displayName" | "email">;

export interface RegularOnCallPeriod {
  id: string;
  teamId: string;
  userId: string;
  userName: string;
  userEmail: string;
  startDate: string;
  endDate: string;
  agentVisa?: SignatureVisa;
  directorVisa?: SignatureVisa;
  sentToRhAt?: string;
  /** Date of RH processing, independent of submission. */
  treatedAt?: string;
}

export interface RegularOnCallPeriodForm {
  userId: string;
  userName: string;
  userEmail: string;
  startDate: string;
  endDate: string;
}

export interface RegularIntervention {
  id: string;
  periodId: string;
  teamId: string;
  userId: string;
  userName: string;
  userEmail: string;
  startDate: string;
  endDate: string;
  comment: string;
  /** External ticket reference; optional for historical interventions. */
  ticket?: string;
  agentVisa?: SignatureVisa;
}

export interface RegularInterventionForm {
  userId: string;
  userName: string;
  userEmail: string;
  startDate: string;
  endDate: string;
  comment: string;
  /** External ticket reference; optional for historical interventions. */
  ticket?: string;
}

export interface RegularPublicHoliday {
  id: string;
  date: string;
  label: string;
}
