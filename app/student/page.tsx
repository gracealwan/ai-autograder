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
    <div className="page-container">
      {loading ? (
        <div className="py-16 text-center text-secondary">Loading…</div>
      ) : !loggedIn ? (
        <div className="mx-auto flex h-[60vh] max-w-md flex-col items-center justify-center">
          <div className="card-elevated w-full p-6 text-center">
            <h2 className="mb-2 text-xl font-semibold text-primary">
              Log in as a student
            </h2>
            <p className="mb-4 text-sm text-secondary">
              Your teacher will share a link to each assignment. Log in so we can save your work.
            </p>
            <button
              className="btn-primary w-full justify-center"
              onClick={() => router.push("/login?next=/student")}
            >
              Log in
            </button>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex h-[60vh] max-w-md flex-col items-center justify-center">
          <div className="card-elevated w-full p-6 text-center">
            <h2 className="mb-2 text-xl font-semibold text-primary">
              Waiting for an assignment
            </h2>
            <p className="text-sm text-secondary">
              When your teacher starts a new diagnostic, they&apos;ll send you a link. Keep this tab
              open and you&apos;ll be ready to join.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
