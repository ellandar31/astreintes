import { CalendarDay, CalendarEntry, CalendarHoliday } from "./calendar.models";

/** Local dates avoid UTC shifts when navigating months or crossing daylight-saving boundaries. */
function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Stable colors preserve an event's identity between months and data refreshes. */
function entryColor(entry: CalendarEntry): number {
  let hash = 0;
  for (const character of entry.id) hash = Math.trunc(((hash << 5) - hash) + (character.codePointAt(0) || 0));
  return Math.abs(entry.colorIndex ?? hash) % 6;
}

/** Monday-first, fixed six-week grid; event end dates remain inclusive for visual continuity. */
export function buildCalendarDays(month: Date, entries: readonly CalendarEntry[], holidays: readonly CalendarHoliday[]): CalendarDay[] {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(firstDay);
  start.setDate(1 - (firstDay.getDay() + 6) % 7);
  const byDate = new Map(holidays.map(holiday => [holiday.date, holiday]));
  const sorted = [...entries].sort((first, second) => first.startDate.localeCompare(second.startDate));
  return Array.from({ length: 42 }, (_, offset) => {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    const key = dateKey(date);
    return {
      dateKey: key,
      dayNumber: date.getDate(),
      isCurrentMonth: date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth(),
      holiday: byDate.get(key),
      entries: sorted.filter(entry => entry.startDate.slice(0, 10) <= key && entry.endDate.slice(0, 10) >= key)
        .map(entry => ({ entry, isStart: entry.startDate.slice(0, 10) === key, colorIndex: entryColor(entry) })),
    };
  });
}
