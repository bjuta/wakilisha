import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import { incrementShareCount, getShareCounts, getTotalShareCount } from "@/services/shareTracking";
import { trackEvent } from "@/services/analytics";
import { buildUtmUrl, getUtmContextForUrl } from "@/services/attribution";
import { Portal } from "@/components/base/Portal";

// ═══════════════════════════════════════════════════════════════════════════
//  WAKILISHA SHARE — Unified share infrastructure across all surfaces
//  ═══════════════════════════════════════════════════════════════════════════

// ── Shared platform definitions — solid brand colors, white icons ──────────

export interface SharePlatform {
  key: string;
  name: string;
  icon: string;
  brandBg: string;
  brandText: string;
  buildUrl: (encodedUrl: string, encodedText: string) => string;
}

export const SHARE_PLATFORMS: SharePlatform[] = [
  {
    key: "copy",
    name: "Copy",
    icon: "ri-link",
    brandBg: "#888888",
    brandText: "#ffffff",
    buildUrl: () => "",
  },
  {
    key: "x",
    name: "X",
    icon: "ri-twitter-x-line",
    brandBg: "#000000",
    brandText: "#ffffff",
    buildUrl: (u, t) => `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
  },
  {
    key: "whatsapp",
    name: "WhatsApp",
    icon: "ri-whatsapp-line",
    brandBg: "#25D366",
    brandText: "#ffffff",
    buildUrl: (u, t) => `https://wa.me/?text=${t}%20${u}`,
  },
  {
    key: "facebook",
    name: "Facebook",
    icon: "ri-facebook-fill",
    brandBg: "#1877F2",
    brandText: "#ffffff",
    buildUrl: (u) => `https://www.facebook.com/sharer/sharer.php?u=${u}`,
  },
  {
    key: "telegram",
    name: "Telegram",
    icon: "ri-telegram-line",
    brandBg: "#26A5E4",
    brandText: "#ffffff",
    buildUrl: (u, t) => `https://t.me/share/url?url=${u}&text=${t}`,
  },
  {
    key: "linkedin",
    name: "LinkedIn",
    icon: "ri-linkedin-fill",
    brandBg: "#0A66C2",
    brandText: "#ffffff",
    buildUrl: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
  },
  {
    key: "reddit",
    name: "Reddit",
    icon: "ri-reddit-line",
    brandBg: "#FF4500",
    brandText: "#ffffff",
    buildUrl: (u, t) => `https://www.reddit.com/submit?url=${u}&title=${t}`,
  },
  {
    key: "pinterest",
    name: "Pinterest",
    icon: "ri-pinterest-line",
    brandBg: "#BD081C",
    brandText: "#ffffff",
    buildUrl: (u, t) => `https://pinterest.com/pin/create/button/?url=${u}&description=${t}`,
  },
  {
    key: "messenger",
    name: "Messenger",
    icon: "ri-messenger-line",
    brandBg: "#00B2FF",
    brandText: "#ffffff",
    buildUrl: (u) => `https://www.facebook.com/dialog/send?link=${u}&app_id=0`,
  },
  {
    key: "email",
    name: "Email",
    icon: "ri-mail-line",
    brandBg: "#EA4335",
    brandText: "#ffffff",
    buildUrl: (u, t) => `mailto:?subject=${t}&body=${encodeURIComponent(`${decodeURIComponent(t)}\n\n${decodeURIComponent(u)}`)}`,
  },
];

// ── Shared types ──────────────────────────────────────────────────────────

export type ShareObject = {
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string | null;
  url?: string;
  type?: "track" | "album" | "article" | "chart" | "artist" | "playlist" | "page";
};

const objectTypeLabel: Record<NonNullable<ShareObject["type"]>, string> = {
  track: "track",
  album: "album",
  article: "article",
  chart: "chart edition",
  artist: "artist page",
  playlist: "playlist",
  page: "page",
};

