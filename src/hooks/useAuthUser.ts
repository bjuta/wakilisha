import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  emailConfirmedAt: string | null;
  isEmailVerified: boolean;
  loading: boolean;
}

const EMPTY_USER: AuthUser = {
  id: "",
  email: null,
  name: null,
  avatarUrl: null,
  emailConfirmedAt: null,
  isEmailVerified: false,
  loading: false,
};

type SupabaseUserWithConfirmation = User & {
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
};

function mapSessionUser(session: Session | null): AuthUser {
  if (!session?.user) return EMPTY_USER;

  const user = session.user as SupabaseUserWithConfirmation;
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const emailConfirmedAt = user.email_confirmed_at ?? user.confirmed_at ?? null;

  return {
    id: user.id,
    email: user.email ?? null,
    name: (metadata?.full_name as string) || (metadata?.name as string) || user.email?.split("@")[0] || null,
    avatarUrl: (metadata?.avatar_url as string) ?? null,
    emailConfirmedAt,
    isEmailVerified: Boolean(emailConfirmedAt),
    loading: false,
  };
}

export function useAuthUser(): AuthUser & { refresh: () => void } {
  const [user, setUser] = useState<AuthUser>({ ...EMPTY_USER, loading: true });

  const refresh = useCallback(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(mapSessionUser(session));
    });
  }, []);

  useEffect(() => {
    refresh();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(mapSessionUser(session));
    });

    return () => { listener.subscription.unsubscribe(); };
  }, [refresh]);

  return { ...user, refresh };
}
