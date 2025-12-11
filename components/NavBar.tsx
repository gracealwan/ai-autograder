"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SessionActions from "./SessionActions";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function Navbar() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const loadRole = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        setRole(null);
        return;
      }

      let userRole: string | null =
        (user.user_metadata as any)?.role ?? null;

      if (!userRole) {
        const { data: userRow } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        userRole = (userRow as any)?.role ?? null;
      }

      setRole(userRole);
    };

    // Initial load on mount
    loadRole();

    // Keep role in sync with auth state (e.g. after login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadRole();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const isTeacher = role === "teacher";

  return (
    <header className="sticky top-0 z-40 bg-page/80 backdrop-blur">
      <div className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2 md:px-6">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white shadow-md">
            <span className="text-sm font-semibold tracking-tight">GA</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-primary">Goblins</span>
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Autograder
            </span>
          </div>
        </div>

        {/* Centered nav pills */}
        {isTeacher && (
        <nav className="hidden items-center justify-self-center gap-1 rounded-full border border-border-subtle bg-surface-soft px-1 py-[3px] text-xs font-medium text-muted shadow-sm md:flex">
          <span className="chip-soft bg-surface text-muted/70 cursor-not-allowed opacity-60">
            Live
          </span>
          <Link
            href="/teacher/assignment"
            className="chip-soft bg-accent text-white shadow-sm"
          >
            Assignments
          </Link>
          <span className="chip-soft bg-surface text-muted/70 cursor-not-allowed opacity-60">
            Classes
          </span>
          <span className="chip-soft bg-surface text-muted/70 cursor-not-allowed opacity-60">
            Students
          </span>
        </nav>
        )}

        {/* Right side actions */}
        <div className="ml-auto flex items-center gap-3">
          {isTeacher && (
          <Link
            href="/teacher/assignment/new"
            className="btn-primary hidden sm:inline-flex"
          >
            <span className="mr-1 text-base leading-none">＋</span>
            New Assignment
          </Link>
          )}
          <SessionActions />
        </div>
      </div>
    </header>
  );
}
