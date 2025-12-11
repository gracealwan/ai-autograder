"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const TEMPLATE_QUESTIONS = [
  "What is 2 + 3?",
  "Solve for x: 2x = 8",
  "What is the square root of 16?",
  "If y = 3x and x = 4, what is y?",
  "What is 5 squared?",
];

export default function NewAssignment() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rubricLoading, setRubricLoading] = useState(false);
  const router = useRouter();

  const handleQuestionChange = (i: number, value: string) => {
    setQuestions(qs => qs.map((q, idx) => (idx === i ? value : q)));
  };
  const handleAddQuestion = () => setQuestions(qs => [...qs, ""]);
  const handleRemoveQuestion = (i: number) => {
    setQuestions(qs => qs.length === 1 ? qs : qs.filter((_, idx) => idx !== i));
  };
  const handleUseTemplate = () => setQuestions([...TEMPLATE_QUESTIONS]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!questions.length || questions.some(q => !q.trim())) {
      setError("Please enter at least one question (no blanks)");
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;
      if (!token) {
        setError("Please log in");
        setLoading(false);
        return;
      }
      // Create assignment with questions
      const res = await fetch("/api/assignment/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: name, description, questions }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Could not create assignment");
        setLoading(false);
        return;
      }

      // Call rubrics/generate with assignment_id + questions
      setRubricLoading(true);
      const resRubric = await fetch("/api/rubrics/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ assignment_id: data.assignment_id, questions }),
      });
      const rubricResp = await resRubric.json();
      if (!resRubric.ok || !rubricResp.ok) {
        setError("Assignment created, but failed to generate rubric: " + (rubricResp.error || "Unknown error"));
        setLoading(false);
        setRubricLoading(false);
        return;
      }
      // Success, redirect to assignment details
      router.push(`/teacher/assignment/${data.assignment_id}`);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
      setRubricLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="mx-auto flex max-w-2xl flex-col">
        <h1 className="mb-3 text-2xl font-semibold text-primary">
          Create new assignment
        </h1>
        <p className="mb-6 text-sm text-secondary">
          Describe the task and add your questions.
        </p>
        <div className="mb-6 flex items-center gap-2 text-xs text-muted">
          <span>
            We&apos;ll automatically generate a detailed rubric from your questions after you create the assignment.
          </span>
          <div className="relative inline-flex items-center group">
            <button
              type="button"
              className="flex h-4 w-4 items-center justify-center rounded-full bg-surface-soft text-[10px] font-semibold text-secondary"
              aria-label="How rubrics are generated"
            >
              ?
            </button>
            <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-[11px] text-secondary opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
              We send your questions to the AI rubric generator, which creates goals, point values, and feedback
              criteria for each problem. You can review and edit the rubric on the next screen before using it.
            </div>
          </div>
        </div>
        <form className="card-elevated w-full p-6 md:p-8" onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="mb-1 block text-sm font-semibold text-secondary">
            Assignment name
          </label>
          <input
            className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-secondary"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={loading || rubricLoading}
          />
        </div>
        <div className="mb-6">
          <label className="mb-1 block text-sm font-semibold text-secondary">
            Description
          </label>
          <textarea
            className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-secondary"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            disabled={loading || rubricLoading}
          />
        </div>
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-semibold text-secondary">
              Add your questions
            </label>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium text-accent underline"
              onClick={handleUseTemplate}
              disabled={loading || rubricLoading}
            >
              <span>Use our template</span>
              <svg
                className="h-3 w-3"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M4 4a2 2 0 012-2h3.5a1 1 0 010 2H6v3.5a1 1 0 01-2 0V4z" />
                <path d="M16 9a1 1 0 00-1 1 4 4 0 01-4 4 1 1 0 000 2 6 6 0 006-6 1 1 0 00-1-1z" />
                <path d="M5 11a1 1 0 011-1h3a1 1 0 110 2H7v2a1 1 0 11-2 0v-3z" />
              </svg>
            </button>
          </div>
          {questions.map((q, i) => {
            const questionLabel = `Question ${i + 1}`;
            const disableRemove = questions.length === 1 || loading || rubricLoading;
            return (
              <div key={i} className="mb-3">
                <div className="mb-1 text-xs font-medium text-muted">
                  {questionLabel}
                </div>
                <div className="flex items-start gap-2">
                  <textarea
                    value={q}
                    onChange={e => handleQuestionChange(i, e.target.value)}
                    className="flex-1 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-secondary"
                    rows={2}
                    required
                    disabled={loading || rubricLoading}
                  />
                  <button
                    type="button"
                    className={`inline-flex items-center gap-1 rounded-full border border-status-needs-help/30 bg-status-needs-help-soft px-3 py-1 text-xs font-medium text-status-needs-help ${
                      disableRemove ? "opacity-40 cursor-not-allowed" : ""
                    }`}
                    onClick={() => handleRemoveQuestion(i)}
                    disabled={disableRemove}
                    title={
                      questions.length === 1
                        ? "At least one question required"
                        : "Remove question"
                    }
                  >
                    <span className="text-sm leading-none">−</span>
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent hover:bg-accent-soft/80"
            onClick={handleAddQuestion}
            disabled={loading || rubricLoading}
          >
            <span className="text-sm leading-none">＋</span>
            <span>Add question</span>
          </button>
        </div>
        {error && <div className="mb-4 text-sm text-status-needs-help">{error}</div>}
        <button
          type="submit"
          className="btn-primary mt-2 w-full justify-center text-base"
          disabled={loading || rubricLoading}
        >
          {loading || rubricLoading ? (rubricLoading ? "Generating rubric..." : "Creating...") : "Create Assignment"}
        </button>
        </form>
      </div>
    </div>
  );
}
