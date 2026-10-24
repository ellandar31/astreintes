import { AuthError, createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./supabase.config";
import { createStoreAuth } from "./relational/auth";
import { SupabaseDomainStore } from "./relational/domain-store";
import { StoreError } from "../types";
import { toError } from "./relational/store-utils";

export type { StoreAuthUser, StoreUnsubscribe, StoreError } from "../types";

const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
});

/** Single persistence entry point for NgRx; domain repositories share this client. */
const persistence = new SupabaseDomainStore(supabase);

export const appStore = {
  auth: createStoreAuth(supabase),
  directions: persistence.directions,
  users: persistence.users,
  teams: persistence.teams,
  schedule: persistence.schedule,
  holidays: persistence.holidays,
  regular: persistence.regular,
  exceptional: persistence.exceptional,
  rhSettings: persistence.rhSettings,
  rhPurge: persistence.rhPurge,
  now: () => new Date().toISOString(),
  errors: {
    isError(error: unknown): error is StoreError {
      return error instanceof AuthError || error instanceof Error || Boolean((error as { message?: unknown })?.message);
    },

    toMessage(error: unknown): string {
      return toError(error).message;
    },
  },
};
