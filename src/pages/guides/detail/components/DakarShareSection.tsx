import { useState, useCallback } from "react";
import { dakarData } from "../dakarData";

const NETWORKS = [
  { id: "whatsapp", label: "WhatsApp", icon: "ri-whatsapp-line" },
  { id: "twitter", label: "X", icon: "ri-twitter-x-line" },
  { id: "facebook", label: "Facebook", icon: "ri-facebook-fill" },
  { id: "linkedin", label: "LinkedIn", icon: "ri-linkedin-fill" },
  { id: "email", label: "Email", icon: "ri-mail-line" },
];

const MORE_NETWORKS = [
  { id: "telegram", label: "Telegram", icon: "ri-telegram-line" },
  { id: "reddit", label: "Reddit", icon: "ri-reddit-line" },
  { id: "pinterest", label: "Pinterest", icon: "ri-pinterest-line" },
  { id: "tumblr", label: "Tumblr", icon: "ri-tumblr-fill" },
  { id: "pocket", label: "Pocket", icon: "ri-bookmark-line" },
  { id: "line", label: "Line", icon: "ri-chat-1-line" },
  { id: "messenger", label: "Messenger", icon: "ri-messenger-line" },
];

function shareUrl(network: string, url: string, title: string, description: string) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedDesc = encodeURIComponent(description);
  switch (network) {
    case "whatsapp": return `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`;
    case "twitter": return `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`;
    case "facebook": return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    case "linkedin": return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    case "email": return `mailto:?subject=${encodedTitle}&body=${encodedDesc}%0A%0A${encodedUrl}`;
    case "telegram": return `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`;
    case "reddit": return `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`;
    case "pinterest": return `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedTitle}`;
    case "tumblr": return `https://www.tumblr.com/widgets/share/tool?canonicalUrl=${encodedUrl}&title=${encodedTitle}`;
    case "pocket": return `https://getpocket.com/save?url=${encodedUrl}&title=${encodedTitle}`;
    case "line": return `https://social-plugins.line.me/lineit/share?url=${encodedUrl}`;
    case "messenger": return `fb-messenger://share/?link=${encodedUrl}`;
    default: return url;
  }
}

export default function DakarShareSection({ position = "top" }: { position?: "top" | "bottom" }) {
  const { share } = dakarData;
  const [showMore, setShowMore] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback((networkId: string) => {
    const url = shareUrl(networkId, share.url, share.title, share.description);
    window.open(url, "_blank", "noopener,noreferrer");
  }, [share]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silently fail
    }
  }, [share.url]);

  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: share.title, text: share.description, url: share.url });
      } catch {
        // user cancelled
      }
    }
  }, [share]);

  return (
    <section className="w-full py-6 border-b border-[var(--wk-divider)]" style={{ background: "var(--wk-bg)" }}>
      <div className="wk-container-wide px-6 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--wk-text-muted)]">Share this</span>
        <span className="w-8 h-px bg-[var(--wk-divider)]" />

        <span className="flex flex-wrap items-center gap-2">
          {NETWORKS.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => handleShare(n.id)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] transition-colors rounded-md hover:bg-[var(--wk-surface-raised)]"
              aria-label={`Share on ${n.label}`}
              title={`Share on ${n.label}`}
            >
              <i className={`${n.icon} text-sm`} />
            </button>
          ))}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] transition-colors rounded-md hover:bg-[var(--wk-surface-raised)]"
            aria-label="Copy link"
            title={copied ? "Copied!" : "Copy link"}
          >
            <i className={`${copied ? "ri-check-line" : "ri-link"} text-sm`} />
          </button>
          {navigator.share && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] transition-colors rounded-md hover:bg-[var(--wk-surface-raised)]"
              aria-label="Share"
              title="Share"
            >
              <i className="ri-share-line text-sm" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] transition-colors rounded-md hover:bg-[var(--wk-surface-raised)]"
            aria-label="More share options"
            title="More"
          >
            <i className="ri-more-fill text-sm" />
          </button>
        </span>
      </div>

      {/* More modal */}
      {showMore && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label="More ways to share"
          onClick={() => setShowMore(false)}
        >
          <div
            className="w-full max-w-md rounded-xl p-6"
            style={{ background: "var(--wk-surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[var(--wk-text)]">More ways to share</h3>
                <p className="text-xs text-[var(--wk-text-muted)] mt-0.5">{share.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMore(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)] transition-colors"
                aria-label="Close"
              >
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MORE_NETWORKS.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => { handleShare(n.id); setShowMore(false); }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-lg text-xs text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)] transition-colors"
                  aria-label={`Share on ${n.label}`}
                >
                  <i className={`${n.icon} text-lg`} />
                  <span>{n.label}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => { handleCopy(); setShowMore(false); }}
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg text-xs text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)] transition-colors"
                aria-label="Copy link"
              >
                <i className={`${copied ? "ri-check-line" : "ri-link"} text-lg`} />
                <span>{copied ? "Copied" : "Copy link"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}