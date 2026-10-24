import { NewApplicationUser, UserAssignmentUpdate } from "../../types/user.models";
import { ApplicationUser, UserRole } from "../../types";
import { SupabaseClient } from "@supabase/supabase-js";
import { JsonRecord } from "./store-types";
import { text, nullableText, idText, numberId, isUuid, deleteById } from "./store-utils";

function userRoleToDb(value: unknown): "admin" | "user" | "initiator" | "director" {
  const role = value;
  if (role === 0) {
    return "admin";
  }
  if (role === 2) {
    return "initiator";
  }
  if (role === 3) {
    return "director";
  }
  if (role === 1) {
    return "user";
  }
  throw new Error("Invalid application role");
}

function userRoleFromDb(value: unknown): UserRole {
  if (value === "admin") {
    return 0;
  }
  if (value === "initiator") {
    return 2;
  }
  if (value === "director") {
    return 3;
  }
  return 1;
}

/** Application identities stay distinct from Supabase authentication UUIDs; joins use numeric application IDs. */
export class UsersRepository {
  constructor(private readonly client: SupabaseClient) { }

  /** Expose application IDs to selectors and keep auth UUIDs in the uid field for session matching. */
  async fetchUsers(): Promise<ApplicationUser[]> {
    const { data, error } = await this.client.from("app_users").select("*");
    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => this.userFromRow(row));
  }

  /** Accept all identity formats still used by authentication effects and domain forms. */
  async fetchUser(identifier: string): Promise<ApplicationUser | undefined> {
    const id = numberId(identifier);
    let query = this.client.from("app_users").select("*").limit(1);
    const column = isUuid(identifier) ? "auth_user_id" : "email";
    query = id ? query.eq("id", id) : query.eq(column, identifier);
    const { data, error } = await query.maybeSingle();

    if (error) {
      throw error;
    }

    return data ? this.userFromRow(data) : undefined;
  }

  private userFromRow(row: JsonRecord): ApplicationUser {
    const id = idText(row["id"]);
    const authUserId = text(row["auth_user_id"]);

    return {
      id,
      uid: authUserId,
      email: text(row["email"]),
      displayName: text(row["display_name"]),
      directionId: idText(row["direction_id"]) || undefined,
      trigram: text(row["trigram"]) || undefined,
      deletedAt: text(row["deleted_at"]) || undefined,
      role: userRoleFromDb(row["role"]),
      isRh: row["is_rh"] === true,
      signatureName: text(row["signature_name"]),
      createdAt: text(row["created_at"]),
      lastLoginAt: text(row["last_login_at"]),
    };
  }

  /** Patch only supplied fields: a profile save must not replay a stale role or identity. SQL enforces who may change them. */
  async saveUser(identifier: string, data: Partial<ApplicationUser>): Promise<string> {
    const existing = await this.fetchUser(identifier);
    const payload: JsonRecord = {};
    const fields = {
      uid: "auth_user_id", email: "email", displayName: "display_name", signatureName: "signature_name",
    } as const;
    for (const field of Object.keys(fields) as Array<keyof typeof fields>) {
      if (data[field] !== undefined) {
        payload[fields[field]] = text(data[field]);
      }
    }
    if (data.isRh !== undefined) payload["is_rh"] = data.isRh;
    if (data.directionId !== undefined) payload["direction_id"] = numberId(data.directionId ?? "");
    if (data.trigram !== undefined) payload["trigram"] = nullableText(data.trigram);
    if (data.deletedAt !== undefined) payload["deleted_at"] = nullableText(data.deletedAt);
    if (data.role !== undefined) {
      payload["role"] = userRoleToDb(data.role);
    }
    if (data.lastLoginAt !== undefined) {
      payload["last_login_at"] = nullableText(data.lastLoginAt);
    }
    if (!existing) {
      payload["auth_user_id"] ??= identifier;
      // The database default is deliberately least-privileged; registration never infers admin from account order.
      payload["role"] ??= "user";
    }
    const query = existing
      ? this.client.from("app_users").update(payload).eq("id", Number(existing.id)).select("id").single()
      : this.client.from("app_users").insert(payload).select("id").single();
    const { data: savedRow, error } = await query;

    if (error) {
      throw error;
    }

    return idText(savedRow["id"]);
  }

  /** Atomic batch avoids partial saves, including when an administrator changes their own role. */
  async saveAssignments(assignments: UserAssignmentUpdate[]): Promise<void> {
    const { error } = await this.client.rpc("save_user_assignments", {
      assignments: assignments.map(user => ({
        id: numberId(user.userId), role: userRoleToDb(user.role), direction_id: numberId(user.directionId || ""), is_rh: user.isRh,
      })),
    });
    if (error) throw error;
  }

  /** Server-side creation links existing Auth identities without exposing admin credentials. */
  async createUser(user: NewApplicationUser): Promise<void> {
    const { error } = await this.client.rpc("create_application_user", {
      account_email: user.email.trim().toLowerCase(), account_name: user.displayName.trim(),
      account_trigram: user.trigram.trim().toUpperCase(), account_role: userRoleToDb(user.role),
      account_direction: numberId(user.directionId || ""), account_is_rh: user.isRh,
    });
    if (error) throw error;
  }

  /** Resolve the application identity before deletion so auth UUID callers target the same profile. */
  async deleteUser(identifier: string): Promise<void> {
    const existing = await this.fetchUser(identifier);
    if (!existing) {
      return;
    }

    await deleteById(this.client, "app_users", Number(existing.id));
  }

  /** Resolve numeric IDs, auth UUIDs or email at the persistence boundary for existing callers. */
  async resolveAppUserId(identifier: string): Promise<number | null> {
    if (!identifier) {
      return null;
    }

    const id = numberId(identifier);
    let query = this.client.from("app_users").select("id").limit(1);
    const column = isUuid(identifier) ? "auth_user_id" : "email";
    query = id ? query.eq("id", id) : query.eq(column, identifier);
    const { data, error } = await query.maybeSingle();

    if (error) {
      throw error;
    }

    return data ? Number(data["id"]) : null;
  }

  /** Reject missing users before writing a mandatory relational foreign key. */
  async requireAppUserId(identifier: string, message: string): Promise<number> {
    const userId = await this.resolveAppUserId(identifier);
    if (!userId) {
      throw new Error(message);
    }

    return userId;
  }

  /** Batch related identities to avoid one user query per period or participant. */
  async fetchAppUserMap(userIds: number[]): Promise<Map<number, JsonRecord>> {
    const ids = [...new Set(userIds.filter((userId) => Number.isInteger(userId) && userId > 0))];
    if (!ids.length) {
      return new Map();
    }

    const { data, error } = await this.client.from("app_users").select("id,email,display_name,auth_user_id").in("id", ids);
    if (error) {
      throw error;
    }

    return (data ?? []).reduce((index, user) => {
      index.set(Number(user["id"]), user);
      return index;
    }, new Map<number, JsonRecord>());
  }
}
