import { SignatureVisa } from "../../shared/visa.models";

export type RhSection = "controls" | "exports";

export interface RhUser {
  id: string;
  displayName: string;
  email: string;
  role?: number;
}

export interface RhRegularPeriod {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  startDate: string;
  endDate: string;
  agentVisa?: SignatureVisa;
  directorVisa?: SignatureVisa;
  sentToRhAt?: string;
}

export interface RhPublicHoliday {
  id: string;
  date: string;
  label: string;
}

export interface RhExceptionalIntervention {
  date?: string;
  startDate: string;
  endDate: string;
  userId: string;
  userName: string;
  userEmail: string;
  wasOnSite?: boolean;
  label?: string;
  comment?: string;
  agentVisa?: SignatureVisa;
}

export interface RhExceptionalOperation {
  id: string;
  type: "astreinte" | "travaux";
  initiatorName: string;
  operationManagerName: string;
  title: string;
  startDate: string;
  forecastEndDate: string;
  actualStartDate: string;
  actualEndDate: string;
  plannedUsers?: Array<{ userId: string; displayName: string; email: string; startDate?: string; endDate?: string; visa?: SignatureVisa }>;
  actualUsers?: Array<{ userId: string; displayName: string; email: string; startDate?: string; endDate?: string; visa?: SignatureVisa }>;
  interventions?: RhExceptionalIntervention[];
  visas?: {
    initiatorGlobal?: SignatureVisa;
    directorGlobal?: SignatureVisa;
    plannedInitiator?: SignatureVisa;
    plannedDirector?: SignatureVisa;
    actualInitiator?: SignatureVisa;
    actualDirector?: SignatureVisa;
  };
  sentToRhAt?: string;
}

export interface RhControlRow {
  userId: string;
  userLabel: string;
  onCallHoursLast15Days: number;
  onCallHoursMonth: number;
  saturdayCount: number;
  sundayCount: number;
  holidayCount: number;
  exceptionalWorkHoursWeek: number;
  exceptionalWorkHoursQuarter: number;
}
