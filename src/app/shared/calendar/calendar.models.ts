/** Presentation contract independent from operation families, permissions and persistence. */
export interface CalendarEntry {
  id: string;
  label: string;
  /** Local calendar date or datetime; both boundary days are displayed, as in the regular planning. */
  startDate: string;
  endDate: string;
  disabled?: boolean;
  colorIndex?: number;
}

export interface CalendarHoliday { date: string; label: string }

export interface CalendarDay {
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  holiday?: CalendarHoliday;
  entries: Array<{ entry: CalendarEntry; isStart: boolean; colorIndex: number }>;
}
