import { SignatureVisa } from "./signature.models";
import { OnCallCompensationRule, PeriodCompensationRule } from "./settings.models";

export type { OnCallCompensationRule, PeriodCompensationRule } from "./settings.models";
/** Business categories shared by Excel exports. */
export type ExportTemplateId = "regular" | "exceptionalOnCall" | "exceptionalWork";
/** Calendar-date bounds apply to RH submission, not the worked period. */
export interface RhExportPeriod { startDate: string; endDate: string }
export type RhPeriodExportOperations = Record<ExportTemplateId, ExportOperation[]>;

export interface CalculationSegment {
  startDate: string;
  endDate: string;
  hours: number;
  detail?: string;
}

/** Prepared export view; sourceCollection classifies the business source, not a persistence document reference. */
export interface ExportOperation {
  sourceId: string;
  sourceCollection: "regularOnCallPeriods" | "exceptionalOperations";
  title: string;
  exportTitle: string;
  initiatorName: string;
  operationManagerName: string;
  forecastStartDate: string;
  forecastEndDate: string;
  actualStartDate: string;
  actualEndDate: string;
  plannedUsers: Array<{ name: string; startDate: string; endDate: string; visa: SignatureVisa; userId?: string }>;
  actualUsers: Array<{ name: string; startDate: string; endDate: string; visa: SignatureVisa; userId?: string }>;
  interventions: Array<{
    ticket?: string;
    userId?: string;
    userName: string;
    startDate: string;
    endDate: string;
    wasOnSite: boolean;
    comment: string;
    visa: SignatureVisa;
  }>;
  initiatorVisa: SignatureVisa;
  directorVisa: SignatureVisa;
  sentToRhAt?: string;
}

export interface RhExportContext {
  publicHolidays: Array<{ date: string; label?: string }>;
  onCallCompensationRules: OnCallCompensationRule[];
  periodCompensationRules: PeriodCompensationRule[];
}

export interface OnCallCompensationRow {
  name: string;
  startDate: string;
  endDate: string;
  label: string;
  hours: number;
  coefficient: number;
  segments: CalculationSegment[];
}

export interface InterventionCompensationRow {
  ticket?: string;
  userName: string;
  startDate: string;
  endDate: string;
  label: string;
  hours: number;
  coefficient: number;
  restCoefficient: number;
  comment: string;
  segments: CalculationSegment[];
}
