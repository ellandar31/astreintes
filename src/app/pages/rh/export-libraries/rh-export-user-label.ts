/** Missing historical profile fields are omitted without leaving empty separators. */
export function formatRhExportUser(trigram: string | undefined, name: string | undefined, email: string | undefined): string {
  return [trigram?.trim(), name?.trim(), email?.trim() ? `(${email.trim()})` : ""].filter(Boolean).join(" - ");
}
