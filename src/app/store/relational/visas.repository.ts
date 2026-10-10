import { SupabaseClient } from "@supabase/supabase-js";
import { JsonRecord } from "./store-types";
import { text, nullableText, isRecord, visaKey } from "./store-utils";
import { UsersRepository } from "./users.repository";
import { SignatureVisa, VisaTargetColumn, VisaScope, VisaStorageTable } from "../../types";



/** Signature snapshots belong to their signed target and must survive later changes to the signer profile. */
export class VisasRepository {
  constructor(private readonly client: SupabaseClient, private readonly users: UsersRepository) { }

  /** Batch signatures by target while retaining the signer auth UUID used by validation. */
  async fetchVisasByTarget(targetColumn: VisaTargetColumn, targetIds: number[], table: VisaStorageTable = "visas"): Promise<Map<string, SignatureVisa>> {
    if (!targetIds.length) {
      return new Map();
    }

    const { data, error } = await this.client.from(table).select("*, signed_by_user:signed_by_user_id(auth_user_id,email,display_name)").in(targetColumn, targetIds);
    if (error) {
      throw error;
    }

    return (data ?? []).reduce((index, row) => {
      index.set(visaKey(row[targetColumn], text(row["scope"])), this.visaFromRow(row));
      return index;
    }, new Map<string, SignatureVisa>());
  }

  private visaFromRow(row: JsonRecord): SignatureVisa {
    const signer = isRecord(row["signed_by_user"]) ? row["signed_by_user"] : {};
    return {
      signed: Boolean(row["signed_at"]),
      signedAt: text(row["signed_at"]),
      signedByName: text(row["signed_by_name"]),
      signedByUid: text(signer["auth_user_id"]),
      signatureMode: row["signature_mode"] === "image" || row["signature_mode"] === "draw" || row["signature_mode"] === "name" ? row["signature_mode"] : undefined,
      signatureValue: text(row["signature_value"]) || undefined,
    };
  }

  /** Keep signature content as a snapshot; unsigned visas clear the previous signature fields. */
  async upsertVisa(targetColumn: VisaTargetColumn, targetId: number, scope: VisaScope, value: SignatureVisa | undefined, table: VisaStorageTable = "visas"): Promise<void> {
    const visa: Partial<SignatureVisa> = value ?? {};
    const signed = visa["signed"] === true;
    const payload: JsonRecord = {
      scope,
      [targetColumn]: targetId,
      signed_by_user_id: signed ? await this.users.resolveAppUserId(text(visa["signedByUid"])) : null,
      signed_by_name: signed ? text(visa["signedByName"], "Signature migree") : "",
      signed_at: signed ? nullableText(visa["signedAt"]) : null,
      signature_mode: signed ? visa["signatureMode"] ?? null : null,
      signature_value: signed ? text(visa["signatureValue"]) : "",
    };
    const { data: existing, error: fetchError } = await this.client
      .from(table)
      .select("id")
      .eq(targetColumn, targetId)
      .eq("scope", scope)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    const query = existing ? this.client.from(table).update(payload).eq("id", Number(existing["id"])) : this.client.from(table).insert(payload);
    const { error } = await query;

    if (error) {
      throw error;
    }
  }

  /** Remove child signatures before replacing their target rows. */
  async deleteVisas(targetColumn: VisaTargetColumn, targetIds: number[], table: VisaStorageTable = "visas"): Promise<void> {
    if (!targetIds.length) {
      return;
    }

    const { error } = await this.client.from(table).delete().in(targetColumn, targetIds);
    if (error) {
      throw error;
    }
  }
}
