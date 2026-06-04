import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { fetchUserRole, type UserRole, type UserRoleRecord, type Capability, getUserCapabilities, userCan } from "@/services/userRoles";

interface UserRoleState {
  role: UserRole | null;
  roleRecord: UserRoleRecord | null;
  capabilities: Capability[];
  loading: boolean;
  error: string | null;
}

export function useUserRole(): UserRoleState & {
  can: (capability: Capability) => boolean;
  refresh: () => Promise<void>;
} {
  const [state, setState] = useState<UserRoleState>({
    role: null,
    roleRecord: null,
    capabilities: [],
    loading: true,
    error: null,
  });

  const loadRole = useCallback(async (userId: string) => {
    try {
      const record = await fetchUserRole(userId);
      if (record) {
        setState({
          role: record.role,
          roleRecord: record,
          capabilities: getUserCapabilities(record.role),
          loading: false,
          error: null,
        });
      } else {
        setState({
          role: null,
          roleRecord: null,
          capabilities: [],
          loading: false,
          error: null,
        });
      }
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message ?? "Failed to load role",
      }));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && !cancelled) {
        await loadRole(user.id);
      } else if (!cancelled) {
        setState((prev) => ({ ...prev, loading: false }));
      }
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user && !cancelled) {
        loadRole(session.user.id);
      } else if (!cancelled) {
        setState({
          role: null,
          roleRecord: null,
          capabilities: [],
          loading: false,
          error: null,
        });
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [loadRole]);

  const refresh = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setState((prev) => ({ ...prev, loading: true }));
      await loadRole(user.id);
    }
  }, [loadRole]);

  return {
    ...state,
    can: (capability: Capability) => (state.role ? userCan(state.role, capability) : false),
    refresh,
  };
}