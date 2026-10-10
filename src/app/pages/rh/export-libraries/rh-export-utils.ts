import { APP_LABELS } from "../../../i18n/labels";

/** Uses the same local day as the displayed date, including timestamps with an offset. */
export function formatDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  return `${APP_LABELS.rhDocuments.weekdayTrigrams[date.getDay()]} ${new Intl.DateTimeFormat("fr-FR").format(date)}`;
}

export function formatTime(value: string): string {
  return value ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "";
}

export function formatRange(startValue: string, endValue: string): string {
  return `${formatDate(startValue)} ${formatTime(startValue)} - ${formatDate(endValue)} ${formatTime(endValue)}`;
}

export function escapeHtml(value: string): string {
  return (value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
