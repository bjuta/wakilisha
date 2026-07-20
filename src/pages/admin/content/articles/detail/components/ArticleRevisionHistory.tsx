import { useState, useEffect, useMemo } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { supabase } from "@/lib/supabase";

/* ─── Types ─── */

interface Revision {
  id: string;
  revision_number: number;
  version_kind: string | null;
  created_at: string;
  created_by: string;
  title: string | null;
  slug: string | null;
  content_html: string | null;
  excerpt: string | null;
  author: string | null;
  categories: string[] | null;
  tags: string[] | null;
  hero_image_url: string | null;
  seo: Record<string, unknown> | null;
  lifecycle_state: string | null;
  wp_status: string | null;
  published_at: string | null;
  content_fingerprint: string | null;
}

interface RestorePayload {
  title: string;
  excerpt: string;
  content: string;
  author: string;
  categories: string[];
  tags: string[];
  seo: Record<string, unknown>;
  publishedAt: string;
  wpStatus: string | null;
}

/* ─── Diff helpers ─── */

interface DiffSegment {
  type: "equal" | "added" | "removed";
  text: string;
}

function wordDiff(oldText: string, newText: string): DiffSegment[] {
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);

  // Simple LCS-based diff
  const m = oldWords.length;
  const n = newWords.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  const segments: DiffSegment[] = [];
  let i = m;
  let j = n;

  const backtrack: Array<{ type: "equal" | "added" | "removed"; word: string }> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      backtrack.unshift({ type: "equal", word: oldWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      backtrack.unshift({ type: "added", word: newWords[j - 1] });
      j--;
    } else {
      backtrack.unshift({ type: "removed", word: oldWords[i - 1] });
      i--;
    }
  }

  // Merge consecutive segments of the same type
  for (const item of backtrack) {
    const last = segments[segments.length - 1];
    if (last && last.type === item.type) {
      last.text += item.word;
    } else {
      segments.push({ type: item.type, text: item.word });
    }
  }

  return segments;
}

function stripHtmlForDiff(html: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}

function textValue(value: unknown): string {
  return String(value ?? "").trim();
}

function seoValue(seo: Record<string, unknown> | null, key: string): string {
  if (!seo || typeof seo !== "object") return "";
  return textValue(seo[key]);
}

function revisionComparisonText(revision: Revision): string {
  const categories = Array.isArray(revision.categories) ? revision.categories.join(", ") : "";
  const tags = Array.isArray(revision.tags) ? revision.tags.join(", ") : "";

  return [
    `Title: ${textValue(revision.title)}`,
    `Slug: ${textValue(revision.slug)}`,
    `Excerpt: ${textValue(revision.excerpt)}`,
    `Author: ${textValue(revision.author)}`,
    `Hero image: ${textValue(revision.hero_image_url)}`,
    `Status: ${textValue(revision.wp_status)}`,
    `Lifecycle: ${textValue(revision.lifecycle_state)}`,
    `Published: ${textValue(revision.published_at)}`,
    `Categories: ${categories}`,
    `Tags: ${tags}`,
    `SEO title: ${seoValue(revision.seo, "title")}`,
    `SEO description: ${seoValue(revision.seo, "description")}`,
    `SEO keywords: ${seoValue(revision.seo, "keywords")}`,
    `Content: ${stripHtmlForDiff(revision.content_html)}`,
  ].join("\n");
}

