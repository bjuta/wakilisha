import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchUserRole, type UserRole, type UserRoleRecord, type Capability, getUserCapabilities, userCan } from "@/services/userRoles";

export interface AdminUser {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  role: UserRole | null;
  roleRecord: UserRoleRecord | null;
  capabilities: Capability[];
  loading: boolean;
}

export function useAdminUser(): AdminUser & {
  can: (capability: Capability) => boolean;
} {
  const [user, setUser] = useState<AdminUser>({
    id: "",
    email: null,
    name: "Admin",
    avatarUrl: null,
    role: null,
    roleRecord: null,
    capabilities: [],
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadUser(authUserId: string, email: string | undefined, metadata: any) {
      const name = metadata?.name || email?.split("@")[0] || "Admin";
      const avatarUrl = metadata?.avatar_url ?? null;

      try {
        const roleRecord = await fetchUserRole(authUserId);
        if (!cancelled) {
          setUser({
            id: authUserId,
            email: email ?? null,
            name,
            avatarUrl,
            role: roleRecord?.role ?? null,
            roleRecord,
            capabilities: roleRecord ? getUserCapabilities(roleRecord.role) : [],
            loading: false,
          });
        }
      } catch {
        if (!cancelled) {
          setUser({
            id: authUserId,
            email: email ?? null,
            name,
            avatarUrl,
            role: null,
            roleRecord: null,
            capabilities: [],
            loading: false,
          });
        }
      }
    }

    async function init() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        await loadUser(authUser.id, authUser.email, authUser.user_metadata);
      } else if (!cancelled) {
        setUser((prev) => ({ ...prev, loading: false }));
      }
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        loadUser(session.user.id, session.user.email, session.user.user_metadata);
      } else if (!cancelled) {
        setUser({
          id: "",
          email: null,
          name: "Admin",
          avatarUrl: null,
          role: null,
          roleRecord: null,
          capabilities: [],
          loading: false,
        });
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  return {
    ...user,
    can: (capability: Capability) => (user.role ? userCan(user.role, capability) : false),
  };
}