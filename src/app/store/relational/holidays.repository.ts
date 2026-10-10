import { PublicHoliday } from "../../types";
import { SupabaseClient } from "@supabase/supabase-js";
import { text, idText, numberId } from "./store-utils";

/** Holiday uniqueness is defined by zone and date, allowing official imports to remain idempotent. */
export class HolidaysRepository {
  constructor(private readonly client: SupabaseClient) { }

  /** Expose calendar dates without introducing a timezone conversion. */
  async fetchPublicHolidays(): Promise<PublicHoliday[]> {
    const { data, error } = await this.client.from("public_holidays").select("*");
    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => ({
      id: idText(row["id"]),
      date: text(row["holiday_date"]),
      label: text(row["label"]),
      zone: text(row["zone"]),
      source: row["source"] === "manual" ? "manual" : "api.gouv.fr",
    }));
  }

  /** Use zone/date conflict handling so repeated official imports update the same holiday. */
  async savePublicHoliday(identifier: string, data: Omit<PublicHoliday, "id">): Promise<string> {
    const id = numberId(identifier);
    const payload = {
      zone: text(data["zone"], "metropole"),
      holiday_date: text(data["date"]),
      label: text(data["label"], "Jour ferie"),
      source: text(data["source"]) === "manual" ? "manual" : "api.gouv.fr",
    };
    const query = id
      ? this.client.from("public_holidays").update(payload).eq("id", id).select("id").single()
      : this.client.from("public_holidays").upsert(payload, { onConflict: "zone,holiday_date" }).select("id").single();
    const { data: savedRow, error } = await query;

    if (error) {
      throw error;
    }

    return idText(savedRow["id"]);
  }
}
