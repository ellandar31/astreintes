export type RhSection = "controls" | "exports";

export interface RhUser {
  id: string;
  displayName: string;
  email: string;
}

export interface RhRegularPeriod {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  startDate: string;
  endDate: string;
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
  plannedUsers?: Array<{ userId: string; displayName: string; email: string }>;
  actualUsers?: Array<{ userId: string; displayName: string; email: string }>;
  interventions?: RhExceptionalIntervention[];
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
