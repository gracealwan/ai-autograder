import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

function getProjectRef(url?: string | null): string | null {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    return hostname.split(".")[0] ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { ok: false, error: "Missing Supabase env vars" },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization");
  const bearerToken =
    authHeader && authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7)
      : undefined;

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: bearerToken
      ? { headers: { Authorization: `Bearer ${bearerToken}` } }
      : undefined,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    if (bearerToken) {
      await client.auth.signOut({ scope: "global" });
    }
  } catch (error) {
    console.error("Supabase signOut error", error);
  }

  const res = NextResponse.json({ ok: true });
  const projectRef = getProjectRef(supabaseUrl);
  if (projectRef) {
    const baseCookie = `sb-${projectRef}-auth-token`;
    res.cookies.delete(baseCookie);
    res.cookies.delete(`${baseCookie}.sig`);
  }
  res.cookies.delete("sb-access-token");
  res.cookies.delete("sb-refresh-token");
  return res;
}

export function GET() {
  return NextResponse.json({ ok: true, message: "Use POST to log out" });
}

