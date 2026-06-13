import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  loading: boolean;
}

export function useAuthUser(): AuthUser & { refresh: () => void } {
  const [user, setUser] = useState<AuthUser>({
    id: "",
    email: null,
    name: null,
    avatarUrl: null,
    loading: true,
  });

  const refresh = useCallback(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const metadata = session.user.user_metadata as Record<string, unknown> | undefined;
        setUser({
          id: session.user.id,
          email: session.user.email ?? null,
          name: (metadata?.full_name as string) || (metadata?.name as string) || session.user.email?.split("@")[0] || null,
          avatarUrl: (metadata?.avatar_url as string) ?? null,
          loading: false,
        });
      } else {
        setUser({ id: "", email: null, name: null, avatarUrl: null, loading: false });
      }
    });
  }, []);

  useEffect(() => {
    refresh();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const metadata = session.user.user_metadata as Record<string, unknown> | undefined;
        setUser({
          id: session.user.id,
          email: session.user.email ?? null,
          name: (metadata?.full_name as string) || (metadata?.name as string) || session.user.email?.split("@")[0] || null,
          avatarUrl: (metadata?.avatar_url as string) ?? null,
          loading: false,
        });
      } else {
        setUser({ id: "", email: null, name: null, avatarUrl: null, loading: false });
      }
    });

    return () => { listener.subscription.unsubscribe(); };
  }, [refresh]);

  return { ...user, refresh };
}