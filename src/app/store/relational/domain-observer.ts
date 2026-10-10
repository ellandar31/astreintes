import { SupabaseClient } from "@supabase/supabase-js";
import { StoreUnsubscribe } from "../../types";
import { RelationalTable } from "./store-types";
import { generatedSubscriptionId } from "./store-utils";

type Refresh = () => Promise<void>;

/**
 * Coordinates persistence notifications only; shared application state remains in NgRx.
 * Table dependencies cover joined names and visas, including deployments without realtime.
 */
export class DomainObserverService {
  private readonly listeners = new Map<Refresh, readonly RelationalTable[]>();

  constructor(private readonly client: SupabaseClient) { }

  /** Load once, then reload the complete aggregate when any dependent table changes. */
  watch<T>(tables: readonly RelationalTable[], load: () => Promise<T>, next: (value: T) => void, error?: (error: unknown) => void): StoreUnsubscribe {
    let active = true;
    const refresh = async () => {
      try {
        const value = await load();
        if (active) next(value);
      } catch (failure) {
        if (active) error?.(failure);
      }
    };
    this.listeners.set(refresh, tables);
    void refresh();
    const channels = tables.map(table => this.client
      .channel(`domain:${table}:${generatedSubscriptionId()}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => void refresh())
      .subscribe());
    return () => {
      active = false;
      this.listeners.delete(refresh);
      channels.forEach(channel => void this.client.removeChannel(channel));
    };
  }

  /** Refresh local consumers after successful writes, even when remote realtime is unavailable. */
  async write<T>(tables: readonly RelationalTable[], task: () => Promise<T>): Promise<T> {
    const result = await task();
    await Promise.all([...this.listeners].filter(([, dependencies]) => dependencies.some(table => tables.includes(table))).map(([refresh]) => refresh()));
    return result;
  }
}
