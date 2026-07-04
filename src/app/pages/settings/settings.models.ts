export type SettingsSection = "teams" | "schedules" | "users" | "holidays";
export type ScheduleDay = "Lundi" | "Mardi" | "Mercredi" | "Jeudi" | "Vendredi" | "Samedi" | "Dimanche" | "Jour férié";
export type UserRole = 0 | 1 | 2;

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
  hnoStart: string;
  hnoEnd: string;
  standbyPrime: number;
  interventionPrime: number;
}

export interface ManagedUser {
  id: string;
  uid?: string;
  email: string;
  displayName: string;
  role: UserRole;
  lastLoginAt?: unknown;
}

export interface PublicHoliday {
  id: string;
  date: string;
  label: string;
  zone: string;
  source: "api.gouv.fr" | "manual";
}
