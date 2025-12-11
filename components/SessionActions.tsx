"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

function LogoutButton({
  afterLogout,
  className,
}: {
  afterLogout?: () => void;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    await fetch("/api/auth/logout", { method: "POST" });
    setLoading(false);
    afterLogout?.();
    // After logging out, send the user to the main login screen.
    router.push("/login");
  };

  return (
    <button
      className={
        className ??
        "inline-flex items-center justify-center rounded-full bg-status-needs-help px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-status-needs-help/90 disabled:bg-status-needs-help-soft"
      }
      onClick={handleLogout}
      disabled={loading}
    >
      {loading ? "Logging out..." : "Logout"}
    </button>
  );
}

export default function SessionActions() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userLabel, setUserLabel] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const syncUser = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      const isLoggedIn = !!user;
      setLoggedIn(isLoggedIn);
      if (user) {
        const metaName =
          (user.user_metadata as any)?.name ||
          (user.user_metadata as any)?.full_name ||
          null;
        setUserLabel(metaName || user.email || null);
      } else {
        setUserLabel(null);
      }
    };

    syncUser();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      syncUser();
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  if (!loggedIn) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="chip-soft bg-surface text-secondary hover:bg-surface-soft"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="chip-soft bg-accent text-white shadow-sm"
        >
          Sign up
        </Link>
      </div>
    );
  }

  const initial = (userLabel || "G").charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-strong shadow-sm hover:bg-accent-muted"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label="Account menu"
      >
        {initial}
      </button>
      {menuOpen && (
        <div className="absolute right-0 z-50 mt-2 w-40 rounded-xl border border-border-subtle bg-surface p-2 shadow-md">
          {userLabel && (
            <div className="mb-1 px-2 text-xs font-medium text-secondary truncate">
              {userLabel}
            </div>
          )}
          <LogoutButton
            afterLogout={() => {
              setLoggedIn(false);
              setMenuOpen(false);
            }}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-status-needs-help hover:bg-status-needs-help-soft"
          />
        </div>
      )}
    </div>
  );
}
