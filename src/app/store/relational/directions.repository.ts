import { SupabaseClient } from "@supabase/supabase-js";
import { Direction } from "../../types";
import { idText, numberId } from "./store-utils";

/** Reference CRUD; PostgreSQL prevents removing a direction used by profiles or operations. */
export class DirectionsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(): Promise<Direction[]> {
    const { data, error } = await this.client.from("directions").select("id,name").order("name");
    if (error) throw error;
    return (data ?? []).map(row => ({ id: idText(row["id"]), name: String(row["name"]) }));
  }

  async save(id: string | undefined, name: string): Promise<void> {
    const payload = { name: name.trim() };
    const { error } = await (id
      ? this.client.from("directions").update(payload).eq("id", numberId(id))
      : this.client.from("directions").insert(payload));
    if (error) throw error;
  }
}
