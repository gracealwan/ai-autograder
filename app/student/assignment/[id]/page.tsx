"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import Whiteboard from "@/components/Whiteboard";
import { stat } from "fs";

export default function StudentAssignment() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<any | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
  // New state
  const [rubric, setRubric] = useState<any | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [workJson, setWorkJson] = useState<any>({});
  const [finalSubmitted, setFinalSubmitted] = useState(false); // new
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle'); // new
  const [autosaveTime, setAutosaveTime] = useState<Date | null>(null); // for tooltip
  const [grading, setGrading] = useState<'idle' | 'grading' | 'success' | 'error'>("idle");
  const [gradeResult, setGradeResult] = useState<any | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [showAIFeedbackNotice, setShowAIFeedbackNotice] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const supabase = getSupabaseBrowserClient();
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.user) {
        router.replace(`/login?next=/student/assignment/${id}`);
        return;
      }
      setLoggedIn(true);
      setStudentId(session.user.id);
      let studentRole = session.user.user_metadata?.role;
      if (!studentRole) {
        const { data: userRow } = await supabase
          .from("users")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();
        studentRole = userRow?.role ?? null;
      }
      if (studentRole !== "student") {
        setError("Only students may access this page.");
        setLoading(false);
        return;
      }
      // Fetch assignment details
      const { data: assignmentData, error: assignmentError } = await supabase
        .from("assignments")
        .select("id, title, description")
        .eq("id", id)
        .maybeSingle();
      if (assignmentError) setError(assignmentError.message);
      else setAssignment(assignmentData);

      // Fetch latest rubric for questions
      const { data: rubricRow, error: rubricErr } = await supabase
        .from("rubrics")
        .select("rubric_json")
        .eq("assignment_id", id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (rubricRow && rubricRow.rubric_json?.questions) {
        setRubric(rubricRow.rubric_json);
        setQuestions(rubricRow.rubric_json.questions);
      }

      // Fetch or check for submission
      const { data: sub, error: subErr } = await supabase
        .from("submissions")
        .select("id, work_json, current_question")
        .eq("assignment_id", id)
        .eq("student_id", session.user.id)
        .maybeSingle();
      if (subErr) {
        setError(subErr.message);
      } else if (sub) {
        setHasStarted(true);
        setSubmissionId(sub.id);
        setWorkJson(sub.work_json || {});
        setCurrentQuestionIdx((typeof sub.current_question === "number" && !isNaN(sub.current_question)) ? sub.current_question : 0);
      }
      setLoading(false);
    })();
  }, [id, router]);

  // AUTOSAVE effect:
  useEffect(() => {
    if (!hasStarted || !submissionId) return;
    const interval = setInterval(async () => {
      setAutosaveStatus('saving');
      try {
        const resp = await fetch("/api/submissions/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            submission_id: submissionId,
            work_json: workJson,
            current_question: currentQuestionIdx,
          }),
        });
        if (!resp.ok) throw new Error("Autosave response not ok");
        setAutosaveStatus('success');
        setAutosaveTime(new Date());
        setTimeout(() => setAutosaveStatus('idle'), 2000);
      } catch(e) {
        setAutosaveStatus('error');
        setTimeout(() => setAutosaveStatus('idle'), 2000);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [hasStarted, submissionId, workJson, currentQuestionIdx]);

  // Show a notice that AI feedback is turned off once the student is in the assignment,
  // and automatically hide it after a few seconds.
  useEffect(() => {
    if (hasStarted) {
      setShowAIFeedbackNotice(true);
      const timer = setTimeout(() => {
        setShowAIFeedbackNotice(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [hasStarted]);

  const whiteboardRef = useRef<any>(null);

  const currentKey = `Q${currentQuestionIdx + 1}`;

  const syncWhiteboardToWorkJson = useCallback(() => {
    if (!whiteboardRef.current || typeof whiteboardRef.current.getCurrentData !== 'function') return;
    if (typeof whiteboardRef.current.finishStroke === 'function') {
      whiteboardRef.current.finishStroke();
    }
    const wb = whiteboardRef.current.getCurrentData();
    setWorkJson((prev: any) => {
      const next = { ...prev, [currentKey]: { strokes: wb.strokes, width: wb.width, height: wb.height } };
      return next;
    });
    return wb;
  }, [currentKey]);

  // NEW handleGradeAndShowFeedback
  const handleGradeAndShowFeedback = useCallback(async () => {
    if (!submissionId) return;
    // Save latest whiteboard data before grading
    const wb = syncWhiteboardToWorkJson();
    const workObj = { ...workJson, [currentKey]: { strokes: wb?.strokes || [], width: wb?.width, height: wb?.height } };
    setGrading('grading');
    setGradeError(null);
    setGradeResult(null);
    try {
      await fetch("/api/submissions/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_id: submissionId,
          work_json: workObj,
          current_question: currentQuestionIdx,
        }),
      });
      const resp = await fetch("/api/grade/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_id: submissionId,
          question_index: currentQuestionIdx,
        }),
      });
      if (!resp.ok) throw new Error("Grading failed");
      const json = await resp.json();
      if (!json.ok) throw new Error(json.error || "Grading failed");
      setGradeResult(json);
      setGrading('success');
    } catch (e: any) {
      setGradeResult(null);
      setGrading('error');
      setGradeError(e.message || "Failed to grade question");
    }
  }, [submissionId, currentKey, workJson, currentQuestionIdx, syncWhiteboardToWorkJson]);

  // New handler to advance after grading is shown
  const handleAdvanceAfterFeedback = () => {
    syncWhiteboardToWorkJson();
    setGradeResult(null);
    setGrading('idle');
    setGradeError(null);
    setCurrentQuestionIdx(q => q + 1);
  }

  const handleFinalSubmit = useCallback(async () => {
    if (!submissionId) return;
    const wb = syncWhiteboardToWorkJson();
    const workObj = { ...workJson, [currentKey]: { strokes: wb?.strokes || [], width: wb?.width, height: wb?.height } };
    await fetch("/api/submissions/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submission_id: submissionId,
        work_json: workObj,
        current_question: currentQuestionIdx,
        completed: true,
      }),
    });
    setFinalSubmitted(true);
  }, [submissionId, currentKey, workJson, currentQuestionIdx, syncWhiteboardToWorkJson]);

  // Handle start assignment
  async function handleStart() {
    if (!id || !studentId) return;
    setStarting(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("submissions")
      .insert({ assignment_id: id, student_id: studentId, work_json: {} })
      .select("id")
      .single();
    if (error) {
      setError(error.message);
      setStarting(false);
      return;
    }

    // Mark as started locally
    setHasStarted(true);
    setSubmissionId(data.id);

    // After a submission exists, RLS allows the student to read the rubric.
    // Refetch the latest rubric so questions are available immediately
    // without requiring a manual page refresh.
    try {
      const { data: rubricRow, error: rubricErr } = await supabase
        .from("rubrics")
        .select("rubric_json")
        .eq("assignment_id", id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (rubricErr) {
        // Don't block the flow on rubric errors; just surface a message.
        setError(rubricErr.message);
      } else if (rubricRow && rubricRow.rubric_json?.questions) {
        setRubric(rubricRow.rubric_json);
        setQuestions(rubricRow.rubric_json.questions);
      }
    } finally {
      setStarting(false);
    }
  }

  const staticHandle = useCallback(
    (data: any) => {
      setWorkJson((prev: any) => ({
        ...prev,
        [currentKey]: {
          strokes: data.strokes,
          width: data.width,
          height: data.height,
        },
      }));
    },
    [currentKey]
  );

  if (loading) return <div className="p-8 text-center text-secondary">Loading…</div>;
  if (error) return <div className="p-8 text-center text-status-needs-help">{error}</div>;
  if (!assignment) return null;

  return (
    <div className="page-container">
      {hasStarted && showAIFeedbackNotice && (
        <div className="fixed inset-x-0 top-4 z-50 flex justify-center">
          <div className="flex max-w-md items-start gap-3 rounded-lg border border-border-subtle bg-surface px-4 py-3 text-sm shadow-lg">
            <div>
              <p className="font-medium text-primary">AI feedback is currently turned off</p>
              <p className="text-xs text-secondary">
                You won&apos;t receive instant AI-generated scores or comments on this assignment. Your teacher will review your work.
              </p>
            </div>
            <button
              type="button"
              className="ml-2 text-xs text-secondary hover:text-primary"
              onClick={() => setShowAIFeedbackNotice(false)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {hasStarted && (
        <div className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
          {assignment.title}
        </div>
      )}
      <div className="flex flex-col items-center">
        {!hasStarted ? (
          <div className="mx-auto max-w-2xl text-center">
            <div className="card-elevated p-6 md:p-8">
              <h1 className="mb-2 text-2xl font-semibold text-primary">
                {assignment.title}
              </h1>
              <p className="mb-6 text-sm text-secondary">{assignment.description}</p>
              <button
                className="btn-primary w-full justify-center text-base"
                disabled={starting}
                onClick={handleStart}
              >
                {starting ? "Starting…" : "Start assignment"}
              </button>
            </div>
          </div>
        ) : finalSubmitted ? (
          <div className="mt-12 text-center">
            <h2 className="mb-4 text-3xl font-semibold text-status-excellent">
              Assignment complete!
            </h2>
            <div className="text-lg text-secondary">
              Your work has been submitted for grading. You can close this tab.
            </div>
          </div>
        ) : (
          <div className="mt-8 flex w-full flex-col items-center">
            {!!questions.length && (
              <>
                <div className="mb-1 text-sm font-medium text-secondary">
                  Question {currentQuestionIdx + 1} of {questions.length}
                </div>
                <div className="mb-4 text-lg font-semibold text-primary text-center">
                  {questions[currentQuestionIdx]?.prompt}
                </div>
              
                <div className="relative w-fit">
                  <Whiteboard
                    ref={whiteboardRef}
                    key={currentKey}
                    width={600}
                    height={400}
                    initialStrokes={workJson[currentKey]?.strokes || []}
                    onAutosave={staticHandle}
                  />
                  {/* Autosave indicator, always show green unless error */}
                  <div
                    style={{ position: "absolute", right: 16, bottom: 16, pointerEvents: "auto", zIndex: 20, minWidth: 110 }}
                    className="flex items-center gap-1 rounded-full border border-border-subtle bg-surface/95 px-3 py-1 text-xs shadow-sm"
                    aria-live="polite">
                    {autosaveStatus === 'error' ? (
                      <span className="text-status-needs-help">Autosave failed</span>
                    ) : (
                      <span
                        className="flex items-center text-status-excellent"
                        title={autosaveTime ? `Last autosaved at ${autosaveTime.toLocaleTimeString()}` : ""}
                      >
                        <svg className="inline mr-1" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 6.293a1 1 0 010 1.414l-7.071 7.071a1 1 0 01-1.414 0l-3.536-3.535a1 1 0 011.414-1.415L9 12.586l6.293-6.293a1 1 0 011.414 0z" /></svg>
                        Autosaved
                      </span>
                    )}
                  </div>
                </div>
                {grading === 'grading' && (
                  <div className="my-8 flex w-full flex-col items-center">
                    <span className="mb-2 flex items-center text-lg text-accent">
                      <svg className="mr-2 animate-spin" width="20" height="20" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                      </svg>
                      Grading…
                    </span>
                  </div>
                )}
                {grading === 'error' && (
                  <div className="mb-4 w-full text-status-needs-help">
                    Error: {gradeError}{" "}
                    <button className="ml-4 text-accent underline" onClick={handleGradeAndShowFeedback}>
                      Retry
                    </button>
                  </div>
                )}
                {grading === 'success' && gradeResult && (
                  <div className="my-8 w-full text-center">
                    <div className="mb-4 text-xl font-bold text-status-excellent">
                      Score: {gradeResult.totalPoints} / {gradeResult.maxPoints}
                    </div>
                    <div className="mb-6 text-lg text-secondary">
                      {gradeResult.overallFeedback}
                    </div>
                    {currentQuestionIdx < questions.length - 1 && (
                      <button
                        className="btn-primary mt-4 px-8 py-2 text-lg"
                        onClick={handleAdvanceAfterFeedback}
                      >
                        Continue to Next Question
                      </button>
                    )}
                    {currentQuestionIdx === questions.length - 1 && (
                      <button
                        className="btn-primary mt-4 bg-status-excellent px-8 py-2 text-lg hover:bg-status-excellent/90"
                        onClick={handleFinalSubmit}
                      >
                        Submit Final Assignment
                      </button>
                    )}
                  </div>
                )}
                {grading === 'idle' && gradeResult == null && (
                  <div className="mt-10 flex gap-5">
                    {currentQuestionIdx < questions.length - 1 && (
                      <button
                        className="btn-primary px-8 py-2 text-lg"
                        onClick={handleGradeAndShowFeedback}
                      >
                        Submit & Next Question
                      </button>
                    )}
                    {currentQuestionIdx === questions.length - 1 && (
                      <button
                        className="btn-primary px-8 py-2 text-lg"
                        onClick={handleGradeAndShowFeedback}
                      >
                        Submit Final Assignment
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
            {!questions.length && <div>No questions found for this assignment.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
