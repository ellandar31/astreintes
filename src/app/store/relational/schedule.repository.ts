import { ScheduleRule, ScheduleDay } from "../../types";
import { SupabaseClient } from "@supabase/supabase-js";
import { text, idText, numberId } from "./store-utils";

function scheduleDayToDb(value: unknown): string {
  switch (text(value).toLowerCase()) {
    case "lundi":
      return "monday";
    case "mardi":
      return "tuesday";
    case "mercredi":
      return "wednesday";
    case "jeudi":
      return "thursday";
    case "vendredi":
      return "friday";
    case "samedi":
      return "saturday";
    case "dimanche":
      return "sunday";
    case "jour ferie":
    case "jour férié":
      return "public_holiday";
    default:
      return text(value);
  }
}

function scheduleDayFromDb(value: unknown): ScheduleDay {
  switch (value) {
    case "monday":
      return "Lundi";
    case "tuesday":
      return "Mardi";
    case "wednesday":
      return "Mercredi";
    case "thursday":
      return "Jeudi";
    case "friday":
      return "Vendredi";
    case "saturday":
      return "Samedi";
    case "sunday":
      return "Dimanche";
    case "public_holiday":
      return "Jour férié";
    default:
      throw new Error(`Unknown schedule day: ${text(value)}`);
  }
}

/** Translate the persisted day enum at the boundary so scheduling consumers retain their existing vocabulary. */
export class ScheduleRepository {
  constructor(private readonly client: SupabaseClient) { }

  /** Keep persisted English enums out of existing schedule selectors. */
  async fetchScheduleRules(): Promise<ScheduleRule[]> {
    const { data, error } = await this.client.from("schedule_rules").select("*");
    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => ({
      id: idText(row["id"]),
      day: scheduleDayFromDb(row["day"]),
      hoStart: text(row["hour_start"]),
      hoEnd: text(row["hour_end"]),
    }));
  }

  /** Translate the UI day label before enforcing the database day enum. */
  async saveScheduleRule(identifier: string, data: Omit<ScheduleRule, "id">): Promise<string> {
    const id = numberId(identifier);
    const payload = {
      day: scheduleDayToDb(data["day"]),
      hour_start: text(data["hoStart"]),
      hour_end: text(data["hoEnd"]),
    };
    const query = id
      ? this.client.from("schedule_rules").update(payload).eq("id", id).select("id").single()
      : this.client.from("schedule_rules").insert(payload).select("id").single();
    const { data: savedRow, error } = await query;

    if (error) {
      throw error;
    }

    return idText(savedRow["id"]);
  }
}
