/** Untrusted relational/JSONB values are validated and converted only inside repositories. */
export type JsonRecord = Record<string, unknown>;

export type RelationalTable =
  | "app_users" | "teams" | "team_members" | "schedule_rules" | "public_holidays"
  | "rh_on_call_compensation_rules" | "rh_period_compensation_rules"
  | "regular_on_call_periods" | "regular_interventions"
  | "exceptional_on_calls" | "exceptional_works"
  | "exceptional_on_call_participants" | "exceptional_work_participants"
  | "exceptional_on_call_interventions"
  | "exceptional_on_call_visas" | "exceptional_work_visas"
  | "visas";
