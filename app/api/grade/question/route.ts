import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { callOpenRouter } from "@/lib/openrouter";
import { log } from "console";

export async function POST(req: NextRequest) {
  try {
    const { submission_id, question_index } = await req.json();
    if (typeof submission_id !== "string" || typeof question_index !== "number") {
      return NextResponse.json({ ok: false, error: "submission_id and question_index required" }, { status: 400 });
    }
    // Fetch submission
    const { data: sub, error: subError } = await supabaseAdmin
      .from("submissions")
      .select("id, assignment_id, work_json, student_id")
      .eq("id", submission_id)
      .maybeSingle();
    if (subError || !sub) {
      return NextResponse.json({ ok: false, error: "Submission not found" }, { status: 404 });
    }
    // Fetch rubric
    const { data: rubricRow, error: rubricError } = await supabaseAdmin
      .from("rubrics")
      .select("rubric_json, version")
      .eq("assignment_id", sub.assignment_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (rubricError || !rubricRow) {
      return NextResponse.json({ ok: false, error: "Rubric not found" }, { status: 404 });
    }
    const rubric = rubricRow.rubric_json;
    const rubricVersion = rubricRow.version || 1;
    const questionRubric = rubric.questions?.[question_index];
    if (!questionRubric) {
      return NextResponse.json({ ok: false, error: "Question rubric not found" }, { status: 400 });
    }
    // Fetch student answer
    const answer = sub.work_json?.[`Q${question_index + 1}`];
    if (!answer) {
      return NextResponse.json({ ok: false, error: "No student work for this question" }, { status: 400 });
    }

    // DETAILED, CONSTRAINED GRADING PROMPT
    const gradingPrompt = `
Follow the rubric EXACTLY. 
Do not invent new goals, new point values, or new criteria.
Your output must be STRICTLY in the JSON schema described at the end of this prompt.

--------------------------------------------
INPUTS YOU WILL RECEIVE:
1. The question prompt.
2. The teacher-generated rubric for this question, including:
   - learning goals
   - max point values per goal
   - full/partial/no credit criteria
3. The student's submitted work (transcribed from whiteboard strokes into text form).
--------------------------------------------

--------------------------------------------
GRADING INSTRUCTIONS:
1. Read the question text and the student work carefully.
2. For each learning goal in the rubric:
   - Evaluate the student’s work against the goal’s criteria.
   - Assign a numeric score between 0 and maxPoints.
   - Provide a short explanation (1–2 sentences) of your scoring.
3. If the student did not show work and the rubric penalizes missing work, apply the correct deduction.
4. Be consistent, objective, and follow the rubric strictly.
5. Do NOT exceed the maxPoints for any goal.
6. Sum all points into "totalPoints".
7. Compute "maxPoints" as the sum of all goals.
-------------------------------------------

QUESTION: ${questionRubric.prompt}
RUBRIC: ${JSON.stringify(questionRubric, null, 2)}
STUDENT_WORK_JSON: ${JSON.stringify(answer)}

STRICT OUTPUT SCHEMA ONLY:
{
  "goals": [
    { "goal": string, "points": number, "maxPoints": number, "explanation": string },
    ...
  ],
  "totalPoints": number,
  "maxPoints": number,
  "overallFeedback": string
}
Return only the JSON result.`;

    const modelPrompt = [
      { role: "system", content: "You are an expert grader scoring student work for the below question and rubric." },
      { role: "user", content: gradingPrompt }
    ];

    // Send to LLM grading
    let llmResultJson;
    try {
      const llmResp = await callOpenRouter(
        "anthropic/claude-sonnet-4.5",
        modelPrompt,
        false
      );
      console.log('llmResp', JSON.stringify(llmResp, null, 2));
      // Robust extraction: first try OpenAI "choices" key (Anthropic/OpenRouter style), then fallback
      let raw = '';
      if (llmResp) {
        if (Array.isArray((llmResp as any).choices)) {
          raw = (llmResp as any).choices?.[0]?.message?.content ?? '';
        }
        if (!raw && 'message' in llmResp && typeof (llmResp as any).message?.content === 'string') {
          raw = (llmResp as any).message.content;
        }
        if (!raw && 'content' in llmResp && typeof (llmResp as any).content === 'string') {
          raw = (llmResp as any).content;
        }
      }
      // Remove all leading/trailing whitespace/newlines
      raw = raw?.trim?.() || '';
      // Remove ```json, ``` and newlines before/after
      if (/^```json/i.test(raw)) raw = raw.replace(/^```json[\r\n]*/i, '');
      if (/^```/i.test(raw)) raw = raw.replace(/^```[\r\n]*/i, '');
      raw = raw.replace(/[\r\n]*```[\s\r\n]*$/i, '');
      raw = raw.trim();
      console.log('PARSE LLM RAW:', JSON.stringify(raw));
      llmResultJson = JSON.parse(raw);
    } catch (e) {
      return NextResponse.json({ ok: false, error: "LLM parse failed: " + (e as any)?.message }, { status: 500 });
    }
    console.log('llmResultJson', JSON.stringify(llmResultJson, null, 2));
    // Insert grade into question_grades
    const { error: gradeError } = await supabaseAdmin
      .from("question_grades")
      .upsert({
        submission_id,
        question_index,
        rubric_version: rubricVersion,
        per_goal: llmResultJson.goals,
        total_points: llmResultJson.totalPoints,
        max_points: llmResultJson.maxPoints,
        feedback: llmResultJson.overallFeedback,
        graded_at: new Date().toISOString(),
      }, { onConflict: "submission_id,question_index" });
    if (gradeError) {
      return NextResponse.json({ ok: false, error: gradeError.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, ...llmResultJson });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
