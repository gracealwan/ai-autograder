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

  const whiteboardRef = useRef<any>(null);

  const currentKey = `Q${currentQuestionIdx + 1}`;
  const memoizedInitialStrokes = useRef<any[]>(workJson[currentKey]?.strokes || []);
  useEffect(() => {
    // When the user changes question, update the memoized strokes (keep last drawn until questionKey really changes)
    memoizedInitialStrokes.current = workJson[currentKey]?.strokes || [];
  }, [currentKey]);

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
    setHasStarted(true);
    setSubmissionId(data.id);
    setStarting(false);
  }

  const staticHandle = useCallback((data: any) => {
    const key = `Q${currentQuestionIdx + 1}`;
    setWorkJson((prev: any) => ({ ...prev, [key]: { strokes: data.strokes, width: data.width, height: data.height } }));
  }, []);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return <div className="text-red-500 p-8 text-center">{error}</div>;
  if (!assignment) return null;

  return (
    <div className="relative min-h-screen">
      {hasStarted && (
        <div className="absolute top-4 left-8 text-xl font-bold text-blue-800 z-20">{assignment.title}</div>
      )}
      <div className="flex flex-col items-center py-12">
        {!hasStarted ? (
          <>
            <h1 className="text-2xl font-bold mb-2">{assignment.title}</h1>
            <p className="mb-6 text-gray-700">{assignment.description}</p>
            <button
              className="bg-green-600 text-white px-6 py-2 rounded text-lg font-semibold"
              disabled={starting}
              onClick={handleStart}
            >
              {starting ? "Starting..." : "Start Assignment"}
            </button>
          </>
        ) : finalSubmitted ? (
          <div className="text-center mt-12">
            <h2 className="text-3xl font-semibold text-green-700 mb-6">Assignment Complete!</h2>
            <div className="text-xl mb-4">Your work has been submitted for grading. Placeholder score/result will go here.</div>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center mt-12">
            {!!questions.length && (
              <>
                <div className="text-lg font-medium mb-2 text-gray-800">Question {currentQuestionIdx + 1} of {questions.length}</div>
                <div className="mb-4 text-xl font-semibold">{questions[currentQuestionIdx]?.prompt}</div>
              
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
                  <div style={{position: 'absolute', right: 16, bottom: 16, pointerEvents: 'auto', zIndex: 20, minWidth: 98}}
                    className="text-sm px-2 py-1 rounded shadow bg-white/90 border flex items-center gap-1"
                    aria-live="polite">
                    {autosaveStatus === 'error' ? (
                      <span className="text-red-600">Autosave failed</span>
                    ) : (
                      <span className="text-green-600 flex items-center" title={autosaveTime ? `Last autosaved at ${autosaveTime.toLocaleTimeString()}` : ''}>
                        <svg className="inline mr-1" width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 6.293a1 1 0 010 1.414l-7.071 7.071a1 1 0 01-1.414 0l-3.536-3.535a1 1 0 011.414-1.415L9 12.586l6.293-6.293a1 1 0 011.414 0z" /></svg>
                        Autosaved
                      </span>
                    )}
                  </div>
                </div>
                {grading === 'grading' && (
                  <div className="flex flex-col items-center w-full my-8">
                    <span className="text-blue-700 flex items-center text-lg mb-2"><svg className="animate-spin mr-2" width="20" height="20" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>Grading...</span> 
                  </div>
                )}
                {grading === 'error' && (
                  <div className="text-red-600 w-full mb-4">Error: {gradeError} <button className="ml-4 underline text-blue-700" onClick={handleGradeAndShowFeedback}>Retry</button></div>
                )}
                {grading === 'success' && gradeResult && (
                  <div className="w-full my-8 text-center">
                    <div className="font-bold text-green-700 text-xl mb-4">Score: {gradeResult.totalPoints} / {gradeResult.maxPoints}</div>
                    <div className="mb-6 text-lg">{gradeResult.overallFeedback}</div>
                    {currentQuestionIdx < questions.length - 1 && (
                      <button className="px-8 py-2 text-lg bg-blue-600 text-white rounded shadow font-semibold hover:bg-blue-700 mt-4" onClick={handleAdvanceAfterFeedback}>
                        Continue to Next Question
                      </button>
                    )}
                    {currentQuestionIdx === questions.length - 1 && (
                      <button className="px-8 py-2 text-lg bg-green-600 text-white rounded shadow font-semibold hover:bg-green-700 mt-4" onClick={handleFinalSubmit}>
                        Submit Final Assignment
                      </button>
                    )}
                  </div>
                )}
                {grading === 'idle' && gradeResult == null && (
                  <div className="flex gap-5 mt-10">
                    {currentQuestionIdx < questions.length - 1 && (
                      <button
                        className="px-8 py-2 text-lg bg-blue-600 text-white rounded shadow font-semibold hover:bg-blue-700"
                        onClick={handleGradeAndShowFeedback}
                      >
                        Submit & Next Question
                      </button>
                    )}
                    {currentQuestionIdx === questions.length - 1 && (
                      <button
                        className="px-8 py-2 text-lg bg-green-600 text-white rounded shadow font-semibold hover:bg-green-700"
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
