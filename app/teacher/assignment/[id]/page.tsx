"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { QRCodeSVG } from "qrcode.react";

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
            <div>
              <div className="my-8 flex flex-col items-center">
                <h2 className="font-semibold mb-2">Share with Students:</h2>
                {joinUrl && <QRCodeSVG value={joinUrl} height={150} width={150} className="mb-3" />}
                <div className="break-all text-blue-700 underline text-sm">{joinUrl}</div>
              </div>
              <div className="my-8">
                <h2 className="font-semibold mb-2">Students working on this assignment:</h2>
                <div className="italic text-gray-500">No students currently working on this assignment.</div>
              </div>
            </div>
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
