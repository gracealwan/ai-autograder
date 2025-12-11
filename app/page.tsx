"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    const redirectBasedOnRole = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      const user = session?.user;

      // If somehow unauthenticated reaches here, send them to login.
      if (!user) {
        router.replace("/login");
        return;
      }

      let role: string | null =
        (user.user_metadata as any)?.role ?? null;

      // Fallback: look up role from public users table if missing in metadata.
      if (!role) {
        const { data: userRow } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        role = (userRow as any)?.role ?? null;
      }

      if (role === "teacher") {
        router.replace("/teacher/assignment");
      } else if (role === "student") {
        router.replace("/student");
      } else {
        router.replace("/login");
      }
    };

    redirectBasedOnRole();
  }, [router]);

  return (
    <div className="page-container py-16 text-center text-secondary">
      Redirecting…
    </div>
  );
}