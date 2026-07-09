import { SignatureVisa } from "../../shared/visa.models";

export interface RegularTeam {
  id: string;
  name: string;
  members: string[];
}

export interface RegularUser {
  id: string;
  displayName: string;
  email: string;
}

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
  agentVisa?: SignatureVisa;
}

export interface RegularInterventionForm {
  userId: string;
  userName: string;
  userEmail: string;
  startDate: string;
  endDate: string;
  comment: string;
}

export interface RegularPublicHoliday {
  id: string;
  date: string;
  label: string;
}
