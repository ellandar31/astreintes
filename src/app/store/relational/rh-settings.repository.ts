import { RhCompensationSettings, RhExportConfiguration, RhExportTemplateSetting } from "../../types";
import { SupabaseClient } from "@supabase/supabase-js";
import { text } from "./store-utils";

/** RH settings preserve coefficient ordering and document-template JSON without exposing database column names. */
export class RhSettingsRepository {
  constructor(private readonly client: SupabaseClient) { }

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

  /** Represent the singleton export configuration as the existing settings document. */
  async fetchRhExportSettings(): Promise<RhExportConfiguration> {
    const { data, error } = await this.client.from("rh_export_settings").select("*").eq("singleton_key", true).maybeSingle();
    if (error) {
      throw error;
    }

    return { generationApiUrl: text(data?.["generation_api_url"]) };
  }

  /** Use the singleton constraint to prevent competing export configurations. */
  async saveRhExportSettings(data: RhExportConfiguration): Promise<void> {
    const { error } = await this.client.from("rh_export_settings").upsert(
      {
        singleton_key: true,
        generation_api_url: text(data["generationApiUrl"], "http://localhost:3000/v1/documents/generate"),
      },
      { onConflict: "singleton_key" },
    );
    if (error) {
      throw error;
    }
  }

  /** Expose template codes as document IDs expected by the three export types. */
  async fetchRhExportTemplateItems(): Promise<RhExportTemplateSetting[]> {
    const { data, error } = await this.client.from("rh_export_templates").select("*");
    if (error) {
      throw error;
    }

    return (data ?? []).flatMap((row): RhExportTemplateSetting[] => {
      const id = text(row["code"]);
      if (id !== "regular" && id !== "exceptionalOnCall" && id !== "exceptionalWork") return [];
      return [{
        id,
        label: text(row["label"]),
        fileName: text(row["file_name"]),
        templateFileName: text(row["template_file_name"]),
        dataModelFileName: text(row["data_model_file_name"]),
        generationTemplate: row["generation_template"],
        dataModel: row["data_model"],
      }];
    });
  }

  /** Accept parsed JSON and legacy JSON text from the template upload workflow. */
  async saveRhExportTemplateItem(code: RhExportTemplateSetting["id"], data: RhExportTemplateSetting): Promise<string> {
    const payload = {
      code,
      label: text(data["label"], code),
      file_name: text(data["fileName"]),
      template_file_name: text(data["templateFileName"]),
      data_model_file_name: text(data["dataModelFileName"]),
      generation_template: data.generationTemplate ?? null,
      data_model: data.dataModel ?? null,
    };
    const { error } = await this.client.from("rh_export_templates").upsert(payload, { onConflict: "code" });

    if (error) {
      throw error;
    }

    return code;
  }
}
