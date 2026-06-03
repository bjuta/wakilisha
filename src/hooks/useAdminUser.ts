import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface AdminUser {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  loading: boolean;
}

export function useAdminUser(): AdminUser {
  const [user, setUser] = useState<AdminUser>({
    id: "",
    email: null,
    name: "Admin",
    avatarUrl: null,
    loading: true,
  });

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        setUser({
          id: authUser.id,
          email: authUser.email ?? null,
          name: authUser.user_metadata?.name || authUser.email?.split("@")[0] || "Admin",
          avatarUrl: authUser.user_metadata?.avatar_url ?? null,
          loading: false,
        });
      } else {
        setUser((prev) => ({ ...prev, loading: false }));
      }
    }

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email ?? null,
          name: session.user.user_metadata?.name || session.user.email?.split("@")[0] || "Admin",
          avatarUrl: session.user.user_metadata?.avatar_url ?? null,
          loading: false,
        });
      } else {
        setUser({
          id: "",
          email: null,
          name: "Admin",
          avatarUrl: null,
          loading: false,
        });
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return user;
}