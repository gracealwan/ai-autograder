Scaffold project & supabase client

```
Create a Next.js TypeScript project file: src/lib/supabaseClient.ts that exports a server-side supabase helper `createServerSupabase(serviceRoleKey?: string)` and a client `createClientSupabase()`. Use '@supabase/supabase-js'. Include types and example usage comments.
```

Create assignment API
```
Create a TypeScript Vercel serverless function at src/pages/api/assignments.ts that:
 - Expects JSON: { teacher_id, title, questions: [ {text: string} ], class_id?}
 - Inserts assignments in Supabase using service role key.
 - Calls a helper `callOpenrouterRubric(questionText, index)` for each question.
 - Stores the combined rubric JSON in rubrics table.
 - Returns {assignment, rubrics}.
Include error handling and example unit test notes.
```

Openrouter helper
```
Create src/lib/openrouter.ts exporting two functions:
 - callOpenrouterRubric(questionText: string, index:number): Promise<any>
 - callOpenrouterGrade(rubricJson, studentSummary, heuristics): Promise<any>

Implement with axios POST to Openrouter endpoint, using OPENROUTER_API_KEY env var. Provide typed prompt templates (as strings) and parse JSON responses safely (with fallback). Include example logs.
```

Whiteboard component
```
Create src/components/Whiteboard.tsx (React + TypeScript) with:
 - Basic canvas drawing (mouse & touch support).
 - Exposes onSave() that returns strokes JSON and a small PNG dataURL.
 - Autosave every 5s via a passed `onAutosave(data)` prop.
 - Keep code minimal but production-structured and use Tailwind classes.
```

Submissions API (autosave + submit)
```
Create src/pages/api/submissions.ts:
 - If body has `autosave:true`, upsert `submissions` with student_id, assignment_id, data.
 - If `finalSubmit:true`, capture the PNG image from body, call callOpenrouterGrade for each question, insert into question_grades, set submission completed.
Return JSON status.
```

Teacher Dashboard front-end
```
Create src/components/TeacherDashboard.tsx:
 - Fetch /api/reports/[assignment_id] every 12s.
 - Display table of students, completion status, total points.
 - Color-code totals (green/yellow/red) based on buckets (>=80 green, >=60 yellow, else red).
 - Click on a student's question score opens a modal showing per_goal breakdown.
 ```