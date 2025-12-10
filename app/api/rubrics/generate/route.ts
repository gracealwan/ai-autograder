import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { OpenRouter } from "@openrouter/sdk";

const MODEL = "anthropic/claude-sonnet-4.5";

const openRouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

function buildPrompt(questions: string[], notes: string = ""): string {
  return [
    "You are an expert math educator and assessment designer.",
    "Your task is to generate a grading rubric for a teacher-created assignment.",
    "",
    "The rubric must:",
    "- Include 2–4 learning goals per question.",
    "- Assign clear point values to each goal that add up to the total question score.",
    "- Use consistent objective language suitable for automated grading.",
    "- Anticipate cases where a student does not show their work and deduct points appropriately.",
    "- Include a short description of what “full credit”, “partial credit”, and “no credit” mean for each goal.",
    "- Produce output ONLY as the JSON schema described below.",
    "",
    "------------------------------------",
    "INPUT PROVIDED TO YOU:",
    "Below is the list of teacher-provided questions:",
    ...questions.map((q, i) => `${i + 1}. ${q}`),
    "",
    `Teacher Notes (if provided):\n${notes}`,
    "------------------------------------",
    "",
    "------------------------------------",
    "RUBRIC REQUIREMENTS:",
    "For each question, generate:",
    "",
    "1. \"prompt\": the question text  ",
    "2. \"goals\": an array of objects, each containing:",
    "    - \"goal\": the learning goal",
    "    - \"maxPoints\": integer point value",
    "    - \"fullCreditCriteria\": description",
    "    - \"partialCreditCriteria\": description",
    "    - \"noCreditCriteria\": description",
    "3. \"totalPoints\": sum of all maxPoints",
    "4. \"notesForTeacher\": optional fine-grained notes",
    "",
    "Additionally:",
    "- Include a penalty criterion for missing work/explanation if relevant.",
    "- Keep descriptions concise and unambiguous.",
    "",
    "------------------------------------",
    "OUTPUT JSON FORMAT:",
    "",
    "```json",
    "{",
    "  \"questions\": [",
    "    {",
    "      \"index\": 0,",
    "      \"prompt\": \"...\",",
    "      \"totalPoints\": 5,",
    "      \"goals\": [",
    "        {",
    "          \"goal\": \"...\",",
    "          \"maxPoints\": 2,",
    "          \"fullCreditCriteria\": \"...\",",
    "          \"partialCreditCriteria\": \"...\",",
    "          \"noCreditCriteria\": \"...\"",
    "        },",
    "        ...",
    "      ],",
    "      \"notesForTeacher\": \"...\"",
    "    },",
    "    ...",
    "  ]",
    "}",
    "```",
    "",
    "------------------------------------",
    "Return ONLY valid JSON. No commentary.",
  ].join('\n');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { assignment_id, questions, notes } = body ?? {};
    if (!assignment_id || !questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ ok: false, error: "assignment_id and questions[] required" }, { status: 400 });
    }
    const prompt = buildPrompt(questions, notes || "");

    const completion = await openRouter.chat.send({
      model: MODEL,
      messages: [
        { role: "system", content: "You are a math rubric expert. Response must be strictly valid JSON." },
        { role: "user", content: prompt }
      ],
      stream: false
    });

    // Normalize model output (string or array of parts) into a string
    let content = completion.choices?.[0]?.message?.content || "";
    let normalized = "";
    if (typeof content === "string") {
      normalized = content;
    } else if (Array.isArray(content)) {
      normalized = content
        .map(part =>
          typeof part === "string"
            ? part
            : part.type === "text"
            ? part.text
            : ""
        )
        .join("")
        .trim();
    } else {
      normalized = "";
    }
    // Remove code fence if present
    normalized = normalized.trim();
    if (normalized.startsWith("```json")) {
      normalized = normalized.replace(/^```json/, "").replace(/```$/, "").trim();
    }
    // Log for debugging
    console.log("MODEL RESPONSE RAW:", JSON.stringify(normalized, null, 2));

    let rubricJson: any;
    try {
      rubricJson = JSON.parse(normalized);
    } catch {
      return NextResponse.json({ ok: false, error: "OpenRouter did not return valid JSON", rawContent: normalized }, { status: 500 });
    }

    // Insert into rubrics table, version 1
    const { error } = await supabaseAdmin
      .from("rubrics")
      .insert({ assignment_id, version: 1, rubric_json: rubricJson });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, rubric_json: rubricJson, version: 1 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
