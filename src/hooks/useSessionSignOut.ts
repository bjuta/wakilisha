import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export function useSessionSignOut(destination = "/auth") {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const signOut = useCallback(async () => {
    if (signingOut) return false;

    setSigningOut(true);
    setSignOutError(null);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setSignOutError("Could not sign out. Try again.");
        return false;
      }

      navigate(destination, { replace: true });
      return true;
    } catch {
      setSignOutError("Could not sign out. Try again.");
      return false;
    } finally {
      setSigningOut(false);
    }
  }, [destination, navigate, signingOut]);

  return {
    signOut,
    signingOut,
    signOutError,
  };
}
