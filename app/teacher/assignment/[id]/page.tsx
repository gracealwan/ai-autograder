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
    <div className="flex flex-col items-center py-12">
      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : assignment ? (
        <div className="w-full max-w-4xl p-4 border rounded bg-white">
          {/* Header: title, description, toggle buttons */}
          <div className="flex flex-col gap-2 mb-6">
            <h1 className="text-3xl font-bold">{assignment.title}</h1>
            <p className="text-gray-700">{assignment.description}</p>
            <div className="flex gap-4 mt-2">
              <button
                onClick={() => setActiveTab('results')}
                className={`px-4 py-1 rounded font-medium border-b-2 transition-all ${activeTab === 'results' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-blue-600'}`}
              >
                Results
              </button>
              <button
                onClick={() => setActiveTab('rubric')}
                className={`px-4 py-1 rounded font-medium border-b-2 transition-all ${activeTab === 'rubric' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-blue-600'}`}
              >
                Rubric
              </button>
            </div>
          </div>

          {/* Main tab content will be added in next steps */}
          {activeTab === 'results' ? (
            <ResultsTable assignmentId={assignment.id} rubric={rubrics[selectedRubricIdx]} joinUrl={joinUrl} />
          ) : (
            <div>
              {rubrics.length === 0 ? (
                <div className="italic text-gray-500">No rubric found for this assignment.</div>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-2">
                    <span className="text-gray-700 text-sm">Rubric version:</span>
                    <select
                      value={selectedRubricIdx}
                      onChange={e => setSelectedRubricIdx(Number(e.target.value))}
                      className="border rounded px-2 py-1 text-sm bg-white"
                    >
                      {rubrics.map((r, idx) => (
                        <option key={r.version} value={idx}>
                          v{r.version} {idx === 0 ? '(latest)' : ''}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-gray-500">{rubrics[selectedRubricIdx]?.generated_at ? `Created ${new Date(rubrics[selectedRubricIdx].generated_at).toLocaleString()}` : ''}</span>
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

          <button className="text-blue-600 hover:underline mt-10" onClick={() => router.back()}>
            &larr; Back to assignments
          </button>
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
        <h2 className="font-semibold mb-2">Rubric (read-only, v{rubric.version})</h2>
        <pre className="w-full bg-gray-100 rounded p-3 mb-2 text-black font-mono text-sm border overflow-x-auto" style={{ minHeight: '180px' }}>{rubricToPrettyString(rubric.rubric_json)}</pre>
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
      <h2 className="font-semibold mb-4">Edit Rubric (v{rubric.version})</h2>
      <textarea
        className="w-full bg-gray-100 rounded p-3 text-black font-mono mb-2 text-sm border"
        rows={18}
        value={editValue}
        onChange={handleChange}
        disabled={saving}
        spellCheck={false}
        style={{ minHeight: '260px', fontSize: '1rem' }}
      />
      <div className="flex gap-4 items-center mt-2">
        <button
          className={`bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50`}
          onClick={handleSave}
          disabled={!dirty || saving}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {dirty && <span className="text-xs text-gray-600">Don't forget to save!</span>}
        {error && <div className="text-red-500 text-xs ml-4">{error}</div>}
      </div>
      {showWarning && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg max-w-sm">
            <div className="font-bold text-lg mb-2 text-yellow-600">Regrade Trigger Warning</div>
            <p className="mb-4">Saving a new version of the rubric will trigger a regrade for all submissions. Are you sure you want to continue?</p>
            <div className="flex gap-3 justify-end mt-2">
              <button className="px-4 py-1 rounded bg-gray-200" onClick={() => setShowWarning(false)}>Cancel</button>
              <button className="px-4 py-1 rounded bg-blue-600 text-white" onClick={confirmSave}>Yes, Save</button>
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

  if (initialLoad && !uiProgress.length) return <div>Loading progress...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;
  if (!uiProgress.length) return <div className="italic text-gray-500">No students currently working on this assignment.</div>;
  const numQuestions = rubric?.rubric_json?.questions?.length ?? (uiProgress[0]?.questions?.length ?? 0);
  console.log("progress", JSON.stringify(uiProgress));

  return (
    <div>
      {/* QR code + link */}
      <div className="my-8 flex flex-col items-center">
        <h2 className="font-semibold mb-2">Share with Students:</h2>
        {joinUrl && <QRCodeSVG value={joinUrl} height={150} width={150} className="mb-3" />}
        <div className="break-all text-blue-700 underline text-sm">{joinUrl}</div>
      </div>
      <div className="flex items-center mb-3 gap-4">
        <button onClick={fetchProgress} className="px-3 py-1 rounded bg-blue-600 text-white font-medium hover:bg-blue-700">Refresh Now</button>
        <span className="text-sm text-gray-500">Last updated: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'never'}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border text-center bg-white rounded shadow">
          <thead className="bg-blue-50 font-semibold">
            <tr>
              <th className="border px-2 py-1">Student</th>
              {[...Array(numQuestions)].map((_, i) => (
                <th key={i} className="border px-2 py-1">Q{i+1}</th>
              ))}
              <th className="border px-2 py-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {uiProgress.map((row, i) => (
              <React.Fragment key={row.student_id + i}>
                <tr className="hover:bg-blue-50">
                  <td className="border px-2 py-1 font-medium text-left">{row.student_name}</td>
                  {[...Array(numQuestions)].map((_, qIdx) => {
                    const qScore = row.questions?.find((q: any) => q.question_index === qIdx);
                    const expanded = drawer && drawer.i === i && drawer.qIdx === qIdx;
                    return (
                      <td
                        key={qIdx}
                        className={`border px-2 py-1 cursor-pointer transition-all ${expanded ? 'bg-blue-200 !ring-4 !ring-blue-600 scale-105 font-bold z-10' :
                          (!qScore ? 'bg-gray-100 text-gray-400': qScore.bucket==='green'?'bg-green-100 text-green-800':qScore.bucket==='yellow'?'bg-yellow-100 text-yellow-800':'bg-red-100 text-red-800')}`}
                        onClick={e => { e.stopPropagation(); setDrawer(expanded ? null : { i, qIdx }); }}
                      >
                        {qScore ? `${qScore.score}/${qScore.max}` : '-'}
                      </td>
                    );
                  })}
                  <td className={`border px-2 py-1 font-semibold ${row.completed && row.total_score!==null?
                    (row.total_score/row.max_total>=.8?'text-green-700':row.total_score/row.max_total>=.6?'text-yellow-800':'text-red-700') : 'text-gray-400 font-normal'}`}
                  >
                    {row.completed&&row.total_score!==null? `${row.total_score}/${row.max_total}` : '-'}
                  </td>
                </tr>
                {/* Drawer row below student*/}
                {drawer && drawer.i === i ? (
                  <tr>
                    <td colSpan={numQuestions+2} className="py-4 px-2 bg-blue-50 border-b relative">
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
                        if (!qScore) return <div className="italic text-gray-500">No data for this question.</div>;
                        return (
                          <div ref={drawerRef} className="relative w-full max-w-4xl mx-auto">
                            {qScore.work && qScore.work.strokes && (
                            
                              <button
                                type="button"
                                className="absolute right-3 top-3 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded shadow text-xs font-semibold"
                                onClick={e => {
                                  e.stopPropagation();
                                  setWbPopup({ studentName: row.student_name, qScore: { ...qScore, work: { ...qScore.work, strokes: [...(qScore.work?.strokes||[])] } } });
                                }}
                              >
                                Show Whiteboard
                              </button>
                            )}
                            <div className="border rounded bg-white shadow p-3">
                              <div className="mb-2 text-sm text-gray-600 font-medium">Feedback & Points per Goal:</div>
                              <table className="w-full mb-2 border text-sm">
                                <thead>
                                  <tr className="bg-gray-50">
                                    <th className="border px-2 py-1">Goal</th>
                                    <th className="border px-2 py-1">Score</th>
                                    <th className="border px-2 py-1">Max</th>
                                    <th className="border px-2 py-1">Explanation</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {qScore.goals && qScore.goals.map((g:any, idx:number) => (
                                    <tr key={idx}>
                                      <td className="border px-2 py-1 text-left">{g.goal}</td>
                                      <td className="border px-2 py-1">{g.points}</td>
                                      <td className="border px-2 py-1">{g.maxPoints}</td>
                                      <td className="border px-2 py-1 text-left">{g.explanation}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <div className="font-medium mt-1">Overall feedback: <span className="text-gray-700">{qScore.feedback||'–'}</span></div>
                              <div className="font-semibold mt-2">Total: {qScore.score} / {qScore.max}</div>
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div ref={wbPopupRef} className="bg-white rounded shadow-lg max-w-[700px] min-h-[500px] w-full p-6 flex flex-col justify-center items-center relative" onClick={e=>e.stopPropagation()} style={{minWidth: 650}}>
            <button className="absolute top-3 right-3 text-lg font-bold" onClick={()=>setWbPopup(null)}>&times;</button>
            <h2 className="font-semibold mb-3 text-lg">{wbPopup.studentName}&nbsp;– Whiteboard</h2>
            {wbPopup.qScore.work && wbPopup.qScore.work.strokes ? (
              <Whiteboard initialStrokes={wbPopup.qScore.work.strokes} width={600} height={400} readOnly />
            ) : (
              <div className="italic text-gray-500">No work for this question.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
