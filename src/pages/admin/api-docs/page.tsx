import { useEffect, useRef, useState } from "react";
import { publicContentReadSpec } from "@/data/api-specs/public-content-read";
import { adminRouterSpec } from "@/data/api-specs/admin-router";

declare global {
  interface Window {
    Redoc: {
      init: (spec: unknown, options: Record<string, unknown>, element: HTMLElement, callback?: () => void) => void;
    };
  }
}

type TabKey = "public" | "admin";

const TABS: { key: TabKey; label: string; icon: string; spec: unknown; description: string }[] = [
  {
    key: "public",
    label: "Public API",
    icon: "ri-global-line",
    spec: publicContentReadSpec,
    description: "Read-only gateway for artists, tracks, releases, labels, genres, charts, magazine, authors and guides. No authentication required.",
  },
  {
    key: "admin",
    label: "Admin API",
    icon: "ri-shield-keyhole-line",
    spec: adminRouterSpec,
    description: "Admin gateway for registry CRUD, chart ingestion pipeline, provider credentials, and user management. JWT authentication required.",
  },
];

export default function AdminApiDocsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("public");
  const containerRef = useRef<HTMLDivElement>(null);
  const activeSpec = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  useEffect(() => {
    if (!containerRef.current || !window.Redoc) return;
    containerRef.current.innerHTML = "";
    window.Redoc.init(
      activeSpec.spec,
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
  }, [activeTab]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <i className="ri-book-open-line text-2xl text-foreground-700"></i>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground-950">API Documentation</h1>
          <p className="mt-1 text-sm text-foreground-600">WAKILISHA API reference — OpenAPI 3.0.3 specs rendered with Redoc</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-background-100 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === tab.key
                ? "bg-white text-foreground-950 shadow-sm"
                : "text-foreground-600 hover:text-foreground-800"
            }`}
          >
            <i className={`${tab.icon} text-base`}></i>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-background-200/70 bg-background-50 p-4">
        <i className={`${activeSpec.icon} text-base text-foreground-600`}></i>
        <span className="ml-2 text-sm text-foreground-600">{activeSpec.description}</span>
      </div>

      <div className="rounded-xl border border-background-200/70 bg-white">
        <div ref={containerRef} className="redoc-container" />
      </div>
    </div>
  );
}