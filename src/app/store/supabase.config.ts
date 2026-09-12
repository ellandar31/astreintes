interface RuntimeAppConfig {
  supabaseAnonKey?: string;
  supabaseUrl?: string;
}

declare global {
  interface Window {
    __APP_CONFIG__?: RuntimeAppConfig;
  }
}

const runtimeConfig = typeof window === "undefined" ? undefined : window.__APP_CONFIG__;

/**
 * Supabase project configuration used by the central application store.
 *
 * Docker deployments inject these values at container startup through
 * `/app-config.js`. Keeping a local fallback preserves the developer workflow
 * with `supabase start` while allowing Portainer to point browsers to the
 * miniPC/Tailscale endpoint without rebuilding the Angular bundle.
 */
export const supabaseConfig = {
  url: runtimeConfig?.supabaseUrl || "http://127.0.0.1:54321",
  anonKey:
    runtimeConfig?.supabaseAnonKey ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
} as const;
