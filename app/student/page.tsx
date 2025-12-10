"use client";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SessionActions from "@/components/SessionActions";

export default function StudentHome() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseBrowserClient();
      const session = (await supabase.auth.getSession()).data.session;
      setLoggedIn(Boolean(session?.user));
      setLoading(false);
    })();
  }, []);

  return (
    <div className="relative p-10">
      <div className="absolute top-4 right-6">
        <SessionActions />
      </div>
      {loading ? (
        <div className="p-8 text-center">Loading...</div>
      ) : !loggedIn ? (
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <h2 className="mb-4 text-xl font-bold">Log in as a student</h2>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded font-semibold"
            onClick={() => router.push("/login?next=/student")}
          >
            Log In
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <h2 className="text-xl font-medium">Wait for an Assignment link from your teacher.</h2>
        </div>
      )}
    </div>
  );
}
