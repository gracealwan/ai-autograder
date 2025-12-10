"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

function LogoutButton({ afterLogout }: { afterLogout?: () => void }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const handleLogout = async () => {
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut(); // Clear client storage/session
    await fetch("/api/auth/logout", { method: "POST" });
    setLoading(false);
    afterLogout?.();
    router.refresh();
  };
  return (
    <button
      className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:bg-red-300"
      onClick={handleLogout}
      disabled={loading}
    >
      {loading ? "Logging out..." : "Logout"}
    </button>
  );
}

function SessionActions() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setLoggedIn(!!data.session && !!data.session.user);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      supabase.auth.getSession().then(({ data }) => {
        setLoggedIn(!!data.session && !!data.session.user);
      });
    });
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  if (!loggedIn) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/login"
          className="rounded border border-blue-600 px-4 py-2 text-blue-700 hover:bg-blue-50"
        >
          Login
        </Link>
        <Link
          href="/signup"
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Sign up
        </Link>
      </div>
    );
  }
  return <LogoutButton afterLogout={() => setLoggedIn(false)} />;
}

export default function Page() {
  return (
    <div className="relative p-10">
      <div className="absolute top-4 right-6">
        <SessionActions />
      </div>
      <h1 className="text-4xl font-bold text-blue-600">Hello from AI Autograder</h1>
      <p className="mt-4 text-gray-700">
        Tailwind is working. API routes are ready. Let's build.
      </p>
    </div>
  );
}