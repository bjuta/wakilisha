import { useState, useCallback } from "react";
import { readingGuide } from "../readingData";

const networks = [
  { key: "whatsapp", label: "WhatsApp", icon: "ri-whatsapp-line" },
  { key: "twitter", label: "X", icon: "ri-twitter-x-line" },
  { key: "facebook", label: "Facebook", icon: "ri-facebook-line" },
  { key: "linkedin", label: "LinkedIn", icon: "ri-linkedin-line" },
  { key: "email", label: "Email", icon: "ri-mail-line" },
];

const moreNetworks = [
  { key: "telegram", label: "Telegram", icon: "ri-telegram-line" },
  { key: "sms", label: "SMS", icon: "ri-message-3-line" },
  { key: "reddit", label: "Reddit", icon: "ri-reddit-line" },
  { key: "pinterest", label: "Pinterest", icon: "ri-pinterest-line" },
  { key: "messenger", label: "Messenger", icon: "ri-messenger-line" },
];

function shareLink(network: string, url: string, title: string, desc: string) {
  const text = encodeURIComponent(`${title} — ${desc}`);
  const encodedUrl = encodeURIComponent(url);
  switch (network) {
    case "whatsapp":
      return `https://wa.me/?text=${text}%20${encodedUrl}`;
    case "twitter":
      return `https://twitter.com/intent/tweet?text=${text}&url=${encodedUrl}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    case "email":
      return `mailto:?subject=${encodeURIComponent(title)}&body=${text}%20${encodedUrl}`;
    case "telegram":
      return `https://t.me/share/url?url=${encodedUrl}&text=${text}`;
    case "reddit":
      return `https://reddit.com/submit?url=${encodedUrl}&title=${encodeURIComponent(title)}`;
    case "pinterest":
      return `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${text}`;
    case "tumblr":
      return `https://www.tumblr.com/share/link?url=${encodedUrl}&name=${encodeURIComponent(title)}`;
    case "pocket":
      return `https://getpocket.com/save?url=${encodedUrl}&title=${encodeURIComponent(title)}`;
    case "line":
      return `https://social-plugins.line.me/lineit/share?url=${encodedUrl}`;
    case "messenger":
      return `https://www.facebook.com/dialog/send?app_id=123&link=${encodedUrl}&redirect_uri=${encodedUrl}`;
    case "sms":
      return `sms:?&body=${text}%20${encodedUrl}`;
    default:
      return url;
  }
}

function copyToClipboard(text: string) {
  return navigator.clipboard.writeText(text);
}

export default function ReadingShareSection({ position }: { position: "top" | "bottom" }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    copyToClipboard(readingGuide.shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <section className="relative" style={{ background: "var(--wk-bg)" }}>
      <div className="max-w-[720px] mx-auto px-6 md:px-8 py-4">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold tracking-widest uppercase whitespace-nowrap" style={{ color: "var(--wk-text-muted)" }}>
            Share this
          </span>
          <span className="flex-1 h-px" style={{ background: "var(--wk-divider)" }} />
          <div className="flex items-center gap-1">
            {networks.map((n) => (
              <a
                key={n.key}
                href={shareLink(n.key, readingGuide.shareUrl, readingGuide.shareTitle, readingGuide.shareDescription)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 flex items-center justify-center rounded-md text-[16px] transition-colors hover:opacity-80"
                style={{ color: "var(--wk-text-muted)" }}
                aria-label={`Share on ${n.label}`}
                title={`Share on ${n.label}`}
              >
                <i className={n.icon} />
              </a>
            ))}
            <button
              type="button"
              onClick={handleCopy}
              className="w-8 h-8 flex items-center justify-center rounded-md text-[16px] transition-colors hover:opacity-80"
              style={{ color: "var(--wk-text-muted)" }}
              aria-label="Copy link"
              title={copied ? "Copied!" : "Copy link"}
            >
              <i className={copied ? "ri-check-line" : "ri-link"} />
            </button>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-md text-[16px] transition-colors hover:opacity-80"
              style={{ color: "var(--wk-text-muted)" }}
              aria-label="More share options"
              title="More"
            >
              <i className="ri-more-fill" />
            </button>
          </div>
        </div>
      </div>

      {/* More modal */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
          <div className="relative w-full max-w-[420px] rounded-xl overflow-hidden" style={{ background: "var(--wk-surface)" }}>
            <div className="p-5 pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-[16px] font-bold" style={{ color: "var(--wk-text)" }}>More ways to share</h3>
                  <p className="text-[13px] mt-1" style={{ color: "var(--wk-text-muted)" }}>
                    {readingGuide.shareTitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-md text-[18px] transition-colors"
                  style={{ color: "var(--wk-text-muted)" }}
                  aria-label="Close"
                >
                  <i className="ri-close-line" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 p-5 pt-0">
              {moreNetworks.map((n) => (
                <a
                  key={n.key}
                  href={shareLink(n.key, readingGuide.shareUrl, readingGuide.shareTitle, readingGuide.shareDescription)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 p-3 rounded-lg transition-colors hover:opacity-80"
                  style={{ color: "var(--wk-text)" }}
                >
                  <i className={`${n.icon} text-[20px]`} style={{ color: "var(--wk-text-muted)" }} />
                  <span className="text-[11px] font-medium">{n.label}</span>
                </a>
              ))}
              <button
                type="button"
                onClick={handleCopy}
                className="flex flex-col items-center gap-2 p-3 rounded-lg transition-colors hover:opacity-80"
                style={{ color: "var(--wk-text)" }}
              >
                <i className={`${copied ? "ri-check-line" : "ri-link"} text-[20px]`} style={{ color: "var(--wk-text-muted)" }} />
                <span className="text-[11px] font-medium">{copied ? "Copied" : "Copy link"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}