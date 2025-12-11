"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const PUBLIC_PATHS = ["/login", "/signup"];

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      const currentPath = pathname || "/";

      // Allow public auth pages without any checks
      if (PUBLIC_PATHS.includes(currentPath)) {
        if (!isMounted) return;
        setAllowed(true);
        setChecked(true);
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;

      if (!isMounted) return;

      if (!user) {
        setAllowed(false);
        setChecked(true);
        router.replace(`/login?next=${encodeURIComponent(currentPath)}`);
        return;
      }

      setAllowed(true);
      setChecked(true);
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [pathname, router]);

  if (!checked) {
    // Avoid flashing protected content before we know auth state.
    return null;
  }

  if (!allowed) {
    // Redirect is in progress; render nothing.
    return null;
  }

  return <>{children}</>;
}


