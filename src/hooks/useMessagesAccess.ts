import { useEffect, useState } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";
import {
  getMyMessagesAccess,
  type MyMessagesAccess,
} from "@/services/messages";

const CLOSED: MyMessagesAccess = {
  audience_mode: "unknown",
  sender_category: "unknown",
  can_send: false,
  has_conversations: false,
  visible: false,
};

export function useMessagesAccess() {
  const authUser = useAuthUser();
  const [access, setAccess] = useState<MyMessagesAccess>(CLOSED);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (authUser.loading) return () => { cancelled = true; };

    if (!authUser.id) {
      setAccess(CLOSED);
      setLoading(false);
      return () => { cancelled = true; };
    }

    setLoading(true);
    getMyMessagesAccess()
      .then((next) => {
        if (!cancelled) setAccess(next);
      })
      .catch(() => {
        if (!cancelled) setAccess(CLOSED);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [authUser.id, authUser.loading]);

  return {
    ...access,
    loading: loading || authUser.loading,
  };
}
