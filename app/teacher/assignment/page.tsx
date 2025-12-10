"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import SessionActions from "@/components/SessionActions";

export default function TeacherAssignment() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAssignments() {
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
        .select("id, title, description")
        .eq("teacher_id", userId)
        .order("created_at", { ascending: false });
      if (error) {
        setError(error.message);
      } else {
        setAssignments(data ?? []);
      }
      setLoading(false);
    }
    fetchAssignments();
  }, []);

  return (
    <div className="relative p-10">
      <div className="absolute top-4 right-6">
        <SessionActions />
      </div>
      <div className="flex flex-col items-center py-8">
        <h1 className="text-3xl font-bold mb-4">Assignments</h1>
        <Link
          href="/teacher/assignment/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mb-6"
        >
          Create Assignment
        </Link>
        {loading ? (
          <div>Loading...</div>
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : assignments.length === 0 ? (
          <div>No assignments found. Create your first assignment!</div>
        ) : (
          <div className="w-full max-w-2xl space-y-4">
            {assignments.map((a) => (
              <Link
                key={a.id}
                href={`/teacher/assignment/${a.id}`}
                className="block border rounded-md p-4 bg-white hover:shadow-md transition"
              >
                <div className="font-semibold text-xl">{a.title}</div>
                <div className="text-gray-700 mt-2">{a.description}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
