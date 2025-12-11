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
            className={`flex-1 rounded-full border px-3 py-2 text-sm transition ${
              isActive
                ? "border-accent bg-accent-soft text-accent-strong shadow-sm"
                : "border-border-subtle bg-surface text-secondary hover:border-accent-soft hover:bg-surface-soft"
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
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const nextParam = searchParams.get("next");
  const nextPath = nextParam && nextParam !== "" ? nextParam : null;

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === "signup") {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { role, name },
            emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
          },
        });

        if (signUpError) throw signUpError;

        // Mirror into public.users table immediately
        if (signUpData?.user) {
          await fetch("/api/user/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: signUpData.user.id,
              email: signUpData.user.email,
              role,
              name,
            }),
          }).catch(() => {
            /* swallow; optional best-effort */
          });
        }

        setMessage("Check your email to confirm your account, then log in.");
        setIsSubmitting(false);
        return; // stay on signup page so they see the prompt
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      // --- ROLE-BASED REDIRECT ---
      let roleToRedirect: string | null = null;
      // 1. Try to get role from session.user.user_metadata (browser only):
      const session = (await supabase.auth.getSession()).data.session;
      roleToRedirect = session?.user?.user_metadata?.role ?? null;
      // 2. If not present, fetch role from public users table:
      if (!roleToRedirect && session?.user?.id) {
        const { data: userRow } = await supabase
          .from("users")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();
        roleToRedirect = userRow?.role ?? null;
      }
      // 3. Redirect
      if (roleToRedirect === "student" && nextPath?.startsWith("/student/assignment/")) {
        // Student came from a specific assignment link; send them back there.
        router.push(nextPath);
      } else if (roleToRedirect === "teacher") {
        router.push("/teacher/assignment");
      } else if (roleToRedirect === "student") {
        router.push("/student");
      } else {
        router.push("/");
      }
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md card-elevated p-6 md:p-8">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-primary">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="text-sm text-muted">
          {mode === "signup"
            ? "Sign up with your role to get started."
            : "Log in to continue."}
        </p>
      </div>

      {mode === "signup" && (
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-secondary">
            Are you a teacher or student?
          </p>
          <RoleToggle value={role} onChange={setRole} />
        </div>
      )}

      {mode === "signup" && (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-secondary">
            Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border-subtle px-3 py-2 text-sm text-secondary placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40 bg-surface"
            placeholder="Jane Doe"
          />
        </div>
      )}

      <form className="space-y-4" onSubmit={handleEmailAuth}>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-secondary">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border-subtle px-3 py-2 text-sm text-secondary placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40 bg-surface"
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-secondary">
            Password
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border-subtle px-3 py-2 text-sm text-secondary placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/40 bg-surface"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center rounded-full bg-accent px-3 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-accent-soft"
        >
          {isSubmitting
            ? "Working..."
            : mode === "signup"
            ? "Sign up"
            : "Log in"}
        </button>
      </form>

      {error && (
        <p className="mt-3 text-sm text-status-needs-help" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-3 text-sm text-status-excellent" role="status">
          {message}
        </p>
      )}
    </div>
  );
}

