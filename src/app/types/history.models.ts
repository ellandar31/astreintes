export interface HistoryDetailLine {
  ticket?: string;
  id: string;
  nature: string;
  label: string;
  period: string;
  hours: number;
  coefficient: number;
  restCoefficient?: number;
  details: string;
}

export interface HistoryDetailItem {
  sourceId?: string;
  sourceCollection?: "regularOnCallPeriods" | "exceptionalOperations";
  treatedAt?: string;
  id: string;
  type: string;
  title: string;
  sentToRhAt: unknown;
  sentToRhLabel: string;
  period: string;
  lines: HistoryDetailLine[];
}
