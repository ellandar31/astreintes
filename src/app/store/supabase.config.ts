/**
 * Supabase project configuration used by the central application store.
 *
 * Replace these two values with the Project URL and anon public key from
 * Supabase > Project settings > API. The anon key is designed for browser
 * applications; table access remains protected by Row Level Security policies.
 */
export const supabaseConfig = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY",
} as const;
