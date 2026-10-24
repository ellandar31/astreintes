import { isArchivedOperation } from "../../shared/operation-archive";
import { CalendarEntry } from "../../shared/calendar/calendar.models";
import { ExceptionalOperation } from "./exceptional.models";

/** Use the planning bounds shown in the list, with actual dates as a legacy fallback.
 * One event represents one operation, regardless of its number of participants.
 */
export function exceptionalCalendarEntries(operations: readonly ExceptionalOperation[]): CalendarEntry[] {
  return operations.flatMap(operation => {
    const startDate = operation.startDate || operation.actualStartDate;
    const endDate = operation.forecastEndDate || operation.actualEndDate || startDate;
    return startDate ? [{ id: operation.id, label: operation.title, startDate, endDate, disabled: isArchivedOperation(operation) }] : [];
  });
}
