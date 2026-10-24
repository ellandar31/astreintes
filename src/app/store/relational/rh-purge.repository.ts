import { numberId } from "./store-utils";
import { SupabaseClient } from "@supabase/supabase-js";
import { RhPurgeOperation, RhRetentionYears } from "../../types/rh-purge.models";

/** Server clock and live permissions determine eligibility for both preview and deletion. */
export class RhPurgeRepository {
  constructor(private readonly client: SupabaseClient) {}

  async preview(retentionYears: RhRetentionYears): Promise<RhPurgeOperation[]> {
    return this.readPreview("list_rh_purge_candidates", { retention_years: retentionYears });
  }

  async previewUser(userId: string): Promise<RhPurgeOperation[]> {
    return this.readPreview("list_rh_user_purge_candidates", { target_user_id: numberId(userId) });
  }

  private async readPreview(functionName: string, parameters: Record<string, string | number | null>): Promise<RhPurgeOperation[]> {
    const operations: RhPurgeOperation[] = [];
    const pageSize = 500;
    // PostgREST caps returned rows. Read all pages before offering a purge preview.
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await this.client.rpc(functionName, parameters)
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      const rows = data ?? [];
      operations.push(...rows.map((row: { operation_id: number; operation_type: RhPurgeOperation["type"]; title: string; treated_at: string; delete_operation?: boolean }) => ({
        id: String(row.operation_id), type: row.operation_type, title: row.title, treatedAt: row.treated_at,
        ...(row.delete_operation !== undefined ? { deleteOperation: row.delete_operation } : {}),
      })));
      if (rows.length < pageSize) break;
    }
    // A concurrent archive change may shift page boundaries; never submit duplicates.
    return [...new Map(operations.map(row => [`${row.type}:${row.id}`, row])).values()];
  }

  /** Exact preview identities and treatment timestamps prevent deleting newly eligible rows. */
  async purge(retentionYears: RhRetentionYears, operations: RhPurgeOperation[]): Promise<number> {
    const { data, error } = await this.client.rpc("purge_rh_operations", {
      retention_years: retentionYears,
      operations: operations.map(row => ({ id: row.id, type: row.type, treatedAt: row.treatedAt })),
    });
    if (error) throw error;
    return Number(data);
  }
  /** Participation purge keeps other users' rows and removes an operation only when empty. */
  async purgeUser(userId: string, operations: RhPurgeOperation[]): Promise<number> {
    const { data, error } = await this.client.rpc("purge_rh_user_participations", {
      target_user_id: numberId(userId),
      operations: operations.map(row => ({ id: row.id, type: row.type, treatedAt: row.treatedAt })),
    });
    if (error) throw error;
    return Number(data);
  }

}
