export function formatDate(value: string): string {
  return value ? new Intl.DateTimeFormat("fr-FR").format(new Date(value)) : "";
}

export function formatTime(value: string): string {
  return value ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "";
}

export function formatRange(startValue: string, endValue: string): string {
  return `${formatDate(startValue)} ${formatTime(startValue)} - ${formatDate(endValue)} ${formatTime(endValue)}`;
}

export function escapeHtml(value: string): string {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
