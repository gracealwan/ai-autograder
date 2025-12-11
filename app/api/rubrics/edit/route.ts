import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Parse the human‑readable rubric text from the textarea back into the
 * structured JSON format used by rubric generation.
 *
 * Expected format (produced by rubricToPrettyString on the teacher page):
 *
 * 1. Question prompt line:
 *    "1. Question text..."
 *
 * 2. For each goal (indented):
 *      - Goal text (Npts):
 *        • Full: ...
 *        • Partial: ...
 *        • None: ...
 *
 * 3. Optional total line:
 *      (Total Points: N)
 */
function prettyStringToRubric(str: string, oldRubric: any): any {
  if (!str || typeof str !== "string") return oldRubric;

  const lines = str.split("\n");

  type Goal = {
    goal: string;
    maxPoints: number;
    fullCreditCriteria: string;
    partialCreditCriteria: string;
    noCreditCriteria: string;
  };

  type Question = {
    index: number;
    prompt: string;
    totalPoints: number;
    goals: Goal[];
    notesForTeacher?: string;
  };

  const questions: Question[] = [];

  let currentQuestion: Question | null = null;
  let currentGoal: Goal | null = null;

  const questionHeaderRe = /^(\d+)\.\s*(.+)$/;
  const goalHeaderRe = /^\s*-\s+(.+?)\s*\((\d+)\s*pts?\)\s*:\s*$/i;
  const totalPointsRe = /^\s*\(Total Points:\s*([0-9]+)\s*\)\s*$/i;
  const criteriaRe = /^\s*•\s*(Full|Partial|None):\s*(.+)$/i;

  function finishGoal() {
    if (currentQuestion && currentGoal) {
      currentQuestion.goals.push(currentGoal);
    }
    currentGoal = null;
  }

  function finishQuestion() {
    if (currentQuestion) {
      finishGoal();
      // If totalPoints line missing or unparsable, derive from goals
      if (
        (!currentQuestion.totalPoints || Number.isNaN(currentQuestion.totalPoints)) &&
        currentQuestion.goals.length
      ) {
        currentQuestion.totalPoints = currentQuestion.goals.reduce(
          (sum, g) => sum + (Number.isFinite(g.maxPoints) ? g.maxPoints : 0),
          0
        );
      }
      questions.push(currentQuestion);
    }
    currentQuestion = null;
  }

  for (let raw of lines) {
    const line = raw.replace(/\r$/, "");
    const qMatch = line.match(questionHeaderRe);
    if (qMatch) {
      // New question header
      finishQuestion();
      const idx = questions.length; // 0‑based index
      const prompt = qMatch[2].trim();
      currentQuestion = {
        index: idx,
        prompt,
        totalPoints: 0,
        goals: [],
      };
      currentGoal = null;
      continue;
    }

    if (!currentQuestion) {
      // Ignore text before first question
      continue;
    }

    const totalMatch = line.match(totalPointsRe);
    if (totalMatch) {
      const total = parseInt(totalMatch[1], 10);
      if (!Number.isNaN(total)) {
        currentQuestion.totalPoints = total;
      }
      continue;
    }

    const goalMatch = line.match(goalHeaderRe);
    if (goalMatch) {
      // Starting a new goal
      finishGoal();
      const goalText = goalMatch[1].trim();
      const maxPoints = parseInt(goalMatch[2], 10);
      currentGoal = {
        goal: goalText,
        maxPoints: Number.isNaN(maxPoints) ? 0 : maxPoints,
        fullCreditCriteria: "",
        partialCreditCriteria: "",
        noCreditCriteria: "",
      };
      continue;
    }

    const critMatch = line.match(criteriaRe);
    if (critMatch && currentGoal) {
      const kind = critMatch[1].toLowerCase();
      const text = critMatch[2].trim();
      if (kind === "full") currentGoal.fullCreditCriteria = text;
      else if (kind === "partial") currentGoal.partialCreditCriteria = text;
      else if (kind === "none") currentGoal.noCreditCriteria = text;
      continue;
    }

    // Any other non‑empty lines within a question block could be treated as
    // notesForTeacher (append).
    if (line.trim()) {
      const note = line.trim();
      currentQuestion.notesForTeacher = currentQuestion.notesForTeacher
        ? `${currentQuestion.notesForTeacher}\n${note}`
        : note;
    }
  }

  // Flush last structures
  finishQuestion();

  // If parsing completely failed, keep the previous rubric to avoid data loss.
  if (!questions.length) {
    return oldRubric;
  }

  return {
    ...(oldRubric || {}),
    questions,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { assignment_id, rubric_pretty_string } = await req.json();
    if (!assignment_id || !rubric_pretty_string) {
      return NextResponse.json(
        { ok: false, error: "assignment_id and rubric_pretty_string are required" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { ok: false, error: "No previous rubric found for this assignment." },
        { status: 404 }
      );
    }

    // Convert pretty_string -> rubric_json
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
      .insert({
        assignment_id,
        old_version: prev.version,
        new_version: newVersion,
        triggered_regrade: true,
      });

    if (logError) {
      return NextResponse.json({ ok: false, error: logError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, version: newVersion });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
