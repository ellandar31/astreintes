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
  startDate: string;
  endDate: string;
  userId: string;
  userName: string;
  userEmail: string;
}

export interface RhExceptionalOperation {
  id: string;
  type: "astreinte" | "travaux";
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
