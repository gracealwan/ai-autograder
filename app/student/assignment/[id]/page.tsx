"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

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
      const { data, error } = await supabase
        .from("assignments")
        .select("id, title, description")
        .eq("id", id)
        .maybeSingle();
      if (error) setError(error.message);
      else setAssignment(data);

      // Check if submission already exists
      const { data: sub, error: subErr } = await supabase
        .from("submissions")
        .select("id")
        .eq("assignment_id", id)
        .eq("student_id", session.user.id)
        .maybeSingle();
      if (subErr) {
        setError(subErr.message);
      } else if (sub) {
        setHasStarted(true);
        setSubmissionId(sub.id);
      }
      setLoading(false);
    })();
  }, [id, router]);

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
        ) : (
          <div className="w-full flex flex-col items-center mt-24">
            {/* Assignment "in progress" placeholder */}
            <p className="text-gray-700">[Assignment in progress area]</p>
          </div>
        )}
      </div>
    </div>
  );
}
