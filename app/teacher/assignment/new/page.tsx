"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function NewAssignment() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
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
      const res = await fetch("/api/assignment/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: name, description }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Could not create assignment");
        setLoading(false);
        return;
      }
      router.push("/teacher/assignment");
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl font-bold mb-6">Create New Assignment</h1>
      <form className="w-full max-w-md bg-white rounded shadow-md p-6" onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block mb-2 font-semibold text-black">Assignment Name</label>
          <input
            className="w-full border rounded px-3 py-2 bg-white text-black"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={loading}
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
            disabled={loading}
          />
        </div>
        {error && <div className="text-red-500 mb-4">{error}</div>}
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-semibold"
          disabled={loading}
        >
          {loading ? "Creating..." : "Create Assignment"}
        </button>
      </form>
    </div>
  );
}
