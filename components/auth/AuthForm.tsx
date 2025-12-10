"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type AuthMode = "login" | "signup";
type Role = "teacher" | "student";

const roleLabels: Record<Role, string> = {
  teacher: "Teacher",
  student: "Student",
};

interface AuthFormProps {
  mode: AuthMode;
}

function RoleToggle({
  value,
  onChange,
}: {
  value: Role;
  onChange: (role: Role) => void;
}) {
  return (
    <div className="flex gap-2">
      {(["student", "teacher"] as Role[]).map((role) => {
        const isActive = role === value;
        return (
          <button
            key={role}
            type="button"
            onClick={() => onChange(role)}
            className={`flex-1 rounded border px-3 py-2 text-sm transition ${
              isActive
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-gray-300 bg-white text-gray-700 hover:border-blue-300"
            }`}
          >
            {roleLabels[role]}
          </button>
        );
      })}
    </div>
  );
}

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const nextPath = searchParams.get("next") ?? "/";

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { role },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (signUpError) throw signUpError;
        setMessage(
          "Check your email to confirm your account. After confirming you will be redirected."
        );
        router.push(nextPath);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      router.push(nextPath);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (oauthError) throw oauthError;
      if (!data?.url) throw new Error("Missing OAuth redirect URL");
      window.location.href = data.url;
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err?.message ?? "Unable to start Google sign-in");
    }
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="text-sm text-gray-600">
          {mode === "signup"
            ? "Sign up with your role to get started."
            : "Log in to continue."}
        </p>
      </div>

      <div className="mb-4">
        <p className="mb-2 text-sm font-medium text-gray-700">
          Are you a teacher or student?
        </p>
        <RoleToggle value={role} onChange={setRole} />
      </div>

      <form className="space-y-4" onSubmit={handleEmailAuth}>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {isSubmitting
            ? "Working..."
            : mode === "signup"
            ? "Sign up"
            : "Log in"}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-gray-500">
        <div className="h-px flex-1 bg-gray-200" />
        <span>or</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            fill="#EA4335"
            d="M12 10.2v3.7h5.3c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4c1.8-1.7 2.8-4.1 2.8-6.9 0-.7-.1-1.3-.2-2H12z"
          />
          <path
            fill="#34A853"
            d="M6.6 14.3l-.8.6-2.4 1.8C4.9 19.9 8.2 22 12 22c2.4 0 4.5-.8 6-2.2l-3.1-2.4c-.8.5-1.8.8-2.9.8-2.2 0-4.1-1.5-4.8-3.5z"
          />
          <path
            fill="#4A90E2"
            d="M3.4 7.1C2.5 8.7 2 10.5 2 12s.5 3.3 1.4 4.9l3.8-3c-.2-.5-.3-1-.3-1.6s.1-1.1.3-1.6l-3.8-3z"
          />
          <path
            fill="#FBBC05"
            d="M12 5.5c1.3 0 2.4.4 3.3 1.3l2.5-2.5C16.5 2.5 14.4 1.6 12 1.6 8.2 1.6 4.9 3.7 3.4 7.1l3.8 3C7.9 7 9.8 5.5 12 5.5z"
          />
        </svg>
        Continue with Google
      </button>

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-3 text-sm text-green-700" role="status">
          {message}
        </p>
      )}
    </div>
  );
}

