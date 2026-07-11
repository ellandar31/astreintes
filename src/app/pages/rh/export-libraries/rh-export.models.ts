import { SignatureVisa } from "../../../shared/visa.models";

export type ExportTemplateId = "regular" | "exceptionalOnCall" | "exceptionalWork";

export interface WordExportTemplate {
  id: ExportTemplateId;
  label: string;
  fileName: string;
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

export interface CalculationSegment {
  startDate: string;
  endDate: string;
  hours: number;
  detail?: string;
}

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
  plannedUsers: Array<{ name: string; startDate: string; endDate: string; visa: SignatureVisa }>;
  actualUsers: Array<{ name: string; startDate: string; endDate: string; visa: SignatureVisa }>;
  interventions: Array<{
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
