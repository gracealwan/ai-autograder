"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { QRCodeSVG } from "qrcode.react";
import Whiteboard from "@/components/Whiteboard";
import React from "react";

export default function AssignmentDetails() {
  const { id } = useParams();
  const [assignment, setAssignment] = useState<any | null>(null);
  const [rubrics, setRubrics] = useState<any[]>([]);
  const [selectedRubricIdx, setSelectedRubricIdx] = useState<number>(0); // index in rubrics array
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'results' | 'rubric'>('results');

  useEffect(() => {
    async function fetchAssignment() {
      if (!id) return;
      setLoading(true);
      setError(null);
      const supabase = getSupabaseBrowserClient();
      const session = (await supabase.auth.getSession()).data.session;
      const userId = session?.user?.id;
      if (!userId) {
        setError("Please log in as a teacher.");
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("assignments")
        .select("id, title, description, teacher_id")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        setError(error.message);
      } else if (data && data.teacher_id !== userId) {
        setError("You do not have permission to view this assignment.");
      } else {
        setAssignment(data);
      }
      // Fetch ALL rubric versions, newest first
      const { data: rubricRows, error: rubricError } = await supabase
        .from("rubrics")
        .select("rubric_json, version, generated_at")
        .eq("assignment_id", id)
        .order("version", { ascending: false });
      if (rubricError) {
        setRubrics([]);
        setSelectedRubricIdx(0);
      } else {
        setRubrics(rubricRows || []);
        setSelectedRubricIdx(0); // always start with latest
      }
      setLoading(false);
    }
    fetchAssignment();
  }, [id]);

  // Construct student join link
  const joinUrl = typeof window !== "undefined" && id ? `${window.location.origin}/student/assignment/${id}` : '';

  return (
    <div className="page-container">
      {loading ? (
        <div className="py-10 text-center text-secondary">Loading assignment…</div>
      ) : error ? (
        <div className="text-status-needs-help">{error}</div>
      ) : assignment ? (
        <div className="mx-auto w-full max-w-5xl card-elevated p-6 md:p-8">
          {/* Back link */}
          <button
            className="mb-4 text-sm font-medium text-secondary hover:text-primary hover:underline"
            onClick={() => router.back()}
          >
            &larr; Back to assignments
          </button>

          {/* Header: title, description, toggle buttons */}
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Assignment
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-primary md:text-3xl">
                {assignment.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-secondary">
                {assignment.description}
              </p>
            </div>
            <div className="mt-1 flex items-center gap-2 md:mt-0">
              <div className="inline-flex items-center rounded-full border border-border-subtle bg-surface-soft p-1 text-xs font-medium text-muted shadow-sm">
                <button
                  onClick={() => setActiveTab("results")}
                  className={`chip-soft ${
                    activeTab === "results"
                      ? "bg-accent text-white shadow-sm"
                      : "bg-surface-soft text-secondary hover:bg-surface"
                  }`}
                >
                  Results
                </button>
                <button
                  onClick={() => setActiveTab("rubric")}
                  className={`chip-soft ${
                    activeTab === "rubric"
                      ? "bg-accent text-white shadow-sm"
                      : "bg-surface-soft text-secondary hover:bg-surface"
                  }`}
                >
                  Rubric
                </button>
              </div>
            </div>
          </div>

          {/* Main tab content */}
          {/* Main tab content */}
          {activeTab === 'results' ? (
            <ResultsTable assignmentId={assignment.id} rubric={rubrics[selectedRubricIdx]} joinUrl={joinUrl} />
          ) : (
            <div>
              {rubrics.length === 0 ? (
                <div className="py-4 text-sm italic text-muted">No rubric found for this assignment.</div>
              ) : (
                <>
                  <div className="mb-2 flex items-center gap-4">
                    <span className="text-sm text-secondary">Rubric version:</span>
                    <select
                      value={selectedRubricIdx}
                      onChange={e => setSelectedRubricIdx(Number(e.target.value))}
                      className="rounded-full border border-border-subtle bg-surface px-3 py-1 text-sm text-secondary shadow-sm"
                    >
                      {rubrics.map((r, idx) => (
                        <option key={r.version} value={idx}>
                          v{r.version} {idx === 0 ? "(latest)" : ""}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-muted">
                      {rubrics[selectedRubricIdx]?.generated_at
                        ? `Created ${new Date(rubrics[selectedRubricIdx].generated_at).toLocaleString()}`
                        : ""}
                    </span>
                  </div>
                  <RubricViewer
                    rubric={rubrics[selectedRubricIdx]}
                    latest={selectedRubricIdx === 0}
                    assignmentId={assignment.id}
                    onRubricSaved={reFetchRubrics}
                  />
                </>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function rubricToPrettyString(rubricJson: any) {
  // Simple formatting for textarea
  if (!rubricJson || !rubricJson.questions) return '';
  return rubricJson.questions.map((q: any, i: number) => {
    const goals = (q.goals || []).map((g: any) => (
      `    - ${g.goal} (${g.maxPoints}pts):\n      • Full: ${g.fullCreditCriteria}\n      • Partial: ${g.partialCreditCriteria}\n      • None: ${g.noCreditCriteria}`
    )).join('\n');
    return `${i+1}. ${q.prompt}\n${goals}\n    (Total Points: ${q.totalPoints})\n\n`;
  }).join('\n');
}

function prettyStringToRubric(str: string, prevRubric: any): any {
  // TODO: parse back into JSON (see prompt format for full requirements)
  // For now, return previous rubric. Proper parser could be implemented for advanced use.
  return prevRubric;
}

function reFetchRubrics() {
  window.location.reload(); // reload entire rubric list; could be improved
}

function RubricViewer({ rubric, latest, assignmentId, onRubricSaved }: { rubric: any; latest: boolean; assignmentId: string; onRubricSaved: () => void }) {
  const [editValue, setEditValue] = useState(() => rubricToPrettyString(rubric.rubric_json));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If not latest, render as read-only
  if (!latest) {
    return (
      <div className="my-8">
        <h2 className="mb-2 text-sm font-semibold text-primary">
          Rubric (read-only, v{rubric.version})
        </h2>
        <pre
          className="w-full rounded-lg border border-border-subtle bg-surface-soft p-3 mb-2 font-mono text-sm text-primary overflow-x-auto"
          style={{ minHeight: "180px" }}
        >
          {rubricToPrettyString(rubric.rubric_json)}
        </pre>
      </div>
    );
  }

  // Otherwise allow editing
  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setEditValue(e.target.value);
    setDirty(e.target.value !== rubricToPrettyString(rubric.rubric_json));
  }

  async function doSave() {
    setSaving(true);
    setError(null);
    try {
      const resp = await fetch('/api/rubrics/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignmentId, rubric_pretty_string: editValue })
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || 'Save failed');
      setDirty(false);
      if (onRubricSaved) onRubricSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function handleSave() {
    setShowWarning(true);
  }
  function confirmSave() {
    setShowWarning(false);
    doSave();
  }

  return (
    <div className="my-8">
      <h2 className="mb-4 text-sm font-semibold text-primary">
        Edit rubric (v{rubric.version})
      </h2>
      <textarea
        className="w-full rounded-lg border border-border-subtle bg-surface-soft p-3 mb-2 font-mono text-sm text-primary"
        rows={18}
        value={editValue}
        onChange={handleChange}
        disabled={saving}
        spellCheck={false}
        style={{ minHeight: '260px', fontSize: '1rem' }}
      />
      <div className="flex gap-4 items-center mt-2">
        <button
          className="btn-primary px-4 py-2 disabled:opacity-50"
          onClick={handleSave}
          disabled={!dirty || saving}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {dirty && <span className="text-xs text-muted">Don't forget to save!</span>}
        {error && <div className="ml-4 text-xs text-status-needs-help">{error}</div>}
      </div>
      {showWarning && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="card-elevated max-w-sm p-6">
            <div className="mb-2 text-lg font-bold text-status-okay">
              Regrade trigger warning
            </div>
            <p className="mb-4 text-sm text-secondary">
              Saving a new version of the rubric will trigger a regrade for all submissions. Are you
              sure you want to continue?
            </p>
            <div className="flex gap-3 justify-end mt-2">
              <button
                className="btn-secondary px-4 py-1"
                onClick={() => setShowWarning(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary px-4 py-1"
                onClick={confirmSave}
              >
                Yes, save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultsTable({ assignmentId, rubric, joinUrl }: { assignmentId: string, rubric: any, joinUrl: string }) {
  const [progress, setProgress] = React.useState<any[]>([]);
  const [uiProgress, setUiProgress] = React.useState<any[]>([]); // used for display while loading new data
  const [initialLoad, setInitialLoad] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = React.useState<Date | null>(null);
  const [drawer, setDrawer] = React.useState<null | { i: number, qIdx: number, studentId?: string }>(null);
  const [wbPopup, setWbPopup] = React.useState<null | { studentName:string, qScore:any }>(null);
  const pollingRef = React.useRef<number|null>(null);
  const drawerRef = React.useRef<HTMLDivElement>(null);
  const wbPopupRef = React.useRef<HTMLDivElement>(null);

  const fetchProgress = React.useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/assignment/progress?id=${assignmentId}`);
      if (!res.ok) throw new Error("Failed loading progress");
      const data = await res.json();
      console.log(JSON.stringify(data, null, 2));
      if (!data.ok) throw new Error(data.error || "Unknown error");
      //console.log("data.progress", JSON.stringify(data.progress));
      setUiProgress(JSON.parse(JSON.stringify(data.progress ?? [])));
      setProgress(data.progress ?? []);
      setLastUpdate(new Date());
      if (initialLoad) setInitialLoad(false);
      // keep drawer open only if valid
      setDrawer(prev => {
        if (!prev) return prev;
        const nextIdx = data.progress.findIndex((row: any) => row.student_id === data.progress[prev.i]?.student_id);
        if (nextIdx === -1) return null;
        const foundQuestions = data.progress[nextIdx]?.questions ?? [];
        const match = foundQuestions.find((q: any) => q.question_index === prev.qIdx);
        if (!match) return null;
        return { i: nextIdx, qIdx: prev.qIdx, studentId: data.progress[nextIdx].student_id };
      });
      // If a whiteboard popup is open, keep it open if question still exists.
      setWbPopup(prev => {
        if (prev && data.progress) {
          const foundStudent = data.progress.find(
            (row:any)=> row.student_name === prev.studentName && row.questions.some((q:any)=>q.question_index === prev.qScore.question_index)
          );
          if (foundStudent) {
            const foundQ = foundStudent.questions.find((q:any)=>q.question_index === prev.qScore.question_index);
            return { studentName: prev.studentName, qScore: foundQ };
          }
          return null;
        }
        return prev;
      });
    } catch (e: any) {
      setError(e.message);
    }
  }, [assignmentId, initialLoad]);
  React.useEffect(() => {
    fetchProgress();
    pollingRef.current = window.setInterval(fetchProgress, 300000); // change to 5 minutes
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [fetchProgress]);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        drawer && drawerRef.current && !drawerRef.current.contains(target) && 
        (!wbPopupRef.current || !wbPopupRef.current.contains(target))
      ) {
        setDrawer(null);
      }
    }
    if (drawer) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [drawer]);

  if (initialLoad && !uiProgress.length) return <div className="py-6 text-secondary">Loading progress…</div>;
  if (error) return <div className="text-status-needs-help">Error: {error}</div>;
  if (!uiProgress.length) return <div className="py-6 text-sm italic text-muted">No students currently working on this assignment.</div>;
  const numQuestions = rubric?.rubric_json?.questions?.length ?? (uiProgress[0]?.questions?.length ?? 0);
  console.log("progress", JSON.stringify(uiProgress));

  return (
    <div>
      {/* QR code + link */}
      <div className="my-8 flex flex-col items-center">
        <h2 className="mb-2 text-sm font-semibold text-primary">Share with students</h2>
        {joinUrl && <QRCodeSVG value={joinUrl} height={150} width={150} className="mb-3" />}
        <div className="break-all text-sm text-accent underline">{joinUrl}</div>
      </div>
      <div className="mb-3 flex items-center gap-4">
        <button
          onClick={fetchProgress}
          className="btn-secondary"
        >
          Refresh now
        </button>
        <span className="text-sm text-muted">
          Last updated: {lastUpdate ? lastUpdate.toLocaleTimeString() : "never"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full rounded-xl border border-border-subtle bg-surface text-center shadow-md">
          <thead className="bg-surface-soft text-secondary">
            <tr>
              <th className="border border-border-subtle px-2 py-2 text-xs font-semibold uppercase tracking-wide">
                Student
              </th>
              {[...Array(numQuestions)].map((_, i) => (
                <th
                  key={i}
                  className="border border-border-subtle px-2 py-1 text-xs font-semibold uppercase tracking-wide"
                >
                  Q{i + 1}
                </th>
              ))}
              <th className="border border-border-subtle px-2 py-1 text-xs font-semibold uppercase tracking-wide">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {uiProgress.map((row, i) => (
              <React.Fragment key={row.student_id + i}>
                <tr className="hover:bg-surface-soft">
                  <td className="border border-border-subtle px-2 py-1 text-left text-sm font-medium text-primary">
                    {row.student_name}
                  </td>
                  {[...Array(numQuestions)].map((_, qIdx) => {
                    const qScore = row.questions?.find((q: any) => q.question_index === qIdx);
                    const expanded = drawer && drawer.i === i && drawer.qIdx === qIdx;
                    return (
                      <td
                        key={qIdx}
                        className={`border border-border-subtle px-2 py-1 text-sm cursor-pointer transition-all ${
                          !qScore
                            ? 'bg-surface-soft text-muted'
                            : qScore.bucket === 'green'
                              ? 'bg-status-excellent-soft text-status-excellent'
                              : qScore.bucket === 'yellow'
                                ? 'bg-status-okay-soft text-status-okay'
                                : 'bg-status-needs-help-soft text-status-needs-help'
                        } ${expanded ? 'font-semibold' : ''}`}
                        onClick={e => {
                          e.stopPropagation();
                          setDrawer(expanded ? null : { i, qIdx });
                        }}
                      >
                        {qScore ? `${qScore.score}/${qScore.max}` : '-'}
                      </td>
                    );
                  })}
                  <td
                    className={`border border-border-subtle px-2 py-1 text-sm font-semibold ${
                      row.completed && row.total_score !== null
                        ? row.total_score / row.max_total >= 0.8
                          ? 'text-status-excellent'
                          : row.total_score / row.max_total >= 0.6
                            ? 'text-status-okay'
                            : 'text-status-needs-help'
                        : 'text-muted font-normal'
                    }`}
                  >
                    {row.completed&&row.total_score!==null? `${row.total_score}/${row.max_total}` : '-'}
                  </td>
                </tr>
                {/* Drawer row below student*/}
                {drawer && drawer.i === i ? (
                  <tr>
                    <td
                      colSpan={numQuestions + 2}
                      className="relative bg-surface-soft px-2 py-4 border-b border-border-subtle"
                    >
                      {(() => {
                        const perfectRow = JSON.parse(JSON.stringify(row));
                        let qScore = undefined;
                        for (const q of perfectRow.questions) {
                          const strokes = q.work?.strokes;
                          if (q.question_index === drawer.qIdx) {
                            qScore = JSON.parse(JSON.stringify(q));
                            qScore.work.strokes = strokes; // was having big problems with extracting the strokes even when deep copying 
                            break;
                          }
                        }
                        if (!qScore) return <div className="italic text-muted">No data for this question.</div>;
                        return (
                          <div ref={drawerRef} className="relative w-full max-w-4xl mx-auto">
                            {qScore.work && qScore.work.strokes && (
                              <button
                                type="button"
                                className="btn-secondary absolute right-3 top-3 !px-3 !py-1 text-xs font-semibold"
                                onClick={e => {
                                  e.stopPropagation();
                                  setWbPopup({
                                    studentName: row.student_name,
                                    qScore: {
                                      ...qScore,
                                      work: { ...qScore.work, strokes: [...(qScore.work?.strokes || [])] },
                                    },
                                  });
                                }}
                              >
                                Show Whiteboard
                              </button>
                            )}
                            <div className="card-elevated px-4 pb-4 pt-8">
                              <div className="mb-3 text-left text-sm font-semibold text-secondary">
                                Feedback &amp; points per goal
                              </div>
                              <table className="mb-2 w-full border border-border-subtle text-sm">
                                <thead>
                                  <tr className="bg-surface-soft text-xs text-secondary">
                                    <th className="border border-border-subtle px-2 py-1 text-left font-semibold">
                                      Goal
                                    </th>
                                    <th className="border border-border-subtle px-2 py-1 font-semibold">
                                      Score
                                    </th>
                                    <th className="border border-border-subtle px-2 py-1 font-semibold">
                                      Max
                                    </th>
                                    <th className="border border-border-subtle px-2 py-1 text-left font-semibold">
                                      Explanation
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {qScore.goals && qScore.goals.map((g:any, idx:number) => (
                                    <tr key={idx}>
                                      <td className="border border-border-subtle px-2 py-1 text-left text-sm text-primary">
                                        {g.goal}
                                      </td>
                                      <td className="border border-border-subtle px-2 py-1 text-sm text-secondary">
                                        {g.points}
                                      </td>
                                      <td className="border border-border-subtle px-2 py-1 text-sm text-secondary">
                                        {g.maxPoints}
                                      </td>
                                      <td className="border border-border-subtle px-2 py-1 text-left text-sm text-secondary">
                                        {g.explanation}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <div className="mt-1 text-sm font-medium text-primary">
                                Overall feedback:{" "}
                                <span className="text-secondary">{qScore.feedback || "–"}</span>
                              </div>
                              <div className="mt-2 text-sm font-semibold text-primary">
                                Total: {qScore.score} / {qScore.max}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {wbPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setWbPopup(null)}
        >
          <div
            ref={wbPopupRef}
            className="card-elevated relative flex min-h-[500px] w-full max-w-[700px] flex-col items-center justify-center p-8"
            onClick={e => e.stopPropagation()}
            style={{ minWidth: 650 }}
          >
            <button
              className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-surface-soft text-lg font-bold text-muted shadow-sm hover:bg-surface hover:text-primary"
              onClick={() => setWbPopup(null)}
              aria-label="Close whiteboard"
            >
              &times;
            </button>
            <h2 className="mb-3 text-lg font-semibold text-primary self-start">
              {wbPopup.studentName}&nbsp;– Question{" "}
              {(wbPopup.qScore?.question_index ?? 0) + 1} Whiteboard
            </h2>
            {wbPopup.qScore.work && wbPopup.qScore.work.strokes ? (
              <Whiteboard initialStrokes={wbPopup.qScore.work.strokes} width={600} height={400} readOnly />
            ) : (
              <div className="italic text-muted">No work for this question.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
