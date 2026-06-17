import { useEffect, useRef } from "react";
import { publicContentReadSpec } from "@/data/api-specs/public-content-read";
import { AppLayout } from "@/components/layout/AppLayout";

declare global {
  interface Window {
    Redoc: {
      init: (spec: unknown, options: Record<string, unknown>, element: HTMLElement, callback?: () => void) => void;
    };
  }
}

export default function PublicApiDocsPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !window.Redoc) return;
    window.Redoc.init(
      publicContentReadSpec,
      {
        nativeScrollbars: true,
        theme: {
          colors: {
            primary: { main: "#1a1a1a" },
          },
          typography: {
            fontFamily: "'Inter', 'DM Sans', sans-serif",
            headings: { fontFamily: "'Inter', 'DM Sans', sans-serif" },
            code: { fontFamily: "'DM Mono', monospace", fontSize: "13px", lineHeight: "1.5" },
          },
        },
      },
      containerRef.current,
    );
  }, []);

  return (
    <AppLayout>
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center gap-3">
            <i className="ri-book-open-line text-2xl text-foreground-700"></i>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground-950">Public API Reference</h1>
              <p className="mt-1 text-sm text-foreground-600">
                WAKILISHA Public Content API — read-only gateway for music and editorial content
              </p>
            </div>
          </div>
          <div ref={containerRef} className="redoc-container" />
        </div>
      </div>
    </AppLayout>
  );
}