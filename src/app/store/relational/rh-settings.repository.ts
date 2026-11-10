import { RhTreatmentOperation } from "../../types/rh-export.models";
import { parseExceptionalId } from "./exceptional-tables";
import { RhCompensationSettings } from "../../types";
import { SupabaseClient } from "@supabase/supabase-js";
import { text } from "./store-utils";

/** RH settings preserve coefficient ordering without exposing database column names. */
export class RhSettingsRepository {
  constructor(private readonly client: SupabaseClient) { }

  /** Keep namespaced UI identities distinct; the SQL command receives a family and its numeric key. */
  async updateTreatment(operations: RhTreatmentOperation[], treated: boolean): Promise<void> {
    const targets = operations.map(({ type, id }) => {
      if (type === "regular") return { type, id };
      const identity = parseExceptionalId(id);
      const expectedType = type === "exceptionalOnCall" ? "astreinte" : "travaux";
      if (identity.type !== expectedType) throw new Error("Inconsistent RH operation family");
      return { type, id: String(identity.id) };
    });
    const { error } = await this.client.rpc("set_rh_treatment", { operations: targets, treated });
    if (error) throw error;
  }

  /** Retain configured ordering because the RH tables and exports display rules in that order. */
  async fetchRhCompensation(): Promise<RhCompensationSettings> {
    const [onCall, periods] = await Promise.all([
      this.client.from("rh_on_call_compensation_rules").select("*").order("sort_order"),
      this.client.from("rh_period_compensation_rules").select("*").order("sort_order"),
    ]);

    if (onCall.error) {
      throw onCall.error;
    }
    if (periods.error) {
      throw periods.error;
    }

    return {
      onCall: (onCall.data ?? []).map((row) => ({
        id: text(row["code"]),
        label: text(row["label"]),
        coefficient: Number(row["coefficient"] ?? 0),
      })),
      periods: (periods.data ?? []).map((row) => ({
        id: text(row["code"]),
        label: text(row["label"]),
        interventionCoefficient: Number(row["intervention_coefficient"] ?? 0),
        workCoefficient: Number(row["work_coefficient"] ?? 0),
        restCoefficient: Number(row["rest_coefficient"] ?? 0),
      })),
    };
  }

  /** Upsert stable rule codes so coefficient edits retain their database identity. */
  async saveRhCompensation(data: RhCompensationSettings): Promise<void> {
    const onCallRows = data.onCall.map((row, index) => ({
      code: text(row["id"]),
      label: text(row["label"]),
      coefficient: Number(row["coefficient"] ?? 0),
      sort_order: index,
    }));
    const periodRows = data.periods.map((row, index) => ({
      code: text(row["id"]),
      label: text(row["label"]),
      intervention_coefficient: Number(row["interventionCoefficient"] ?? 0),
      work_coefficient: Number(row["workCoefficient"] ?? 0),
      rest_coefficient: Number(row["restCoefficient"] ?? 0),
      sort_order: index,
    }));

    if (onCallRows.length) {
      const { error } = await this.client.from("rh_on_call_compensation_rules").upsert(onCallRows, { onConflict: "code" });
      if (error) {
        throw error;
      }
    }
    if (periodRows.length) {
      const { error } = await this.client.from("rh_period_compensation_rules").upsert(periodRows, { onConflict: "code" });
      if (error) {
        throw error;
      }
    }
  }


}
