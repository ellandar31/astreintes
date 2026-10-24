import { Pipe, PipeTransform } from "@angular/core";

export type TableFields<T> = Record<string, (row: T) => unknown>;

/** Sort a local array, never an NgRx collection or the source order of editable rows.
 * Pure-pipe caching keeps PrimeNG inputs stable until data or lookup references change.
 */
@Pipe({ name: "tableRows", standalone: true, pure: true })
export class TableRowsPipe implements PipeTransform {
  transform<T extends object>(rows: readonly T[] | null | undefined, fields?: TableFields<T>, _lookup?: unknown): T[] {
    return (rows ?? []).map(row => fields
      ? { ...row, tableSource: row, ...Object.fromEntries(Object.entries(fields).map(([key, project]) => [key, project(row)])) }
      : row);
  }
}

/** Calendar comparisons accept SQL dates and the French date ranges displayed in history. */
export function tableDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const french = typeof value === "string" ? value.match(/(\d{2})\/(\d{2})\/(\d{4})(?:[ ,]+(\d{2}):(\d{2}))?/) : null;
  const date = french ? new Date(+french[3], +french[2] - 1, +french[1], +(french[4] || 0), +(french[5] || 0)) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
