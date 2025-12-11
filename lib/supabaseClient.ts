import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
          // Do NOT automatically create a session from URL params.
          // This prevents the email verification redirect (e.g. to /login)
          // from treating the user as "logged in" before they explicitly sign in.
          detectSessionInUrl: false,
        },
      }
    );
  }
  return browserClient;
}

// Convenience export for components that just need a client instance.
export const supabase = getSupabaseBrowserClient();
