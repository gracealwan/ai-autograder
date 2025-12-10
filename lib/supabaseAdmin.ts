import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env var SUPABASE_URL");
}

if (!supabaseServiceRoleKey) {
  throw new Error("Missing env var SUPABASE_SERVICE_ROLE_KEY");
}

// Server-only Supabase client using the service role key (never expose to clients)
export const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

