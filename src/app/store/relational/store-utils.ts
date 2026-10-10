import { SupabaseClient } from "@supabase/supabase-js";
import { JsonRecord, RelationalTable } from "../../types";

let subscriptionSequence = 0;

/** A process-local counter suffices for channel names; these are not authentication tokens. */
export function generatedSubscriptionId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `watch-${Date.now().toString(36)}-${(++subscriptionSequence).toString(36)}`;
}

export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Erreur Supabase inconnue.");
}

export function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Unnamed profiles still need a visible identity in calendars and participant rows. */
export function userDisplayName(user: JsonRecord): string {
  return text(user["display_name"]).trim() || text(user["email"]).trim();
}

export function nullableText(value: unknown): string | null {
  return text(value).trim() || null;
}

/** UI identifiers stay strings while PostgreSQL owns numeric identity generation. */
export function idText(value: unknown): string {
  return typeof value === "number" || typeof value === "bigint" ? String(value) : text(value);
}

export function numberId(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function visaKey(targetId: unknown, scope: string): string {
  return `${idText(targetId)}:${scope}`;
}

export function participantKey(operationId: number, kind: string): string {
  return `${operationId}:${kind}`;
}

/** Resolve memberships to application IDs before writing relational foreign keys. */
export function stringIds(value: unknown): string[] {
  return Array.isArray(value) ? value.map(idText).filter(Boolean) : [];
}

/** Database cascades own child cleanup; invalid nonnumeric IDs cannot identify a relational row. */
export async function deleteById(client: SupabaseClient, table: RelationalTable, id: number | null): Promise<void> {
  if (!id) return;
  const { error } = await client.from(table).delete().eq("id", id);
  if (error) throw error;
}