function normalizeVersionTerms(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") return item;

      if (item && typeof item === "object" && "name" in item) {
        return String((item as { name?: unknown }).name ?? "");
      }

      return String(item ?? "");
    })
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatVersionKind(value: string | null): string {
  if (!value) return "Version";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatLifecycleState(value: string | null): string {
  if (!value) return "Draft";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function lifecycleTone(value: string | null): string {
  if (value === "approved" || value === "published") return "bg-wk-success-soft text-wk-success";
  if (value === "changes_requested" || value === "archived" || value === "trash") return "bg-wk-warning-soft text-wk-warning";
  if (value === "submitted" || value === "pending") return "bg-wk-info-soft text-wk-info";
  return "bg-wk-bg-subtle text-wk-text-muted";
}

function restoreGuidance(revision: Revision, isCurrent: boolean, mode: "history" | "recovery"): string {
  if (isCurrent) return "This is the current saved version.";
  if (mode === "recovery") return "Restoring this creates a draft that needs review before publishing.";
  if (revision.lifecycle_state === "approved") return "This was approved before, but restoring it later creates a draft.";
  if (revision.lifecycle_state === "published") return "This was published before. Compare it carefully before restoring.";
  return "This version can be restored into the editor as a draft.";
}

/* ─── Component ─── */

interface Props {
  articleId: string;
  currentStatus: string | null;
  currentTitle: string;
  mode?: "history" | "recovery";
  onRestore?: (payload: RestorePayload) => void;
}

export function ArticleRevisionHistory({ articleId, currentStatus, currentTitle, mode = "history", onRestore }: Props) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRev, setExpandedRev] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<Revision | null>(null);

  // Compare mode
  const [compareMode, setCompareMode] = useState(false);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data, error } = await (supabase as unknown as {
        rpc: (
          name: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      }).rpc("list_article_versions", {
        p_article_id: articleId,
        p_limit: 30,
      });

      if (error) {
        console.warn("Failed to load article versions:", error.message);
        setRevisions([]);
      } else {
        const rows = Array.isArray(data) ? data as Array<Record<string, unknown>> : [];

        setRevisions(rows.map((row) => ({
          id: String(row.id ?? ""),
          revision_number: Number(row.revision_number ?? 0),
          version_kind: row.version_kind == null ? null : String(row.version_kind),
          created_at: String(row.created_at ?? ""),
          created_by: String(row.created_by ?? "System"),
          title: row.title == null ? null : String(row.title),
          slug: row.slug == null ? null : String(row.slug),
          content_html: row.content_html == null ? null : String(row.content_html),
          excerpt: row.excerpt == null ? null : String(row.excerpt),
          author: row.author == null ? null : String(row.author),
          categories: normalizeVersionTerms(row.categories),
          tags: normalizeVersionTerms(row.tags),
          hero_image_url: row.hero_image_url == null ? null : String(row.hero_image_url),
          seo: (row.seo as Record<string, unknown>) ?? {},
          lifecycle_state: row.lifecycle_state == null ? null : String(row.lifecycle_state),
          wp_status: row.wp_status == null ? null : String(row.wp_status),
          published_at: row.published_at == null ? null : String(row.published_at),
          content_fingerprint: row.content_fingerprint == null ? null : String(row.content_fingerprint),
        })));
      }

      setLoading(false);
    }

    load();
  }, [articleId]);

  // Compute diff when both sides selected
  const leftRevision = useMemo(
    () => revisions.find((r) => r.id === selectedLeft) ?? null,
    [revisions, selectedLeft]
  );
  const rightRevision = useMemo(
    () => revisions.find((r) => r.id === selectedRight) ?? null,
    [revisions, selectedRight]
  );

  const diffSegments = useMemo(() => {
    if (!leftRevision || !rightRevision) return null;
    const leftText = revisionComparisonText(leftRevision);
    const rightText = revisionComparisonText(rightRevision);
    if (leftText === rightText) return null;
    return wordDiff(leftText, rightText);
  }, [leftRevision, rightRevision]);

  function toggleCompare() {
    setCompareMode(!compareMode);
    setSelectedLeft(null);
    setSelectedRight(null);
    setExpandedRev(null);
  }

  function toggleSelection(revId: string) {
    if (!selectedLeft) {
      setSelectedLeft(revId);
    } else if (!selectedRight && revId !== selectedLeft) {
      setSelectedRight(revId);
    } else if (revId === selectedLeft) {
      setSelectedLeft(null);
    } else if (revId === selectedRight) {
      setSelectedRight(null);
    } else {
      // Reset
      setSelectedLeft(revId);
      setSelectedRight(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse h-10 rounded-lg bg-wk-surface-raised" />
        ))}
      </div>
    );
  }

  if (revisions.length === 0) {
    return (
      <div className="text-center py-4">
        <WkIcon name="History" size={20} className="text-wk-text-faint mx-auto mb-2" />
        <p className="text-[12px] text-wk-text-muted">No revisions yet.</p>
        <p className="text-[11px] text-wk-text-faint mt-1">Auto-saves appear here every 10 seconds.</p>
      </div>
    );
  }

  const highestRev = Math.max(...revisions.map((r) => r.revision_number));
  const currentRevision = revisions.find((r) => r.revision_number === highestRev) ?? revisions[0] ?? null;
  const approvedCount = revisions.filter((revision) => revision.lifecycle_state === "approved").length;
  const restoreCandidateCount = revisions.filter((revision) => revision.revision_number !== highestRev).length;

  return (
    <div className="space-y-4">
      <WkSurface className="overflow-hidden">
        <div className="border-b border-wk-border px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <WkIcon name={mode === "recovery" ? "RotateCcw" : "History"} size={16} className="text-wk-brand" />
                <h3 className="text-[15px] font-black text-wk-text">
                  {mode === "recovery" ? "Restore Points" : "Revision Ledger"}
                </h3>
              </div>
              <p className="mt-1 max-w-2xl text-[12px] leading-5 text-wk-text-muted">
                {mode === "recovery"
                  ? "Choose an earlier checkpoint to restore into the editor. Restored content becomes a draft and must pass review again."
                  : "Review each saved checkpoint, compare changes, and understand which version is currently active."}
              </p>
              <p className="mt-2 text-[11px] text-wk-text-faint">
                Article: <span className="font-semibold text-wk-text-soft">{currentTitle || "Untitled article"}</span>
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-wk-border bg-wk-bg-subtle px-3 py-2">
                <div className="text-[16px] font-black text-wk-text">{revisions.length}</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-wk-text-faint">Versions</div>
              </div>
              <div className="rounded-xl border border-wk-border bg-wk-bg-subtle px-3 py-2">
                <div className="text-[16px] font-black text-wk-text">{approvedCount}</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-wk-text-faint">Approved</div>
              </div>
              <div className="rounded-xl border border-wk-border bg-wk-bg-subtle px-3 py-2">
                <div className="text-[16px] font-black text-wk-text">{restoreCandidateCount}</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-wk-text-faint">Restore</div>
              </div>
            </div>
          </div>
        </div>

        {currentRevision ? (
          <div className="px-5 py-3 text-[12px] text-wk-text-muted">
            Current saved version: <span className="font-black text-wk-text">v{currentRevision.revision_number}</span>
            {" "}· Storage status: <span className="font-semibold uppercase text-wk-text-soft">{currentStatus || "draft"}</span>
            {" "}· Editorial snapshot: <span className="font-semibold text-wk-text-soft">{formatLifecycleState(currentRevision.lifecycle_state)}</span>
          </div>
        ) : null}
      </WkSurface>

      {/* Compare toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-wk-text-muted uppercase tracking-wider">
          {revisions.length} revision{revisions.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={toggleCompare}
          className={`flex items-center gap-1.5 text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            compareMode ? "text-wk-brand" : "text-wk-text-faint hover:text-wk-text"
          }`}
        >
          <WkIcon name={compareMode ? "X" : "GitCompare"} size={12} />
          {compareMode ? "Exit Compare" : "Compare Versions"}
        </button>
      </div>

      {/* Diff display */}
      {compareMode && selectedLeft && selectedRight && diffSegments && (
        <WkSurface className="overflow-hidden border-wk-brand/30">
          <div className="flex items-center justify-between px-4 py-2.5 bg-wk-bg-subtle border-b border-wk-border">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="font-semibold text-wk-danger">← v{leftRevision?.revision_number}</span>
              <span className="text-wk-text-faint">vs</span>
              <span className="font-semibold text-wk-success">v{rightRevision?.revision_number} →</span>
            </div>
            <span className="text-[10px] text-wk-text-faint">
              {diffSegments.filter((s) => s.type === "added").length > 0 && (
                <span className="text-wk-success">+{diffSegments.filter((s) => s.type === "added").reduce((sum, s) => sum + s.text.split(/\s+/).filter(Boolean).length, 0)} words </span>
              )}
              {diffSegments.filter((s) => s.type === "removed").length > 0 && (
                <span className="text-wk-danger">-{diffSegments.filter((s) => s.type === "removed").reduce((sum, s) => sum + s.text.split(/\s+/).filter(Boolean).length, 0)} words</span>
              )}
            </span>
          </div>
          <div className="p-4 max-h-[320px] overflow-y-auto">
            <div className="text-[13px] leading-relaxed font-mono whitespace-pre-wrap break-words">
              {diffSegments.map((seg, i) => (
                <span
                  key={i}
                  className={
                    seg.type === "added"
                      ? "bg-wk-success-soft text-wk-success"
                      : seg.type === "removed"
                        ? "bg-wk-danger-soft text-wk-danger line-through"
                        : "text-wk-text-soft"
                  }
                >
                  {seg.text}
                </span>
              ))}
            </div>
          </div>
        </WkSurface>
      )}

      {compareMode && selectedLeft && selectedRight && !diffSegments && (
        <div className="text-center py-3 text-[12px] text-wk-text-faint">
          <WkIcon name="CheckCircle2" size={14} className="inline text-wk-success mr-1" />
          No tracked editorial fields changed in this checkpoint.
        </div>
      )}

      {compareMode && (!selectedLeft || !selectedRight) && (
        <div className="text-center py-3 text-[12px] text-wk-text-faint">
          {!selectedLeft ? "Select the older version (left)" : "Now select the newer version (right)"}
        </div>
      )}

      {/* Revision list */}
      {(!compareMode || diffSegments === null) && revisions.map((rev) => {
        const isExpanded = expandedRev === rev.id;
        const isCurrent = rev.revision_number === highestRev;
        const isAutosave = rev.created_by === "System" || rev.created_by === "autosave";
        const isSelected = selectedLeft === rev.id || selectedRight === rev.id;
        const lifecycleLabel = formatLifecycleState(rev.lifecycle_state);
        const versionKindLabel = formatVersionKind(rev.version_kind);

        return (
          <WkSurface
            key={rev.id}
            className={`overflow-hidden transition-all cursor-pointer ${
              isExpanded ? "border-wk-brand/30" : ""
            } ${isSelected ? "ring-2 ring-wk-brand/30 border-wk-brand/40" : ""} ${
              selectedLeft === rev.id ? "ring-wk-danger/30 border-wk-danger/40" : ""
            } ${selectedRight === rev.id ? "ring-wk-success/30 border-wk-success/40" : ""}`}
          >
            <div
              onClick={() => {
                if (compareMode) {
                  toggleSelection(rev.id);
                } else {
                  setExpandedRev(isExpanded ? null : rev.id);
                }
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-wk-surface-raised transition-colors"
            >
              {/* Selection indicator */}
              {compareMode && (
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                  selectedLeft === rev.id
                    ? "border-wk-danger bg-wk-danger-soft text-wk-danger"
                    : selectedRight === rev.id
                      ? "border-wk-success bg-wk-success-soft text-wk-success"
                      : "border-wk-border text-wk-text-faint"
                }`}>
                  {selectedLeft === rev.id ? (
                    <span className="text-[10px] font-black">L</span>
                  ) : selectedRight === rev.id ? (
                    <span className="text-[10px] font-black">R</span>
                  ) : (
                    <span className="text-[10px]">·</span>
                  )}
                </div>
              )}

              <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${
                isAutosave ? "bg-wk-info-soft text-wk-info" : "bg-wk-surface-raised text-wk-text-muted"
              } ${!compareMode ? "" : "hidden sm:flex"}`}>
                <WkIcon name={isAutosave ? "Save" : "GitCommit"} size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-wk-text">
                    {isCurrent ? "Current" : `v${rev.revision_number}`}
                  </span>
                  {isCurrent && (
                    <span className="inline-flex items-center rounded-full bg-wk-brand-soft px-2 py-0.5 text-[10px] font-bold text-wk-brand">
                      Latest
                    </span>
                  )}
                  {isAutosave && (
                    <span className="inline-flex items-center rounded-full bg-wk-info-soft px-2 py-0.5 text-[10px] font-bold text-wk-info">
                      Auto-saved
                    </span>
                  )}
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${lifecycleTone(rev.lifecycle_state)}`}>
                    {lifecycleLabel}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-wk-bg-subtle px-2 py-0.5 text-[10px] font-bold text-wk-text-faint">
                    {versionKindLabel}
                  </span>
                  <span className="text-[11px] text-wk-text-muted">
                    by {rev.created_by || "System"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-wk-text-faint mt-0.5">
                  <span>{new Date(rev.created_at).toLocaleString()}</span>
                  <span>·</span>
                  <span className="uppercase">Storage {rev.wp_status || "draft"}</span>
                  <span>·</span>
                  <span>{restoreGuidance(rev, isCurrent, mode)}</span>
                </div>
              </div>
              {!compareMode && (
                <WkIcon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={14} className="text-wk-text-faint" />
              )}
            </div>

            {isExpanded && !compareMode && (
              <div className="border-t border-wk-border px-4 py-3 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-[12px]">
                  <div>
                    <span className="text-[11px] font-semibold text-wk-text-muted uppercase">Title</span>
                    <p className="text-wk-text mt-0.5 truncate">{rev.title || "Not set"}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-wk-text-muted uppercase">Author</span>
                    <p className="text-wk-text mt-0.5">{rev.author || "Not set"}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-wk-text-muted uppercase">Slug</span>
                    <p className="text-wk-text mt-0.5 font-mono truncate">{rev.slug || "Not set"}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-wk-text-muted uppercase">Storage Status</span>
                    <p className="text-wk-text mt-0.5 uppercase">{rev.wp_status || "draft"}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-wk-text-muted uppercase">Published</span>
                    <p className="text-wk-text mt-0.5">
                      {rev.published_at ? new Date(rev.published_at).toLocaleString() : "Not set"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-wk-text-muted uppercase">Lifecycle</span>
                    <p className="text-wk-text mt-0.5">{lifecycleLabel}</p>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-wk-text-muted uppercase">Kind</span>
                    <p className="text-wk-text mt-0.5">{versionKindLabel}</p>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-wk-text-muted uppercase">Excerpt</span>
                  <p className="text-[12px] text-wk-text mt-0.5">{rev.excerpt || "Not set"}</p>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-wk-text-muted uppercase">Hero Image</span>
                  <p className="text-[12px] text-wk-text mt-0.5 break-all">{rev.hero_image_url || "Not set"}</p>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-wk-text-muted uppercase">Content</span>
                  <div className="mt-1 rounded-lg border border-wk-border bg-wk-bg-subtle p-3 max-h-[200px] overflow-y-auto">
                    <div
                      className="text-[12px] text-wk-text-soft leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: rev.content_html || "<p>Not set</p>" }}
                    />
                  </div>
                </div>

                {!isCurrent && (
                  <div className="flex flex-col gap-2 rounded-xl border border-wk-warning/30 bg-wk-warning-soft/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-[12px] leading-5 text-wk-text-muted">
                      <span className="font-black text-wk-text">Restore safety:</span> This returns the content as a draft. It does not preserve prior approval.
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowConfirm(rev); }}
                      className="wk-button wk-button-secondary wk-button-sm whitespace-nowrap"
                    >
                      <WkIcon name="RotateCcw" size={14} />
                      Restore as Draft
                    </button>
                  </div>
                )}
              </div>
            )}
          </WkSurface>
        );
      })}

      {/* Confirm restore modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm mx-4 rounded-2xl border border-wk-border bg-wk-surface p-6 shadow-lg">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-wk-warning-soft text-wk-warning">
              <WkIcon name="RotateCcw" size={22} />
            </div>
            <h3 className="text-[16px] font-bold text-wk-text mb-2">Restore Version as Draft?</h3>
            <p className="text-[13px] text-wk-text-muted mb-3">
              This will restore version {showConfirm.revision_number} from{" "}
              {new Date(showConfirm.created_at).toLocaleString()} into the editor.
            </p>
            <p className="mb-5 rounded-lg border border-wk-warning/30 bg-wk-warning-soft px-3 py-2 text-[12px] leading-5 text-wk-warning">
              Restored content must be saved, submitted, and approved again before it can be published.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(null)}
                className="wk-button wk-button-secondary wk-button-sm flex-1 whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const payload: RestorePayload = {
                    title: showConfirm.title || "",
                    excerpt: showConfirm.excerpt || "",
                    content: showConfirm.content_html || "",
                    author: showConfirm.author || "",
                    categories: Array.isArray(showConfirm.categories) ? showConfirm.categories : [],
                    tags: Array.isArray(showConfirm.tags) ? showConfirm.tags : [],
                    seo: (showConfirm.seo as Record<string, unknown>) || {},
                    publishedAt: showConfirm.published_at || "",
                    wpStatus: showConfirm.wp_status,
                  };
                  onRestore?.(payload);
                  setShowConfirm(null);
                }}
                className="wk-button wk-button-sm flex-1 whitespace-nowrap bg-wk-warning text-wk-brand-on hover:opacity-90 border border-wk-warning"
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}