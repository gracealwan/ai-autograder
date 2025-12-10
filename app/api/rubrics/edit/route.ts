import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function prettyStringToRubric(str: string, oldRubric: any): any {
  // TODO: Implement actual parsing - placeholder for now
  return oldRubric;
}

export async function POST(req: NextRequest) {
  try {
    const { assignment_id, rubric_pretty_string } = await req.json();
    if (!assignment_id || !rubric_pretty_string) {
      return NextResponse.json({ ok: false, error: "assignment_id and rubric_pretty_string are required" }, { status: 400 });
    }
    // Fetch previous rubric
    const { data: prev, error: prevError } = await supabaseAdmin
      .from("rubrics")
      .select("id, version, rubric_json")
      .eq("assignment_id", assignment_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prevError || !prev) {
      return NextResponse.json({ ok: false, error: "No previous rubric found for this assignment." }, { status: 404 });
    }
    // Convert pretty_string -> rubric_json (for now, use previous as stub)
    const rubricJson = prettyStringToRubric(rubric_pretty_string, prev.rubric_json);
    // Insert new rubric (incremented version)
    const newVersion = prev.version + 1;
    const { error: insertError } = await supabaseAdmin
      .from("rubrics")
      .insert({ assignment_id, version: newVersion, rubric_json: rubricJson });
    if (insertError) {
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
    }
    // Log into rubric_changes
    const { error: logError } = await supabaseAdmin
      .from("rubric_changes")
      .insert({ assignment_id, old_version: prev.version, new_version: newVersion, triggered_regrade: true });
    if (logError) {
      return NextResponse.json({ ok: false, error: logError.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, version: newVersion });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
