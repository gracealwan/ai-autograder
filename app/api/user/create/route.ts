import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Role = "teacher" | "student";

const allowedRoles: Role[] = ["teacher", "student"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, email, role, name } = body ?? {};

    if (!id || !email || !role) {
      return NextResponse.json(
        { ok: false, error: "id, email, and role are required" },
        { status: 400 }
      );
    }

    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { ok: false, error: "role must be 'teacher' or 'student'" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .upsert(
        {
          id,
          email,
          role,
          name: name ?? null,
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, user: data });
  } catch (error: any) {
    return NextResponse.json(
        { ok: false, error: error?.message ?? "Unexpected error" },
        { status: 500 }
      );
  }
}

