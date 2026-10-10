import { text } from "./store-utils";

const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;

/**
 * datetime-local rejects timezone suffixes. Convert database instants into the
 * browser's local wall time, consistently with the existing calendar forms.
 * The optional timezone allows deterministic daylight-saving regression tests.
 */
export function dateTimeLocalText(value: unknown, timeZone?: string): string {
  const raw = text(value).trim().replace(" ", "T");
  if (!raw) {
    return "";
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  // Form values already express local wall time, so no conversion is necessary.
  if (localDateTimePattern.test(raw)) {
    return raw.slice(0, 16);
  }
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const fields = new Map(parts.map(part => [part.type, part.value]));
  return `${fields.get("year")}-${fields.get("month")}-${fields.get("day")}T${fields.get("hour")}:${fields.get("minute")}`;
}

/**
 * PostgreSQL must receive an explicit instant: a timezone-free form value would
 * otherwise be interpreted in the database session timezone instead of the user's.
 * Empty optional operation boundaries remain NULL. Audit timestamps are separate.
 */
export function databaseDateTime(value: unknown): string | null {
  const raw = text(value).trim();
  if (!raw) {
    return null;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date-time value.");
  }
  return date.toISOString();
}
