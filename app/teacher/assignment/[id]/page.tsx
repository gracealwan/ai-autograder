"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { QRCodeSVG } from "qrcode.react";
export default function AssignmentDetails() {
  const { id } = useParams();
  const [assignment, setAssignment] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

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
        <div className="w-full max-w-xl p-6 border rounded bg-white">
          <h1 className="text-3xl font-bold mb-2">{assignment.title}</h1>
          <p className="mb-4 text-gray-700">{assignment.description}</p>

          <div className="my-8 flex flex-col items-center">
            <h2 className="font-semibold mb-2">Share with Students:</h2>
            {joinUrl && <QRCodeSVG value={joinUrl} height={150} width={150} className="mb-3" />}
            <div className="break-all text-blue-700 underline text-sm">{joinUrl}</div>
          </div>

          <button className="text-blue-600 hover:underline" onClick={() => router.back()}>
            &larr; Back to assignments
          </button>
        </div>
      ) : null}
    </div>
  );
}
