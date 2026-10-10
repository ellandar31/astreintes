export type SettingsSection = "teams" | "users" | "schedules" | "holidays" | "rhControls" | "rhCompensation" | "rhExports";
export type ScheduleDay = "Lundi" | "Mardi" | "Mercredi" | "Jeudi" | "Vendredi" | "Samedi" | "Dimanche" | "Jour férié";
export type { ManagedUser, UserRole } from "./user.models";

export interface Team {
  id: string;
  name: string;
  members: string[];
}

export interface ScheduleRule {
  id: string;
  day: ScheduleDay;
  hoStart: string;
  hoEnd: string;
}

export interface PublicHoliday {
  id: string;
  date: string;
  label: string;
  zone: string;
  source: "api.gouv.fr" | "manual";
}

export interface OnCallCompensationRule {
  id: string;
  label: string;
  coefficient: number;
}

export interface PeriodCompensationRule {
  id: string;
  label: string;
  interventionCoefficient: number;
  workCoefficient: number;
  restCoefficient: number;
}

export interface RhCompensationSettings {
  onCall: OnCallCompensationRule[];
  periods: PeriodCompensationRule[];
}

export interface RhExportTemplateSetting {
  id: "regular" | "exceptionalOnCall" | "exceptionalWork";
  label: string;
  fileName: string;
  templateFileName?: string;
  dataModelFileName?: string;
  generationTemplate?: unknown;
  dataModel?: unknown;
}
