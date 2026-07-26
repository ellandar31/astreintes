/**
 * Supabase project configuration used by the central application store.
 *
 * Replace these two values with the Project URL and anon public key from
 * Supabase > Project settings > API. The anon key is designed for browser
 * applications; table access remains protected by Row Level Security policies.
 */
export const supabaseConfig = {
  url: "http://127.0.0.1:54321",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
} as const;