function getFinalUrl(baseUrl: string, timestamp?: string) {
  if (!timestamp) return baseUrl;
  return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}t=${encodeURIComponent(timestamp)}`;
}

function openPopup(url: string) {
  window.open(url, "_blank", "noopener,noreferrer,width=720,height=640");
}

// ── Share count badge (inline with the share button) ───────────────────────

export function ShareCountInline({ url }: { url: string }) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    getShareCounts(url)
      .then((counts) => {
        if (cancelled) return;
        const total = getTotalShareCount(counts);
        setCount(total > 0 ? total : null);
      })
      .catch(() => {
        if (!cancelled) setCount(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [url]);

  if (loading || count === null) return null;

  return (
    <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-[5px] rounded-full bg-[var(--wk-brand)]/10 text-[var(--wk-brand)] text-[10px] font-black ml-1.5">
      {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count.toLocaleString()}
    </span>
  );
}

// ── Compact preview — shared across popover and sheet ───────────────────────

function SharePreview({ item }: { item: ShareObject }) {
  return (
    <div className="share-preview">
      <div className="share-preview-art">
        {item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}
      </div>
      <div className="share-preview-text">
        <div className="share-preview-title">{item.title}</div>
        {item.subtitle && <div className="share-preview-sub">{item.subtitle}</div>}
      </div>
    </div>
  );
}

// ── Platform grid — shared rendering logic ─────────────────────────────────

function SharePlatformGrid({
  platforms,
  shareCounts = {},
  pendingPlatforms,
  onShare,
  onCopy,
  size = "md",
}: {
  platforms: SharePlatform[];
  shareCounts?: Record<string, number>;
  pendingPlatforms: Set<string>;
  onShare: (p: SharePlatform) => void;
  onCopy: () => void;
  size?: "sm" | "md";
}) {
  const iconSize = size === "sm" ? "text-[16px]" : "text-[18px]";
  const squareSize = size === "sm" ? "w-10 h-10" : "w-11 h-11";
  const labelSize = size === "sm" ? "text-[9px]" : "text-[10px]";

  return (
    <div className="share-grid">
      {platforms.map((p) => {
        const count = shareCounts[p.key] || 0;
        const isPending = pendingPlatforms.has(p.key);
        const isCopy = p.key === "copy";

        return (
          <button
            key={p.key}
            className="share-grid-item"
            onClick={() => {
              if (isCopy) onCopy();
              else onShare(p);
            }}
          >
            <div
              className={`${squareSize} rounded-xl flex items-center justify-center transition-transform share-grid-icon`}
              style={{ background: p.brandBg, color: p.brandText }}
            >
              <i className={`${p.icon} ${iconSize}`} />
            </div>
            <span className={`${labelSize} font-semibold text-[var(--wk-text-muted)]`}>
              {p.name}
            </span>
            {count > 0 && (
              <span className="share-grid-badge">
                {count}
              </span>
            )}
            {isPending && (
              <span className="share-grid-pending">
                <i className="ri-loader-4-line animate-spin text-[9px]" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  SHARE POPOVER — Desktop floating panel
//  ═══════════════════════════════════════════════════════════════════════════

interface SharePopoverProps {
  open: boolean;
  onClose: () => void;
  item: ShareObject;
  triggerRef: React.RefObject<HTMLElement | null>;
  timestamp?: string;
  onComment?: () => void;
}

export function SharePopover({
  open,
  onClose,
  item,
  triggerRef,
  timestamp,
  onComment,
}: SharePopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [shareCounts, setShareCounts] = useState<Record<string, number>>();
  const [pendingPlatforms, setPendingPlatforms] = useState<Set<string>>(new Set());
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const baseUrl = item.url || (typeof window !== "undefined" ? window.location.href : "");
  const finalUrl = useMemo(() => getFinalUrl(baseUrl, timestamp), [baseUrl, timestamp]);
  const shareText = item.description || item.subtitle || item.title;
  const shareContent = item.type ?? "page";
  const getTrackedShareUrl = useCallback((platformKey: string) => buildUtmUrl(finalUrl, {
    source: platformKey,
    medium: "share",
    campaign: "wakilisha_share",
    content: shareContent,
  }), [finalUrl, shareContent]);

  // Load counts
  useEffect(() => {
    if (!open || !baseUrl) return;
    getShareCounts(baseUrl).then(setShareCounts).catch(() => {});
    trackEvent("share_open", {
      pageType: item.type ?? "page",
      entitySlug: item.url ? (() => { try { return new URL(item.url).pathname.split("/").filter(Boolean).slice(-1)[0]; } catch { return undefined; } })() : undefined,
      entityType: item.type ?? undefined,
      context: {
        share_title: item.title,
        share_type: item.type ?? "page",
      },
    });
  }, [open, baseUrl, item]);

  // Position
  useEffect(() => {
    if (!open || !triggerRef.current || !panelRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const panelWidth = 380;
    const gap = 8;

    let left = trigger.left + trigger.width / 2 - panelWidth / 2;
    if (left < 16) left = 16;
    if (left + panelWidth > window.innerWidth - 16) left = window.innerWidth - panelWidth - 16;

    let top = trigger.bottom + gap;
    if (top + 520 > window.innerHeight) {
      top = trigger.top - 520 - gap;
    }
    setPosition({ top, left });
  }, [open, triggerRef]);

  // ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Click outside
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => document.addEventListener("pointerdown", onPointerDown), 0);
    return () => { clearTimeout(timer); document.removeEventListener("pointerdown", onPointerDown); };
  }, [open, onClose, triggerRef]);

  const handleCopy = useCallback(async () => {
    const trackedUrl = getTrackedShareUrl("copy");
    try { await navigator.clipboard.writeText(trackedUrl); } catch { /* no-op */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    trackEvent("share_copy", {
      pageType: item.type ?? "page",
      entitySlug: item.url ? (() => { try { return new URL(item.url).pathname.split("/").filter(Boolean).slice(-1)[0]; } catch { return undefined; } })() : undefined,
      entityType: item.type ?? undefined,
      context: {
        share_title: item.title,
        share_type: item.type ?? "page",
      },
    });
    incrementShareCount(baseUrl, "copy", item.url ? (() => { try { return new URL(item.url).pathname.split("/").filter(Boolean).slice(-1)[0]; } catch { return undefined; } })() : undefined, item.title).then((count) => {
      setShareCounts((prev) => ({ ...prev, copy: count }));
    }).catch(() => {});
  }, [getTrackedShareUrl, baseUrl, item]);

  const handleShare = useCallback(async (platform: SharePlatform) => {
    const trackedUrl = getTrackedShareUrl(platform.key);
    const encodedUrl = encodeURIComponent(trackedUrl);
    const encodedText = encodeURIComponent(shareText);

    trackEvent("share_click", {
      pageType: item.type ?? "page",
      entitySlug: item.url ? (() => { try { return new URL(item.url).pathname.split("/").filter(Boolean).slice(-1)[0]; } catch { return undefined; } })() : undefined,
      entityType: item.type ?? undefined,
      context: {
        share_platform: platform.key,
        share_title: item.title,
        share_type: item.type ?? "page",
        outbound_url: trackedUrl,
        outbound_utm: getUtmContextForUrl(trackedUrl),
      },
    });

    setPendingPlatforms((prev) => new Set(prev).add(platform.key));
    incrementShareCount(baseUrl, platform.key, item.url ? (() => { try { return new URL(item.url).pathname.split("/").filter(Boolean).slice(-1)[0]; } catch { return undefined; } })() : undefined, item.title).then((count) => {
      setShareCounts((prev) => ({ ...prev, [platform.key]: count }));
      setPendingPlatforms((prev) => { const next = new Set(prev); next.delete(platform.key); return next; });
    }).catch(() => {
      setPendingPlatforms((prev) => { const next = new Set(prev); next.delete(platform.key); return next; });
    });

    const shareUrl = platform.buildUrl(encodedUrl, encodedText);
    if (platform.key === "email") window.location.href = shareUrl;
    else openPopup(shareUrl);
  }, [getTrackedShareUrl, shareText, baseUrl, item]);

  const totalShares = getTotalShareCount(shareCounts);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[55]" onClick={onClose} />
      <div
        ref={panelRef}
        className="fixed z-[56] w-[380px] rounded-2xl border border-[var(--wk-border)] bg-white shadow-[0_8px_40px_-8px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.04)] overflow-hidden"
        style={{ top: position.top, left: position.left }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between">
          <div>
            <p className="text-[14px] font-bold text-[var(--wk-text)]">
              Share this {objectTypeLabel[item.type ?? "page"]}
            </p>
            {totalShares > 0 && (
              <p className="text-[11px] text-[var(--wk-text-muted)] mt-0.5">
                {totalShares.toLocaleString()} share{totalShares !== 1 ? "s" : ""} so far
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[var(--wk-surface)] flex items-center justify-center text-[var(--wk-text-soft)] hover:bg-[var(--wk-border)] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <i className="ri-close-line text-[14px]" />
          </button>
        </div>

        {/* Compact preview */}
        <div className="px-5 pb-3">
          <SharePreview item={item} />
        </div>

        {/* Comment action — scrolls to CommunitySection */}
        {onComment && (
          <>
            <div className="h-px bg-[var(--wk-border)]" />
            <div className="px-5 py-2">
              <button
                onClick={() => {
                  onClose();
                  setTimeout(() => onComment(), 300);
                }}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-colors hover:bg-[var(--wk-surface)] active:bg-[var(--wk-surface-strong)] cursor-pointer whitespace-nowrap"
              >
                <div className="w-8 h-8 rounded-lg bg-[var(--wk-surface)] flex items-center justify-center text-[16px] text-[var(--wk-text-muted)] shrink-0">
                  <i className="ri-chat-1-line" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-[13px] font-semibold text-[var(--wk-text)]">Comment</p>
                  <p className="text-[11px] text-[var(--wk-text-muted)]">Join the discussion</p>
                </div>
                <i className="ri-arrow-right-s-line text-[14px] text-[var(--wk-text-faint)]" />
              </button>
            </div>
          </>
        )}

        {/* Divider */}
        <div className="h-px bg-[var(--wk-border)]" />

        {/* Platform grid */}
        <div className="px-5 py-4">
          <SharePlatformGrid
            platforms={SHARE_PLATFORMS}
            shareCounts={shareCounts ?? {}}
            pendingPlatforms={pendingPlatforms}
            onShare={handleShare}
            onCopy={handleCopy}
            size="sm"
          />
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  SHARE SHEET — Mobile bottom sheet with drag-to-close
//  ═══════════════════════════════════════════════════════════════════════════

interface ShareSheetProps {
  item: ShareObject;
  open: boolean;
  onClose: () => void;
  timestamp?: string;
  onComment?: () => void;
}

export function ShareSheet({ item, open, onClose, timestamp, onComment }: ShareSheetProps) {
  const [shareCounts, setShareCounts] = useState<Record<string, number>>();
  const [pendingPlatforms, setPendingPlatforms] = useState<Set<string>>(new Set());
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragCurrentY = useRef(0);
  const isDragging = useRef(false);

  const baseUrl = item.url || (typeof window !== "undefined" ? window.location.href : "");
  const finalUrl = useMemo(() => getFinalUrl(baseUrl, timestamp), [baseUrl, timestamp]);
  const shareText = item.description || item.subtitle || item.title;
  const shareContent = item.type ?? "page";
  const getTrackedShareUrl = useCallback((platformKey: string) => buildUtmUrl(finalUrl, {
    source: platformKey,
    medium: "share",
    campaign: "wakilisha_share",
    content: shareContent,
  }), [finalUrl, shareContent]);

  useScrollLock(open);

  useEffect(() => {
    if (!open || !baseUrl) return;
    getShareCounts(baseUrl).then(setShareCounts).catch(() => {});
    trackEvent("share_open", {
      pageType: item.type ?? "page",
      entitySlug: item.url ? (() => { try { return new URL(item.url).pathname.split("/").filter(Boolean).slice(-1)[0]; } catch { return undefined; } })() : undefined,
      entityType: item.type ?? undefined,
      context: {
        share_title: item.title,
        share_type: item.type ?? "page",
      },
    });
  }, [open, baseUrl, item]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Drag-to-dismiss
  const onTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    dragStartY.current = e.touches[0].clientY;
    dragCurrentY.current = dragStartY.current;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    dragCurrentY.current = e.touches[0].clientY;
    const delta = dragCurrentY.current - dragStartY.current;
    if (delta > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
      sheetRef.current.style.transition = "none";
    }
  };
  const onTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const delta = dragCurrentY.current - dragStartY.current;
    if (sheetRef.current) {
      sheetRef.current.style.transition = "transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)";
      if (delta > 80) {
        sheetRef.current.style.transform = "translateY(100%)";
        setTimeout(() => onClose(), 250);
      } else {
        sheetRef.current.style.transform = "translateY(0)";
      }
    }
  };

  if (!open) return null;

  const handleCopy = async () => {
    const trackedUrl = getTrackedShareUrl("copy");
    try { await navigator.clipboard.writeText(trackedUrl); } catch { /* no-op */ }
    trackEvent("share_copy", {
      pageType: item.type ?? "page",
      entitySlug: item.url ? (() => { try { return new URL(item.url).pathname.split("/").filter(Boolean).slice(-1)[0]; } catch { return undefined; } })() : undefined,
      entityType: item.type ?? undefined,
      context: { share_title: item.title, share_type: item.type ?? "page" },
    });
    incrementShareCount(baseUrl, "copy", item.url ? (() => { try { return new URL(item.url).pathname.split("/").filter(Boolean).slice(-1)[0]; } catch { return undefined; } })() : undefined, item.title).then((count) => {
      setShareCounts((prev) => ({ ...prev, copy: count }));
    }).catch(() => {});
  };

  const handleShare = async (platform: SharePlatform) => {
    const trackedUrl = getTrackedShareUrl(platform.key);
    const encodedUrl = encodeURIComponent(trackedUrl);
    const encodedText = encodeURIComponent(shareText);

    trackEvent("share_click", {
      pageType: item.type ?? "page",
      entitySlug: item.url ? (() => { try { return new URL(item.url).pathname.split("/").filter(Boolean).slice(-1)[0]; } catch { return undefined; } })() : undefined,
      entityType: item.type ?? undefined,
      context: {
        share_platform: platform.key,
        share_title: item.title,
        share_type: item.type ?? "page",
        outbound_url: trackedUrl,
        outbound_utm: getUtmContextForUrl(trackedUrl),
      },
    });

    setPendingPlatforms((prev) => new Set(prev).add(platform.key));
    incrementShareCount(baseUrl, platform.key, item.url ? (() => { try { return new URL(item.url).pathname.split("/").filter(Boolean).slice(-1)[0]; } catch { return undefined; } })() : undefined, item.title).then((count) => {
      setShareCounts((prev) => ({ ...prev, [platform.key]: count }));
      setPendingPlatforms((prev) => { const next = new Set(prev); next.delete(platform.key); return next; });
    }).catch(() => {
      setPendingPlatforms((prev) => { const next = new Set(prev); next.delete(platform.key); return next; });
    });

    const shareUrl = platform.buildUrl(encodedUrl, encodedText);
    if (platform.key === "email") window.location.href = shareUrl;
    else openPopup(shareUrl);
  };

  const totalShares = getTotalShareCount(shareCounts);

  return (
    <Portal>
      <div className="share-sheet-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
        <div ref={sheetRef} className="share-sheet" onClick={(event) => event.stopPropagation()}>
          {/* Drag handle */}
          <div className="share-handle" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            <div className="share-handle-bar" />
          </div>

          {/* Scrollable content */}
          <div ref={scrollRef} data-scroll-lock="container" className="share-sheet-scroll">
            {/* Header */}
            <div className="share-header">
              <div>
                <div className="share-title">Share this {objectTypeLabel[item.type ?? "page"]}</div>
                <div className="share-sub">
                  {totalShares > 0
                    ? `${totalShares.toLocaleString()} share${totalShares !== 1 ? "s" : ""} so far`
                    : "Tap a platform to share instantly."}
                </div>
              </div>
              <button className="share-close-btn" onClick={onClose} aria-label="Close share sheet">
                <i className="ri-close-line text-[16px]" />
              </button>
            </div>

            {/* Compact preview */}
            <SharePreview item={item} />

            {/* Timestamp */}
            {timestamp && (
              <div className="share-timestamp">
                <div className="share-timestamp-label">Share from timestamp</div>
                <div className="share-timestamp-toggle">
                  <i className="ri-time-line text-[14px]" /> {timestamp}
                </div>
              </div>
            )}

            {/* Comment action — scrolls to CommunitySection */}
            {onComment && (
              <div className="px-5 pb-2">
                <button
                  onClick={() => {
                    onClose();
                    setTimeout(() => onComment(), 300);
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-colors hover:bg-[var(--wk-surface)] active:bg-[var(--wk-surface-strong)] cursor-pointer whitespace-nowrap"
                >
                  <div className="w-10 h-10 rounded-xl bg-[var(--wk-surface)] flex items-center justify-center text-[18px] text-[var(--wk-text-muted)] shrink-0">
                    <i className="ri-chat-1-line" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-[14px] font-semibold text-[var(--wk-text)]">Comment</p>
                    <p className="text-[11px] text-[var(--wk-text-muted)]">Join the discussion</p>
                  </div>
                  <i className="ri-arrow-right-s-line text-[16px] text-[var(--wk-text-faint)]" />
                </button>
              </div>
            )}

            {/* Platform grid — solid brand colors, same as popover */}
            <div className="share-sheet-grid-wrap">
              <SharePlatformGrid
                platforms={SHARE_PLATFORMS}
                shareCounts={shareCounts ?? {}}
                pendingPlatforms={pendingPlatforms}
                onShare={handleShare}
                onCopy={handleCopy}
                size="md"
              />
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

// ── ShareButton (desktop trigger) ─────────────────────────────────────────

export function ShareButton({ item, timestamp, label = "Share", onComment }: { item: ShareObject; timestamp?: string; label?: string; onComment?: () => void }) {
  const [open, setOpen] = useState(false);
  const baseUrl = item.url || (typeof window !== "undefined" ? window.location.href : "");
  return (
    <>
      <button className="wk-button wk-button-ghost relative" onClick={() => setOpen(true)}>
        <i className="ri-share-line text-[16px]" /> {label}
        <ShareCountInline url={baseUrl} />
      </button>
      <ShareSheet item={item} timestamp={timestamp} open={open} onClose={() => setOpen(false)} onComment={onComment} />
    </>
  );
}

// ── Mobile floating share button ──────────────────────────────────────────

export function MobileShareButton({
  item,
  timestamp,
  className = "",
  variant = "dark",
  size = "md",
  onComment,
}: {
  item: ShareObject;
  timestamp?: string;
  className?: string;
  variant?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  onComment?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const baseUrl = item.url || (typeof window !== "undefined" ? window.location.href : "");

  useEffect(() => {
    if (!baseUrl) return;
    let cancelled = false;
    getShareCounts(baseUrl)
      .then((counts) => {
        if (cancelled) return;
        const total = getTotalShareCount(counts);
        setCount(total > 0 ? total : null);
      })
      .catch(() => { if (!cancelled) setCount(null); });
    return () => { cancelled = true; };
  }, [baseUrl]);

  const sizeClasses = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-12 w-12" };
  const iconSizes = { sm: "text-base", md: "text-lg", lg: "text-xl" };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`relative flex ${sizeClasses[size]} items-center justify-center rounded-full backdrop-blur-md transition-all active:scale-95 cursor-pointer ${variant === "dark" ? "bg-black/40 text-white" : "bg-white/40 text-[var(--wk-text)]"} ${className}`}
        aria-label="Share"
      >
        <i className={`ri-share-line ${iconSizes[size]}`} />
        {count !== null && count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-[3px] rounded-full bg-[var(--wk-brand)] text-white text-[9px] font-black flex items-center justify-center border border-white/20">
            {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}
          </span>
        )}
      </button>
      <ShareSheet item={item} timestamp={timestamp} open={open} onClose={() => setOpen(false)} onComment={onComment} />
    </>
  );
}