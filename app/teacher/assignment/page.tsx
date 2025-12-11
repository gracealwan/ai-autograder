"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function TeacherAssignment() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAssignments() {
      setLoading(true);
      setError(null);
      const supabase = getSupabaseBrowserClient();
      const session = (await supabase.auth.getSession()).data.session;
      const user = session?.user;
      const userId = user?.id;
      if (!userId) {
        setError("Please log in as a teacher.");
        setLoading(false);
        return;
      }

      const metaName =
        (user.user_metadata as any)?.name ||
        (user.user_metadata as any)?.full_name ||
        null;
      if (metaName) {
        setTeacherName(metaName);
      } else {
        const { data: userRow } = await supabase
          .from("users")
          .select("name")
          .eq("id", userId)
          .maybeSingle();
        if (userRow?.name) setTeacherName(userRow.name);
      }

      const { data, error } = await supabase
        .from("assignments")
        .select("id, title, description, created_at")
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
    <div className="page-container">
      <div className="card-elevated">
        <div className="border-b border-border-subtle px-5 py-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-base font-semibold text-primary">
              Assignments
            </h1>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-secondary">
            Loading assignments…
          </div>
        ) : error ? (
          <div className="py-6 text-center text-status-needs-help">
            {error}
          </div>
        ) : assignments.length === 0 ? (
          <div className="py-10 text-center text-secondary">
            No assignments yet. Use the “New Assignment” button to create your
            first diagnostic.
          </div>
        ) : (
          <div className="space-y-1 px-4 py-3">
            {assignments.map((a) => {
              const createdAt = a.created_at
                ? new Date(a.created_at)
                : null;
              const createdLabel = createdAt
                ? createdAt.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : null;

              return (
                <Link
                  key={a.id}
                  href={`/teacher/assignment/${a.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-3 hover:bg-surface-soft"
                >
                  <div>
                    <div className="text-sm font-semibold text-primary">
                      {a.title}
                      <span className="ml-2 align-middle">
                        <span className="chip-soft bg-accent-soft px-2 py-[2px] text-[11px] font-semibold text-accent-strong">
                          Open
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {teacherName ? `By ${teacherName}` : "By you"}
                      {createdLabel ? ` on ${createdLabel}` : ""}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
