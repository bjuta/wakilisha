import { useState, useRef, useEffect } from "react";
import { WkIcon } from "@/components/design-system/Icon";

type PreviewMode = "desktop" | "mobile";

interface IssuePreviewPanelProps {
  open: boolean;
  onClose: () => void;
  html: string;
  title: string;
  loading?: boolean;
  error?: string | null;
}

export function IssuePreviewPanel({
  open,
  onClose,
  html,
  title,
  loading = false,
  error = null,
}: IssuePreviewPanelProps) {
  const [mode, setMode] = useState<PreviewMode>("desktop");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Lock scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_e) {
      // clipboard failed silently
    }
  };

  const handleOpenInTab = () => {
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  const iframeWidth = mode === "desktop" ? "100%" : "375px";

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-[var(--wk-bg)]"
      role="dialog"
      aria-modal="true"
      aria-label="Issue Preview"
    >
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-5 py-3 bg-[var(--wk-surface)] border-b border-[var(--wk-border)] shrink-0">
        {/* Left: close + title */}
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--wk-border)] px-3 py-1.5 text-[12px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] hover:border-[var(--wk-brand)] cursor-pointer transition-all whitespace-nowrap"
        >
          <span className="flex h-4 w-4 items-center justify-center">
            <WkIcon name="ArrowLeft" size={14} />
          </span>
          Back
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)] truncate">{title}</div>
          <div className="text-[11px] text-[var(--wk-text-muted)]">Email preview — rendered with your site identity branding</div>
        </div>

        {/* Center: Desktop / Mobile toggle */}
        <div className="flex items-center gap-1 rounded-lg bg-[var(--wk-bg)] border border-[var(--wk-border)] p-1 shrink-0">
          <button
            onClick={() => setMode("desktop")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
              mode === "desktop"
                ? "bg-[var(--wk-surface)] text-[var(--wk-text)] shadow-sm"
                : "text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
            }`}
          >
            <span className="flex h-3.5 w-3.5 items-center justify-center">
              <WkIcon name="Monitor" size={13} />
            </span>
            Desktop
          </button>
          <button
            onClick={() => setMode("mobile")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
              mode === "mobile"
                ? "bg-[var(--wk-surface)] text-[var(--wk-text)] shadow-sm"
                : "text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
            }`}
          >
            <span className="flex h-3.5 w-3.5 items-center justify-center">
              <WkIcon name="Smartphone" size={13} />
            </span>
            Mobile
          </button>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleOpenInTab}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--wk-border)] px-3 py-1.5 text-[12px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] cursor-pointer whitespace-nowrap transition-all"
          >
            <span className="flex h-3.5 w-3.5 items-center justify-center">
              <WkIcon name="ExternalLink" size={13} />
            </span>
            Open in tab
          </button>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold cursor-pointer whitespace-nowrap transition-all ${
              copied
                ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                : "border-[var(--wk-border)] text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
            }`}
          >
            <span className="flex h-3.5 w-3.5 items-center justify-center">
              <WkIcon name={copied ? "Check" : "Copy"} size={13} />
            </span>
            {copied ? "Copied!" : "Copy HTML"}
          </button>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div className="flex-1 overflow-auto bg-[#e8e4dc] flex flex-col items-center justify-start py-8 px-4">
        {loading && (
          <div className="flex items-center gap-3 text-[13px] text-[var(--wk-text-muted)] py-24">
            <span className="flex h-5 w-5 items-center justify-center">
              <WkIcon name="Loader" size={18} className="animate-spin" />
            </span>
            Rendering email preview...
          </div>
        )}
        {error && !loading && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center max-w-sm">
            <div className="flex items-center justify-center gap-2 text-red-600 text-[13px] font-semibold mb-2">
              <WkIcon name="AlertTriangle" size={16} />
              Preview failed
            </div>
            <p className="text-[12px] text-red-600">{error}</p>
          </div>
        )}
        {!loading && !error && html && (
          <div
            className="transition-all duration-300"
            style={{
              width: iframeWidth,
              maxWidth: "100%",
              boxShadow: mode === "mobile"
                ? "0 0 0 10px #1a1a1a, 0 0 0 12px #333, 0 30px 60px rgba(0,0,0,0.4)"
                : "0 4px 32px rgba(0,0,0,0.18)",
              borderRadius: mode === "mobile" ? "28px" : "8px",
              overflow: "hidden",
              background: "#ffffff",
            }}
          >
            {/* Mobile "notch" bar */}
            {mode === "mobile" && (
              <div
                style={{
                  background: "#1a1a1a",
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: "80px",
                    height: "8px",
                    background: "#333",
                    borderRadius: "4px",
                  }}
                />
              </div>
            )}
            <iframe
              ref={iframeRef}
              srcDoc={html}
              title="Email Preview"
              className="w-full border-0 block"
              style={{
                height: mode === "desktop" ? "calc(100vh - 200px)" : "780px",
                minHeight: 400,
              }}
              sandbox="allow-same-origin"
            />
            {mode === "mobile" && (
              <div
                style={{
                  background: "#1a1a1a",
                  height: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "5px",
                    background: "#444",
                    borderRadius: "3px",
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Status bar ── */}
      {!loading && !error && html && (
        <div className="px-5 py-2 bg-[var(--wk-surface)] border-t border-[var(--wk-border)] flex items-center justify-between text-[11px] text-[var(--wk-text-faint)] shrink-0">
          <span>
            Viewing as{" "}
            <strong className="text-[var(--wk-text-muted)]">
              {mode === "desktop" ? "desktop email client" : "mobile email client (375px)"}
            </strong>
          </span>
          <span>HTML size: {Math.round(html.length / 1024)}KB</span>
        </div>
      )}
    </div>
  );
}