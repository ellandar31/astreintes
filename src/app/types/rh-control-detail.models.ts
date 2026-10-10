export interface RhControlDetailLine {
  id: string;
  nature: string;
  label: string;
  period: string;
  hours: number;
  coefficient: number;
  restCoefficient?: number;
  details: string;
}

export interface RhControlDetailItem {
  id: string;
  type: string;
  title: string;
  sentToRhAt: unknown;
  sentToRhLabel: string;
  period: string;
  lines: RhControlDetailLine[];
}
