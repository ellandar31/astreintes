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
const localSupabaseUrl = "http://127.0.0.1:54321";

/**
 * Resolves the public Supabase endpoint used by the browser.
 *
 * Docker deployments can leave `SUPABASE_PUBLIC_URL` empty to force the
 * same-origin gateway. The final value is computed here instead of embedding a
 * JavaScript expression in `/app-config.js`, because Supabase validates the URL
 * synchronously when the client is created.
 */
function resolveSupabaseUrl(): string {
  const configuredUrl = runtimeConfig?.supabaseUrl?.trim();

  if (isValidHttpUrl(configuredUrl)) {
    return configuredUrl;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return new URL("/supabase", window.location.origin).toString().replace(/\/$/, "");
  }

  return localSupabaseUrl;
}

function isValidHttpUrl(value: string | undefined): value is string {
  if (!value || value === "=" || value === "-") {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Supabase project configuration used by the central application store.
 *
 * Docker deployments inject these values at container startup through
 * `/app-config.js`. Keeping a local fallback preserves the developer workflow
 * with `supabase start` while allowing Portainer to point browsers to the
 * miniPC/Tailscale endpoint without rebuilding the Angular bundle.
 */
export const supabaseConfig = {
  url: resolveSupabaseUrl(),
  anonKey:
    runtimeConfig?.supabaseAnonKey ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
} as const;
