import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export function RecoveryRedirectGuard() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const type = params.get("type");
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (type !== "recovery" || !accessToken || !refreshToken) return;
    if (location.pathname === "/auth/reset-password" || location.pathname === "/auth") return;

    navigate(`/auth/reset-password${hash}`, { replace: true });
  }, [location.pathname, navigate]);

  return null;
}
