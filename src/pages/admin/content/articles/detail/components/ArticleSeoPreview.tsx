import { useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";

/* ─── Types ─── */

interface SeoMeta {
  title?: string;
  description?: string;
  keywords?: string;
  [key: string]: unknown;
}

interface Props {
  title: string;
  excerpt: string;
  slug: string;
  seo: SeoMeta;
  author: string;
  publishedAt: string | null;
  featuredImage?: string;
}

/* ─── Component ─── */

export function ArticleSeoPreview({ title, excerpt, slug, seo, author, publishedAt, featuredImage }: Props) {
  const [activeTab, setActiveTab] = useState<"google" | "facebook" | "twitter">("google");

  const pageTitle = seo.title || title || "Untitled";
  const pageDesc = seo.description || excerpt || "No description set.";
  const pageUrl = `https://wakilisha.com/magazine/${slug}`;
  const displayDate = publishedAt ? new Date(publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "";

  const tabs = [
    { id: "google" as const, label: "Google", icon: "Search" },
    { id: "facebook" as const, label: "Facebook", icon: "Facebook" },
    { id: "twitter" as const, label: "Twitter/X", icon: "Twitter" },
  ];

  return (
    <div className="space-y-3">
      {/* Tab Switcher */}
      <div className="flex items-center gap-1 rounded-lg border border-wk-border bg-wk-bg-subtle p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all whitespace-nowrap flex-1 justify-center ${
              activeTab === tab.id
                ? "bg-wk-surface text-wk-text"
                : "text-wk-text-muted hover:text-wk-text"
            }`}
          >
            <WkIcon name={tab.icon as never} size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Previews */}
      {activeTab === "google" && (
        <GooglePreview title={pageTitle} description={pageDesc} url={pageUrl} />
      )}
      {activeTab === "facebook" && (
        <FacebookPreview title={pageTitle} description={pageDesc} url={pageUrl} image={featuredImage} />
      )}
      {activeTab === "twitter" && (
        <TwitterPreview title={pageTitle} description={pageDesc} url={pageUrl} image={featuredImage} author={author} />
      )}

      {/* SEO Score */}
      <SeoScore title={pageTitle} description={pageDesc} seo={seo} />
    </div>
  );
}

/* ─── Google Preview ─── */

function GooglePreview({ title, description, url }: { title: string; description: string; url: string }) {
  return (
    <WkSurface className="p-4 space-y-1">
      <div className="text-[12px] text-wk-text-muted mb-1">Google Search Result</div>
      <div className="max-w-[600px] space-y-1">
        <div className="text-[14px] text-[#8ab4f8] font-normal leading-tight truncate cursor-pointer hover:underline">
          {title}
        </div>
        <div className="flex items-center gap-1 text-[12px] text-[#dadce0]">
          <span>{url}</span>
          <WkIcon name="MoreVertical" size={12} />
        </div>
        <div className="text-[12px] text-[#bdc1c6] leading-[1.58] line-clamp-2">
          {description}
        </div>
      </div>
    </WkSurface>
  );
}

/* ─── Facebook Preview ─── */

function FacebookPreview({ title, description, url, image }: { title: string; description: string; url: string; image?: string }) {
  return (
    <WkSurface className="overflow-hidden">
      <div className="text-[12px] text-wk-text-muted p-4 pb-2">Facebook / Open Graph</div>
      <div className="max-w-[500px] border border-wk-border rounded-lg overflow-hidden bg-wk-bg-subtle">
        {image ? (
          <div className="h-[200px] w-full bg-wk-surface-raised">
            <img src={image} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="h-[160px] w-full bg-wk-surface-raised flex items-center justify-center">
            <div className="text-[12px] text-wk-text-faint">No featured image set</div>
          </div>
        )}
        <div className="p-3 space-y-1 bg-wk-surface">
          <div className="text-[12px] text-wk-text-muted uppercase truncate">{new URL(url).hostname}</div>
          <div className="text-[14px] font-semibold text-wk-text leading-tight">{title}</div>
          <div className="text-[12px] text-wk-text-muted line-clamp-2">{description}</div>
        </div>
      </div>
    </WkSurface>
  );
}

/* ─── Twitter Preview ─── */

function TwitterPreview({ title, description, url, image, author }: { title: string; description: string; url: string; image?: string; author: string }) {
  return (
    <WkSurface className="overflow-hidden">
      <div className="text-[12px] text-wk-text-muted p-4 pb-2">Twitter / X Card</div>
      <div className="max-w-[500px] border border-wk-border rounded-xl overflow-hidden bg-wk-bg-subtle">
        {image ? (
          <div className="h-[200px] w-full bg-wk-surface-raised">
            <img src={image} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="h-[160px] w-full bg-wk-surface-raised flex items-center justify-center">
            <div className="text-[12px] text-wk-text-faint">No featured image set</div>
          </div>
        )}
        <div className="p-3 space-y-1 bg-wk-surface">
          <div className="text-[14px] font-semibold text-wk-text leading-tight">{title}</div>
          <div className="text-[12px] text-wk-text-muted line-clamp-2">{description}</div>
          <div className="flex items-center gap-2 text-[11px] text-wk-text-faint mt-1">
            <span>by {author || "WAKILISHA"}</span>
            <span>·</span>
            <span>{new URL(url).hostname}</span>
          </div>
        </div>
      </div>
    </WkSurface>
  );
}

/* ─── SEO Score ─── */

function SeoScore({ title, description, seo }: { title: string; description: string; seo: SeoMeta }) {
  const checks = [
    { label: "SEO Title", pass: (seo.title ?? "").length > 0 && (seo.title ?? "").length <= 60, hint: "30-60 chars" },
    { label: "Meta Description", pass: (seo.description ?? "").length > 0 && (seo.description ?? "").length <= 160, hint: "120-160 chars" },
    { label: "Keywords", pass: (seo.keywords ?? "").length > 0, hint: "At least 1 keyword" },
    { label: "Page Title", pass: title.length > 0, hint: "Required" },
    { label: "Excerpt", pass: description.length > 0, hint: "Required for cards" },
  ];

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  const score = Math.round((passed / total) * 100);

  const scoreColor = score >= 80 ? "text-wk-success" : score >= 50 ? "text-wk-warning" : "text-wk-danger";
  const scoreBg = score >= 80 ? "bg-wk-success-soft" : score >= 50 ? "bg-wk-warning-soft" : "bg-wk-danger-soft";

  return (
    <WkSurface className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-wk-text-muted">SEO Score</span>
        <div className={`flex items-center gap-2 rounded-full ${scoreBg} px-3 py-1`}>
          <span className={`text-[14px] font-black ${scoreColor}`}>{score}/100</span>
          <span className="text-[10px] text-wk-text-muted uppercase">{passed}/{total} checks</span>
        </div>
      </div>
      <div className="space-y-2">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center justify-between text-[12px]">
            <div className="flex items-center gap-2">
              <WkIcon
                name={check.pass ? "CheckCircle2" : "XCircle"}
                size={14}
                className={check.pass ? "text-wk-success" : "text-wk-danger"}
              />
              <span className={check.pass ? "text-wk-text" : "text-wk-text-muted"}>{check.label}</span>
            </div>
            <span className="text-[11px] text-wk-text-faint">{check.hint}</span>
          </div>
        ))}
      </div>
    </WkSurface>
  );
}