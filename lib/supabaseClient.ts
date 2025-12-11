import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env var NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseAnonKey) {
  throw new Error("Missing env var NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

let browserClient: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client configured for browser usage.
 * Sessions persist in localStorage and auto-refresh tokens are enabled.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient(
      supabaseUrl as string,
      supabaseAnonKey as string,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }
    );
  }
  return browserClient;
}

// Convenience export for components that just need a client instance.
export const supabase = getSupabaseBrowserClient();
