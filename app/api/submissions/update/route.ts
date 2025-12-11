import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const { submission_id, work_json, current_question, completed } = await req.json();
    if (!submission_id || typeof work_json !== "object") {
      return NextResponse.json({ ok: false, error: "submission_id and work_json required" }, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from("submissions")
      .update({
        work_json,
        current_question: typeof current_question === "number" ? current_question : undefined,
        // Only update completed when an explicit boolean is provided (e.g., on final submit)
        completed: typeof completed === "boolean" ? completed : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", submission_id);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
