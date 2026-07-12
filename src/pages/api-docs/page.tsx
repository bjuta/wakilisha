import { useEffect, useRef, useState } from "react";
import { publicContentReadSpec } from "@/data/api-specs/public-content-read";
import { AppLayout } from "@/components/layout/AppLayout";
import { loadRedoc } from "@/lib/redocLoader";

type LoadState = "loading" | "ready" | "error";

const REDOC_OPTIONS = {
  nativeScrollbars: true,
  theme: {
    colors: {
      primary: { main: "#1a1a1a" },
    },
    typography: {
      fontFamily: "'Inter', 'DM Sans', sans-serif",
      headings: {
        fontFamily: "'Inter', 'DM Sans', sans-serif",
      },
      code: {
        fontFamily: "'DM Mono', monospace",
        fontSize: "13px",
        lineHeight: "1.5",
      },
    },
  },
};

export default function PublicApiDocsPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadState, setLoadState] =
    useState<LoadState>("loading");

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    let cancelled = false;

    setLoadState("loading");

    loadRedoc()
      .then((redoc) => {
        if (cancelled) {
          return;
        }

        container.innerHTML = "";

        redoc.init(
          publicContentReadSpec,
          REDOC_OPTIONS,
          container,
          () => {
            if (!cancelled) {
              setLoadState("ready");
            }
          },
        );
      })
      .catch(() => {
        if (!cancelled) {
          setLoadState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppLayout>
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center gap-3">
            <i className="ri-book-open-line text-2xl text-foreground-700" />
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground-950">
                Public API Reference
              </h1>
              <p className="mt-1 text-sm text-foreground-600">
                Read-only access to WAKILISHA music and editorial content.
              </p>
            </div>
          </div>

          {loadState === "loading" && (
            <p
              role="status"
              className="mb-4 text-sm text-foreground-600"
            >
              Loading the API reference.
            </p>
          )}

          {loadState === "error" && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              The API reference could not load. Refresh this page to try again.
            </div>
          )}

          <div
            ref={containerRef}
            className="redoc-container"
            aria-busy={loadState === "loading"}
          />
        </div>
      </div>
    </AppLayout>
  );
}
