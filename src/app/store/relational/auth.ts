import { SupabaseClient, User } from "@supabase/supabase-js";
import { StoreAuthUser, StoreUnsubscribe } from "./store-types";

function mapAuthUser(user: User | null): StoreAuthUser | null {
  if (!user) {
    return null;
  }

  const metadata = user.user_metadata ?? {};
  const displayName = metadata["display_name"] || metadata["full_name"] || metadata["name"] || null;

  return {
    displayName: typeof displayName === "string" ? displayName : null,
    email: user.email ?? null,
    uid: user.id,
  };
}

/** Authentication is independent of relational domain persistence. */
export function createStoreAuth(supabase: SupabaseClient) {
  return {
    onSessionChanged(callback: (user: StoreAuthUser | null) => void): StoreUnsubscribe {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(mapAuthUser(session?.user ?? null)));
      void supabase.auth.getSession().then(({ data: sessionData }) => callback(mapAuthUser(sessionData.session?.user ?? null)));

      return () => data.subscription.unsubscribe();
    },

    async createWithEmail(email: string, password: string): Promise<unknown> {
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        throw error;
      }

      return data;
    },

    async signInWithEmail(email: string, password: string): Promise<unknown> {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        throw error;
      }

      return data;
    },

    async signOut(): Promise<void> {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }
    },

    async updateProfile(_user: StoreAuthUser, profile: { displayName?: string }): Promise<void> {
      const { error } = await supabase.auth.updateUser({
        data: {
          display_name: profile.displayName ?? "",
        },
      });

      if (error) {
        throw error;
      }
    },
  };
}
