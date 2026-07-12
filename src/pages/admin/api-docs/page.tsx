import { useEffect, useRef, useState } from "react";
import { publicContentReadSpec } from "@/data/api-specs/public-content-read";
import { adminRouterSpec } from "@/data/api-specs/admin-router";
import { loadRedoc } from "@/lib/redocLoader";

type TabKey = "public" | "admin";
type LoadState = "loading" | "ready" | "error";

const TABS: {
  key: TabKey;
  label: string;
  icon: string;
  spec: unknown;
  description: string;
}[] = [
  {
    key: "public",
    label: "Public API",
    icon: "ri-global-line",
    spec: publicContentReadSpec,
    description:
      "Read-only access to artists, tracks, releases, labels, genres, charts, magazine stories, authors, and guides.",
  },
  {
    key: "admin",
    label: "Admin API",
    icon: "ri-shield-keyhole-line",
    spec: adminRouterSpec,
    description:
      "Authenticated access to registry records, chart ingestion, provider credentials, and user management.",
  },
];

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

export default function AdminApiDocsPage() {
  const [activeTab, setActiveTab] =
    useState<TabKey>("public");

  const [loadState, setLoadState] =
    useState<LoadState>("loading");

  const containerRef = useRef<HTMLDivElement>(null);

  const activeSpec =
    TABS.find((tab) => tab.key === activeTab) ??
    TABS[0];

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    let cancelled = false;

    container.innerHTML = "";
    setLoadState("loading");

    loadRedoc()
      .then((redoc) => {
        if (cancelled) {
          return;
        }

        redoc.init(
          activeSpec.spec,
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
  }, [activeTab, activeSpec.spec]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <i className="ri-book-open-line text-2xl text-foreground-700" />
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground-950">
            API Documentation
          </h1>
          <p className="mt-1 text-sm text-foreground-600">
            WAKILISHA OpenAPI 3.0.3 reference.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-background-100 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === tab.key
                ? "bg-white text-foreground-950 shadow-sm"
                : "text-foreground-600 hover:text-foreground-800"
            }`}
          >
            <i className={`${tab.icon} text-base`} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-background-200/70 bg-background-50 p-4">
        <i
          className={`${activeSpec.icon} text-base text-foreground-600`}
        />
        <span className="ml-2 text-sm text-foreground-600">
          {activeSpec.description}
        </span>
      </div>

      {loadState === "loading" && (
        <p
          role="status"
          className="text-sm text-foreground-600"
        >
          Loading the API reference.
        </p>
      )}

      {loadState === "error" && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          The API reference could not load. Refresh this page to try again.
        </div>
      )}

      <div className="rounded-xl border border-background-200/70 bg-white">
        <div
          ref={containerRef}
          className="redoc-container"
          aria-busy={loadState === "loading"}
        />
      </div>
    </div>
  );
}
