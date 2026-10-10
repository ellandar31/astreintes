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
  private readonly writes = new Map<RelationalTable, number>();

  constructor(private readonly client: SupabaseClient) { }

  /** Load once, then reload the complete aggregate when any dependent table changes. */
  watch<T>(tables: readonly RelationalTable[], load: () => Promise<T>, next: (value: T) => void, error?: (error: unknown) => void): StoreUnsubscribe {
    let active = true;
    let revision = 0;
    const refresh = async () => {
      if (!active) return;
      const requestRevision = ++revision;
      // Aggregate saves span several SQL requests; do not publish a partial join.
      if (tables.some(table => this.writes.has(table))) return;
      try {
        const value = await load();
        if (active && revision === requestRevision && !tables.some(table => this.writes.has(table))) next(value);
      } catch (error_) {
        if (active && revision === requestRevision && !tables.some(table => this.writes.has(table))) error?.(error_);
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
    const dependencies = [...new Set(tables)];
    dependencies.forEach(table => this.writes.set(table, (this.writes.get(table) || 0) + 1));
    let result: T;
    try {
      result = await task();
    } finally {
      // Counts also cover parallel signatures on interventions of the same period.
      dependencies.forEach(table => {
        const remaining = (this.writes.get(table) || 1) - 1;
        if (remaining) this.writes.set(table, remaining);
        else this.writes.delete(table);
      });
    }
    await Promise.all([...this.listeners].filter(([, dependencies]) => dependencies.some(table => tables.includes(table))).map(([refresh]) => refresh()));
    return result;
  }
}
