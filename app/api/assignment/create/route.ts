import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const { title, description } = await req.json();
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ ok: false, error: "Missing authorization header." }, { status: 401 });
    }
    const accessToken = authHeader.replace("Bearer ", "");

    // Get user from accessToken
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !user) {
      return NextResponse.json({ ok: false, error: "Invalid or expired access token." }, { status: 401 });
    }
    const teacher_id = user.id;

    // Insert assignment
    const { data, error } = await supabaseAdmin
      .from("assignments")
      .insert({ title, description, teacher_id })
      .select("id")
      .single();
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, assignment_id: data.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
