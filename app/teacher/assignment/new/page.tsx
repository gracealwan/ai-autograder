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
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Create New Assignment</h1>
      <form className="w-full max-w-md bg-white rounded shadow-md p-6" onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block mb-2 font-semibold text-black">Assignment Name</label>
          <input
            className="w-full border rounded px-3 py-2 bg-white text-black"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={loading || rubricLoading}
          />
        </div>
        <div className="mb-6">
          <label className="block mb-2 font-semibold text-black">Description</label>
          <textarea
            className="w-full border rounded px-3 py-2 bg-white text-black"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            disabled={loading || rubricLoading}
          />
        </div>
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="font-semibold text-black">Questions</label>
            <button
              type="button"
              className="text-xs underline text-blue-600"
              onClick={handleUseTemplate}
              disabled={loading || rubricLoading}
            >
              Use our template!
            </button>
          </div>
          {questions.map((q, i) => (
            <div key={i} className="flex items-start gap-2 mb-2">
              <textarea
                value={q}
                onChange={e => handleQuestionChange(i, e.target.value)}
                className="flex-1 border rounded px-3 py-2 bg-white text-black"
                rows={2}
                required
                disabled={loading || rubricLoading}
              />
              <button
                type="button"
                className="mt-1 text-red-500 text-md px-2"
                onClick={() => handleRemoveQuestion(i)}
                disabled={questions.length === 1 || loading || rubricLoading}
                title={questions.length === 1 ? 'At least one question required' : 'Remove question'}
              >
                &times;
              </button>
            </div>
          ))}
          <button
            type="button"
            className="mt-2 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
            onClick={handleAddQuestion}
            disabled={loading || rubricLoading}
          >Add Question</button>
        </div>
        {error && <div className="text-red-500 mb-4">{error}</div>}
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-semibold"
          disabled={loading || rubricLoading}
        >
          {loading || rubricLoading ? (rubricLoading ? "Generating rubric..." : "Creating...") : "Create Assignment"}
        </button>
      </form>
    </div>
  );
}
