"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [status, setStatus] = useState("Finishing sign-in...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const nextPath = searchParams.get("next") ?? "/";
    if (!code) {
      setError("Missing OAuth code.");
      setStatus("Unable to complete sign-in");
      return;
    }

    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error: exchangeError }) => {
        if (exchangeError) {
          setError(exchangeError.message);
          setStatus("Unable to complete sign-in");
          return;
        }

        setStatus("Signed in! Redirecting...");
        router.replace(nextPath);
      })
      .catch((err: any) => {
        setError(err?.message ?? "Unexpected error");
        setStatus("Unable to complete sign-in");
      });
  }, [router, searchParams, supabase]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Signing you in</h1>
        <p className="mt-2 text-sm text-gray-700">{status}</p>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </main>
  );
}

