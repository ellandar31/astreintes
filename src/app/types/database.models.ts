/** Untrusted relational/JSONB values are validated and converted only inside repositories. */
export type JsonRecord = Record<string, unknown>;

export type RelationalTable =
  | "app_users" | "teams" | "team_members" | "schedule_rules" | "public_holidays"
  | "rh_on_call_compensation_rules" | "rh_period_compensation_rules"
  | "rh_export_settings" | "rh_export_templates"
  | "regular_on_call_periods" | "regular_interventions"
  | "exceptional_operations" | "exceptional_operation_participants" | "exceptional_interventions"
  | "visas";
