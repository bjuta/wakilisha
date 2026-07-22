import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

const CANONICAL_PUBLIC_ORIGIN = String(
  import.meta.env.VITE_PUBLIC_SITE_ORIGIN ||
    "https://wakilisha.africa",
).replace(/\/+$/, "");

export default function PreviewPage() {
  const { nonce } = useParams<{ nonce: string }>();
  const navigate = useNavigate();
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!nonce) {
      setExpired(true);
      return;
    }

    if (window.location.origin !== CANONICAL_PUBLIC_ORIGIN) {
      window.location.replace(
        `${CANONICAL_PUBLIC_ORIGIN}/preview/${encodeURIComponent(nonce)}`,
      );
      return;
    }

    let alive = true;

    async function resolvePreview() {
      try {
        const apiBase =
          (import.meta.env.VITE_PUBLIC_API_BASE as string | undefined) ||
          "/api/v1";

        const { data: sessionData } =
          await supabase.auth.getSession();

        const accessToken =
          sessionData.session?.access_token;

        const anonKey =
          import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY ||
          import.meta.env.VITE_SUPABASE_ANON_KEY;

        const response = await fetch(
          `${apiBase}/preview/${encodeURIComponent(nonce)}`,
          {
            headers: {
              Accept: "application/json",
              ...(anonKey ? { apikey: anonKey } : {}),
              ...(accessToken || anonKey
                ? {
                    Authorization: `Bearer ${
                      accessToken || anonKey
                    }`,
                  }
                : {}),
            },
          },
        );

        if (!response.ok) {
          throw new Error("Preview unavailable.");
        }

        const payload = await response.json();
        const data =
          payload?.data?.article ||
          payload?.article ||
          payload?.data;

        const slug = String(data?.slug || "").trim();

        if (!slug) {
          throw new Error("Preview Article slug is missing.");
        }

        if (!alive) return;

        navigate(
          `/magazine/${encodeURIComponent(slug)}?preview=${encodeURIComponent(nonce)}`,
          { replace: true },
        );
      } catch {
        if (!alive) return;
        setExpired(true);
      }
    }

    void resolvePreview();

    return () => {
      alive = false;
    };
  }, [navigate, nonce]);

  if (expired) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-wk-warning-soft text-wk-warning">
          <i className="ri-time-line text-[28px]" />
        </div>

        <h1 className="text-[20px] font-black text-wk-text">
          Preview Unavailable
        </h1>

        <p className="max-w-md text-center text-[13px] text-wk-text-muted">
          This preview link has expired or is no longer valid.
          Ask the editor for a new preview link.
        </p>

        <Link
          to="/magazine"
          className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
        >
          <i className="ri-arrow-left-line text-[14px]" />
          Go to Magazine
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-3 text-wk-text-muted">
        <i className="ri-loader-4-line animate-spin text-[22px]" />
        <span className="text-[14px] font-semibold">
          Opening exact Article preview…
        </span>
      </div>
    </div>
  );
}
