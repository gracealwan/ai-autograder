1) Create projects and link

A. Create Supabase project
After creation, go to Project Settings → API and copy:
SUPABASE_URL, SUPABASE_ANON_KEY (client) and SUPABASE_SERVICE_ROLE_KEY (server)

B. Create Vercel project
In Vercel project settings → Environment Variables add:
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY (server)
SUPABASE_ANON_KEY (if you want client usage)
OPENROUTER_API_KEY (your Openrouter key)
SUPABASE_JWT_SECRET (if needed)
```
Set the environment to both Preview and Production (for demo).

2) Scaffold the repo (local)

Create a Next.js + TypeScript app:

```
npx create-next-app@latest .
npm install @supabase/supabase-js axios uuid qrcode.react
# For UI: install Tailwind (recommended)
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p // not needed for tailwind v4
```

File structure (starter)
```
/src
  /pages
    /api
      assignments.ts     # create assignment + generate rubric
      submissions.ts     # submit + grade
      assignments/[id].ts # fetch assignment
      reports/[id].ts     # fetch report for teacher
  /components
    TeacherDashboard.tsx
    StudentAssignment.tsx
    Whiteboard.tsx
    RubricPopup.tsx
  /lib
    supabaseClient.ts
    openrouter.ts
  /styles
  /utils
README.md
```

3) Database schema (Supabase / Postgres)

Paste the SQL migration `db.sql` into Supabase SQL editor.

4) LLM prompt design & expected JSON formats
A) Rubric generation prompt (teacher creates assignment)

Goal: produce rubric_json containing per-question goals, each with id, title, description, suggested_max_points, and optional hints_for_students.

System: "You are an educational rubric generator for high-school math problems."

User prompt template (serverless will substitute actual question text / problem):
```
Generate a rubric for the following high-school math question. Output valid JSON only. 
Include:
 - "question_index": integer
 - "goals": an array of objects with fields:
    - id (string),
    - title (short),
    - description (1-2 sentences),
    - suggested_max_points (integer),
    - student_hint (1 sentence).
 - "explanation" (one paragraph plain English describing how the rubric maps to student performance).

Question:
<<QUESTION_TEXT>>

Context: high school math, aim to encourage showing work and correct method. Keep total suggested points = 10 for consistency unless the question seems more/less complex. 
Return JSON only.
```

Expected example output (rubric_json for a single question):
```
{
  "question_index": 0,
  "goals": [
    {
      "id": "g1",
      "title": "Correct Solution",
      "description": "Final answer is numerically correct and includes correct units where applicable.",
      "suggested_max_points": 5,
      "student_hint": "Check calculations and include units."
    },
    {
      "id": "g2",
      "title": "Correct Method",
      "description": "Uses a valid and complete method; intermediate steps shown and justifications provided.",
      "suggested_max_points": 3,
      "student_hint": "Show each step in solving the equation."
    },
    {
      "id": "g3",
      "title": "Clear Communication",
      "description": "Work is legible and logically organized; variables labeled and reasoning concise.",
      "suggested_max_points": 2,
      "student_hint": "Label your variables and box the final answer."
    }
  ],
  "explanation": "This rubric splits the question into correctness, method, and communication. Students should earn most points by providing the correct answer and showing the method used."
}
```
B) Auto-grading prompt (on submission)

Goal: Given rubric JSON + student's whiteboard (we’ll send an image/encoded data), return a per-goal numeric score, notes, and total.

Important: LLMs cannot grade images well without specialized vision; for demo we can:

Option A (simpler): require student whiteboard to also include a typed short explanation (but you said no text).

Option B (better demo): convert the whiteboard to an image and send to an OCR + math recognition engine or use an OCR-capable LLM (OpenAI vision models / Openrouter models that support image) — but you said OpenAI-tier models; for the demo, we’ll ask the LLM to score based on the image and a short generated transcript. Realistically, accuracy isn't perfect for demo — acceptable.

Given constraints, keep grading prompt forgiving and return numeric scores with rationale. Serverless should combine heuristics (if whiteboard missing lots of strokes assume "didn't show work") and LLM judgment.

Prompt template:
```
You are an expert high-school math grader. Grade this student's submission according to the rubric JSON provided. Return JSON only.

Inputs:
- "rubric": <<RUBRIC_JSON>>
- "student_whiteboard_summary": <<AUTO_GENERATED_SUMMARY>>  // e.g., "student drew steps: 1) wrote equation 2) isolated x 3) computed 3.5 ; image shows no units"
- "submission_metadata": {"has_many_strokes": true, "image_blur": 0.2} // small heuristics

Instructions:
- For each goal, return "points_awarded" as integer between 0 and suggested_max_points.
- Provide "notes" per goal clarifying why points were deducted (e.g., "no units", "missing step").
- Provide "total_points" and "max_points".
- If student did not show work (heuristic: has_many_strokes false), deduct 50% of method and communication points and include the message: "show your work next time!" in the overall_feedback.
Return JSON only.

