import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Compute color bucket based on % score
function bucketColor(score: number, max: number) {
  if (max === 0) return "grey";
  const pct = score / max;
  if (pct >= 0.8) return "green";
  if (pct >= 0.6) return "yellow";
  return "red";
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const assignmentId = url.searchParams.get('id');
  if (!assignmentId) {
    return NextResponse.json({ ok: false, error: 'Missing assignment id' }, { status: 400 });
  }

  // Get all submissions for this assignment
  const { data: subs, error: subsError } = await supabaseAdmin
    .from("submissions")
    .select("id, student_id, completed, work_json")
    .eq("assignment_id", assignmentId);
  if (subsError) {
    return NextResponse.json({ ok: false, error: subsError.message }, { status: 500 });
  }

  // Get all users referenced
  const studentIds = subs.map((s: any) => s.student_id);
  let studentsById: Record<string, any> = {};
  if (studentIds.length) {
    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id, name")
      .in("id", studentIds);
    if (usersError) {
      return NextResponse.json({ ok: false, error: usersError.message }, { status: 500 });
    }
    studentsById = Object.fromEntries(users.map((u: any) => [u.id, u]));
  }

  // Get all question grades for these submissions
  const subIds = subs.map((s: any) => s.id);
  let gradesBySubmission: Record<string, any[]> = {};
  if (subIds.length) {
    const { data: grades, error: gradesError } = await supabaseAdmin
      .from("question_grades")
      .select("id, submission_id, question_index, total_points, max_points, per_goal, feedback")
      .in("submission_id", subIds);
    if (gradesError) {
      return NextResponse.json({ ok: false, error: gradesError.message }, { status: 500 });
    }
    for (const g of grades) {
      if (!gradesBySubmission[g.submission_id]) gradesBySubmission[g.submission_id] = [];
      gradesBySubmission[g.submission_id].push(g);
    }
  }

  // Organize progress per student
  const progress = subs.map((sub: any) => {
    const student = studentsById[sub.student_id] || { name: "Unknown" };
    const grades = (gradesBySubmission[sub.id] || []).sort((a, b) => a.question_index - b.question_index);
    let totalScore = 0, totalMax = 0;
    const questions = grades.map(qg => {
      totalScore += qg.total_points;
      totalMax += qg.max_points;
      return {
        question_index: qg.question_index,
        score: qg.total_points,
        max: qg.max_points,
        grade_id: qg.id,
        bucket: bucketColor(qg.total_points, qg.max_points),
        goals: qg.per_goal,
        feedback: qg.feedback,
        work: sub.work_json && sub.work_json[`Q${qg.question_index+1}`]
      };
    });
    return {
      student_id: sub.student_id,
      student_name: student.name,
      completed: sub.completed,
      questions,
      total_score: totalMax !== 0 ? totalScore : null,
      max_total: totalMax !== 0 ? totalMax : null
    }
  });

  return NextResponse.json({ ok: true, progress });
}