Example output:
{
 "question_index": 0,
 "per_goal": [
   {"id":"g1","points_awarded":4,"max_points":5,"note":"minor arithmetic error"},
   {"id":"g2","points_awarded":2,"max_points":3,"note":"missing one intermediate step"},
   {"id":"g3","points_awarded":1,"max_points":2,"note":"handwriting a little messy"}
 ],
 "total_points":7,
 "max_points":10,
 "overall_feedback":"Good approach overall. show your work next time!"
}
```

CTA I can do: produce ready-to-paste serverless LLM prompt strings (TypeScript) with examples and wrappers for Openrouter.

5) Serverless APIs (Vercel) — skeletons

Create /src/pages/api/* endpoints. Use TypeScript and Supabase service key on the server.

A. POST /api/assignments — create assignment + generate rubric

Auth: teacher (JWT from Supabase)

Steps:

Insert assignment row.

For each question in payload, call Openrouter with rubric generation prompt.

Save rubric_json to rubrics table.

Return assignment id and rubric.

Skeleton (pseudo):
```
// pages/api/assignments.ts
import { createServerSupabase } from '../../lib/supabaseServer'
import { callOpenrouterRubric } from '../../lib/openrouter'

export default async function handler(req, res) {
  const supabase = createServerSupabase(process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { teacher_id, title, questions, class_id } = req.body

  const { data: assignment } = await supabase
    .from('assignments')
    .insert({ teacher_id, title, class_id })
    .select('*').single()

  const rubrics = []
  for (let i=0;i<questions.length;i++){
    const rubric_json = await callOpenrouterRubric(questions[i], i)
    rubrics.push(rubric_json)
  }

  await supabase.from('rubrics').insert({ assignment_id: assignment.id, rubric_json: { questions: rubrics } })
  res.json({assignment, rubrics})
}
```
B. GET /api/assignments/[id] — fetch assignment + latest rubric
C. POST /api/submissions — student autosave or submit

If autosave (every 5s), call upsert to submissions with updated_at.

If final submit: call callOpenrouterGrade for each question (or batch), store question_grades, set completed=true.

D. GET /api/reports/[assignment_id] — teacher report

Joins submissions and question_grades to return student status and per-question totals.

CTA I can do: generate fully-implemented TypeScript serverless files for each endpoint, wired to Supabase and Openrouter, ready for Cursor to run.

6) Frontend components & behavior
Key pages

/teacher/dashboard — create assignment form (enter title, paste question text areas), show QR (use qrcode.react), list students, teacher view of report (polling every 10–15s).

/assignment/[id]/join?role=student — student registration (email + name), then assignment view.

/assignment/[id]/student — whiteboard component, autosave every 5s, submit button.

/assignment/[id]/teacher — teacher report (color code buckets but show raw points); clicking a question opens popup with goal breakdown.

Whiteboard (core)

Canvas that records strokes (simple vector format; store as JSON of strokes).

Autosave: debounce save every 5s to POST /api/submissions with data JSON: {strokes: [...], current_question: n}.

On submit, capture final canvas as base64 PNG (for LLM heuristics, maybe send a small compressed image) and also send stroke metrics (stroke_count, bounding_box_coverage) to help grading heuristic.

Visuals & design

Use Tailwind to get a production-looking UI quickly (rounded cards, soft shadows, consistent spacing).

Provide an “How AI grading works” tooltip in teacher dashboard (a modal).

CTA I can do: create React components (TSX) for Whiteboard, Teacher Dashboard, Student Assignment, and Tailwind CSS styles. I can also generate example image assets or accept your design images for Cursor.

7) Testing & verification (basic)

Deploy the app to Vercel with env variables set.

Create a teacher account in Supabase (you can seed via SQL or sign-up flow).

Teacher creates an assignment with 1 question — confirm /api/assignments returns rubric JSON.

Generate/scan QR → open as student → sign up → draw → check autosave in Supabase submissions table.

Press Submit → check question_grades table populated; teacher report shows numeric points and popup details.

If any of these fail, test each layer:

Can serverless connect to Supabase? (Test by calling a simple endpoint that lists assignments.)

Are Openrouter calls working? (Test from a temporary serverless endpoint that just returns a sample response.)

CTA I can provide: a test checklist and Postman examples for each API.

8) UX details & small important behaviors (per your answers)

Students must create accounts: implement Supabase email auth; redirect to student assignment URL after sign up.

QR code: a raw URL (e.g., https://.../assignment/{id}/join) — generate via qrcode.react.

Autosave every 5s: implement debounced upload.

Students can re-open and view completed result but cannot resubmit.

If rubric edits happen while students are working: create rubric_changes entry and set triggered_regrade false initially; notify teacher in UI and give a "Regrade now" button that reprocesses all submissions for that assignment.

Cap class size at 20: enforce when adding students in /api/class/join.

Polling on teacher dashboard: set interval 10–15s.

9) Extra features (future / stretch)

Live view of student whiteboard (real-time) — add Supabase real-time or websockets.

Teacher-editable rubrics + immediate regrading.

Better OCR / handwriting recognition integration for more accurate grading (MathPix, proprietary products).

Student dashboard/history, late-submission policies, multiple attempts.

Teachers onboarded classes and having multiple classes 

Analytics across classes/district-level reports.

Google oauth and other SSO options 

10) Security & production notes

Keep SUPABASE_SERVICE_ROLE_KEY only in server env (Vercel), not client.

Rate limit Openrouter usage — batch grading or queue large classes in background.

For demo, limit class size to 20 to control cost.

For PII (student emails), follow privacy regs (demo: keep minimal and ephemeral).
