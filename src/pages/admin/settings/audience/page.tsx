import { useCallback, useEffect, useMemo, useState } from "react";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  briefingService,
  type AudienceSegmentRow,
  type AudienceSegmentsResult,
  type AudienceSegmentSendFilters,
  type BriefingCatalogItem,
} from "@/services/briefingService";

const ENTITY_TYPES = ["", "artist", "guide", "briefing", "track", "release", "chart", "genre", "label", "article"];
const SUBSCRIBER_STATUSES = ["", "confirmed", "pending", "unsubscribed"];
const INTEREST_STATUSES = ["", "active", "suppressed", "unsubscribed"];

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function exportRows(rows: AudienceSegmentRow[]) {
  const headers = [
    "email",
    "subscriber_status",
    "entity_type",
    "entity_slug",
    "entity_name",
    "interest_kind",
    "source_form",
    "interest_strength",
    "interest_status",
    "briefings",
    "source_page",
    "last_seen_at",
  ];

  const lines = [
    headers.join(","),
    ...rows.map((row) => [
      row.email,
      row.subscriber_status,
      row.entity_type,
      row.entity_slug,
      row.entity_name ?? "",
      row.interest_kind,
      row.source_form,
      row.interest_strength,
      row.status,
      row.briefings.map((briefing) => briefing.slug).join("|"),
      row.source_page ?? "",
      row.last_seen_at,
    ].map(csvEscape).join(",")),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `wakilisha-audience-segments-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wk-text-muted)]">
      {children}
    </span>
  );
}

function StatCard({ label, value, helper }: { label: string; value: string | number; helper?: string }) {
  return (
    <WkSurface className="p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">{label}</p>
      <p className="mt-2 text-[28px] font-black tracking-[-0.04em] text-[var(--wk-text)]">{value}</p>
      {helper && <p className="mt-1 text-[12px] text-[var(--wk-text-muted)]">{helper}</p>}
    </WkSurface>
  );
}

interface SegmentIssueOption {
  id: string;
  title: string;
  slug: string;
  status: string;
  iso_week: string;
  created_at?: string;
  briefing_catalog?: { slug: string; title: string } | null;
}

export default function AdminSettingsAudience() {
  const [catalog, setCatalog] = useState<BriefingCatalogItem[]>([]);
  const [result, setResult] = useState<AudienceSegmentsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [subscriberStatus, setSubscriberStatus] = useState("confirmed");
  const [interestStatus, setInterestStatus] = useState("active");
  const [briefingSlug, setBriefingSlug] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entitySlug, setEntitySlug] = useState("");
  const [sourceForm, setSourceForm] = useState("");
  const [limit, setLimit] = useState(250);

  const [issues, setIssues] = useState<SegmentIssueOption[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setCatalogLoading(true);
      try {
        const items = await briefingService.admin.listAllCatalog();
        if (!cancelled) setCatalog(items);
      } catch {
        if (!cancelled) setCatalog([]);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadSegments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await briefingService.admin.listAudienceSegments({
        subscriberStatus,
        interestStatus,
        briefingSlug,
        entityType,
        entitySlug: entitySlug.trim(),
        sourceForm: sourceForm.trim(),
        limit,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load audience segments.");
    } finally {
      setLoading(false);
    }
  }, [subscriberStatus, interestStatus, briefingSlug, entityType, entitySlug, sourceForm, limit]);

  useEffect(() => {
    loadSegments();
  }, [loadSegments]);

  const loadSegmentIssues = useCallback(async () => {
    setSendError(null);

    if (!briefingSlug) {
      setIssues([]);
      setSelectedIssueId("");
      return;
    }

    setIssuesLoading(true);
    try {
      const data = await briefingService.admin.listIssues({ briefingSlug, limit: 50 });
      const sendable = (data as SegmentIssueOption[]).filter((issue) => issue.status !== "sent");
      setIssues(sendable);
      setSelectedIssueId((current) => sendable.some((issue) => issue.id === current) ? current : (sendable[0]?.id ?? ""));
    } catch (err) {
      setIssues([]);
      setSelectedIssueId("");
      setSendError(err instanceof Error ? err.message : "Could not load sendable issues for this briefing.");
    } finally {
      setIssuesLoading(false);
    }
  }, [briefingSlug]);

  useEffect(() => {
    loadSegmentIssues();
  }, [loadSegmentIssues]);

  const rows = result?.rows ?? [];
  const summary = result?.summary;

  const sourceFormOptions = useMemo(() => {
    const fromRows = new Set(rows.map((row) => row.source_form).filter(Boolean));
    return Array.from(fromRows).sort();
  }, [rows]);

  const issueOptions = useMemo(() => issues.filter((issue) => issue.status !== "sent"), [issues]);
  const selectedIssue = useMemo(() => issueOptions.find((issue) => issue.id === selectedIssueId), [issueOptions, selectedIssueId]);
  const sendTargetCount = summary?.confirmed_subscribers ?? 0;

  const sendDisabledReason = !briefingSlug
    ? "Choose a briefing first. Segment sending is always scoped to one briefing issue."
    : subscriberStatus !== "confirmed"
      ? "Segment sends are limited to confirmed subscribers only."
      : interestStatus !== "active"
        ? "Segment sends are limited to active interests only."
        : issuesLoading
          ? "Loading sendable issues for this briefing."
          : !selectedIssueId
            ? "Choose an unsent issue to send."
            : sendTargetCount < 1
              ? "No confirmed subscribers match this segment."
              : null;

  const canSendSegment = !sendDisabledReason && !sending;

  const segmentLabel = useMemo(() => {
    const parts = [
      subscriberStatus || "all subscribers",
      interestStatus ? `${interestStatus} interests` : "all interests",
      briefingSlug ? `briefing:${briefingSlug}` : "",
      entityType ? `entity:${entityType}` : "",
      entitySlug ? `slug:${entitySlug}` : "",
      sourceForm ? `source:${sourceForm}` : "",
    ].filter(Boolean);
    return parts.join(" · ");
  }, [subscriberStatus, interestStatus, briefingSlug, entityType, entitySlug, sourceForm]);

  const handleSendSegment = async () => {
    setSendMessage(null);
    setSendError(null);

    if (sendDisabledReason) {
      setSendError(sendDisabledReason);
      return;
    }

    const filters: AudienceSegmentSendFilters = {
      subscriberStatus: "confirmed",
      interestStatus: "active",
      briefingSlug,
      entityType,
      entitySlug: entitySlug.trim(),
      sourceForm: sourceForm.trim(),
    };

    setSending(true);
    try {
      const response = await briefingService.admin.sendIssue(selectedIssueId, filters);
      setSendMessage(response.message);
      await loadSegments();
      await loadSegmentIssues();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Could not send this briefing to the selected segment.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
              <i className="ri-group-line text-[18px]" />
            </span>
            <div>
              <h1 className="text-[22px] font-black tracking-tight text-[var(--wk-text)]">Audience Segments</h1>
              <p className="text-[13px] text-[var(--wk-text-muted)]">
                Filter confirmed subscribers by briefing, artist, guide, source form, and interest strength.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadSegments}
            disabled={loading}
            className="wk-button wk-button-secondary wk-button-sm inline-flex items-center gap-2 disabled:opacity-50"
          >
            <i className={`ri-refresh-line ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => exportRows(rows)}
            disabled={rows.length === 0}
            className="wk-button wk-button-primary wk-button-sm inline-flex items-center gap-2 disabled:opacity-50"
          >
            <i className="ri-download-line" />
            Export CSV
          </button>
        </div>
      </div>

      <WkSurface className="p-4">
        <div className="mb-4 flex flex-col gap-1">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">Segment builder</p>
          <p className="text-[12px] text-[var(--wk-text-muted)]">{segmentLabel}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1">
            <span className="text-[11px] font-bold text-[var(--wk-text-muted)]">Subscriber status</span>
            <select value={subscriberStatus} onChange={(event) => setSubscriberStatus(event.target.value)} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)]">
              {SUBSCRIBER_STATUSES.map((status) => <option key={status} value={status}>{status || "Any subscriber status"}</option>)}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-bold text-[var(--wk-text-muted)]">Interest status</span>
            <select value={interestStatus} onChange={(event) => setInterestStatus(event.target.value)} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)]">
              {INTEREST_STATUSES.map((status) => <option key={status} value={status}>{status || "Any interest status"}</option>)}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-bold text-[var(--wk-text-muted)]">Briefing</span>
            <select value={briefingSlug} onChange={(event) => setBriefingSlug(event.target.value)} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)]">
              <option value="">{catalogLoading ? "Loading briefings..." : "Any briefing"}</option>
              {catalog.map((item) => <option key={item.slug} value={item.slug}>{item.title}</option>)}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-bold text-[var(--wk-text-muted)]">Entity type</span>
            <select value={entityType} onChange={(event) => setEntityType(event.target.value)} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)]">
              {ENTITY_TYPES.map((type) => <option key={type} value={type}>{type || "Any entity type"}</option>)}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-bold text-[var(--wk-text-muted)]">Entity slug</span>
            <input value={entitySlug} onChange={(event) => setEntitySlug(event.target.value)} placeholder="v-be, in-minor-keys..." className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)]" />
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-bold text-[var(--wk-text-muted)]">Source form</span>
            <input value={sourceForm} onChange={(event) => setSourceForm(event.target.value)} list="audience-source-forms" placeholder="artist_follow, guide_download..." className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)]" />
            <datalist id="audience-source-forms">
              {sourceFormOptions.map((option) => <option key={option} value={option} />)}
            </datalist>
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-bold text-[var(--wk-text-muted)]">Limit</span>
            <input type="number" min={1} max={1000} value={limit} onChange={(event) => setLimit(Math.max(1, Math.min(1000, Number(event.target.value) || 250)))} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)]" />
          </label>

          <div className="flex items-end">
            <button onClick={loadSegments} disabled={loading} className="wk-button wk-button-primary wk-button-sm w-full justify-center disabled:opacity-50">
              Apply filters
            </button>
          </div>
        </div>
      </WkSurface>

      <WkSurface className="border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]/40 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">Segment send</p>
            <h2 className="text-[18px] font-black tracking-tight text-[var(--wk-text)]">Send an unsent issue to this exact segment</h2>
            <p className="max-w-3xl text-[12px] text-[var(--wk-text-muted)]">
              Uses the current filters above. It only sends to confirmed subscribers with active interests who are also actively opted into the selected briefing. This does not hit every opt-in in the database.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 lg:w-[420px]">
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-[var(--wk-text-muted)]">Unsent issue</span>
              <select
                value={selectedIssueId}
                onChange={(event) => setSelectedIssueId(event.target.value)}
                disabled={!briefingSlug || issuesLoading || issueOptions.length === 0 || sending}
                className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] disabled:opacity-60"
              >
                <option value="">
                  {!briefingSlug ? "Choose a briefing first" : issuesLoading ? "Loading issues..." : "Select an unsent issue"}
                </option>
                {issueOptions.map((issue) => (
                  <option key={issue.id} value={issue.id}>
                    {issue.title} · {issue.iso_week}
                  </option>
                ))}
              </select>
            </label>

            <button
              onClick={handleSendSegment}
              disabled={!canSendSegment}
              className="wk-button wk-button-primary wk-button-sm inline-flex justify-center gap-2 disabled:opacity-50"
            >
              <i className={`ri-send-plane-line ${sending ? "animate-pulse" : ""}`} />
              {sending ? "Sending..." : `Send to ${sendTargetCount} subscriber${sendTargetCount === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {selectedIssue && (
            <p className="text-[11px] text-[var(--wk-text-muted)]">
              Selected issue: <span className="font-bold text-[var(--wk-text)]">{selectedIssue.title}</span>. Sending will mark this issue as sent.
            </p>
          )}
          {sendDisabledReason && <p className="text-[11px] font-semibold text-[var(--wk-text-muted)]">{sendDisabledReason}</p>}
          {sendMessage && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-700">{sendMessage}</p>}
          {sendError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">{sendError}</p>}
        </div>
      </WkSurface>

      {error && (
        <WkSurface className="border-[var(--wk-danger)]/30 bg-[var(--wk-danger-soft)] p-4">
          <p className="text-[13px] font-semibold text-[var(--wk-danger)]">{error}</p>
        </WkSurface>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Interests" value={summary?.total_interests ?? "—"} helper="Rows in this segment" />
        <StatCard label="Subscribers" value={summary?.distinct_subscribers ?? "—"} helper="Unique emails" />
        <StatCard label="Confirmed" value={summary?.confirmed_subscribers ?? "—"} helper="Ready to contact" />
        <StatCard label="Active interests" value={summary?.active_interests ?? "—"} helper="Usable interest rows" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <WkSurface className="p-4">
          <h2 className="mb-3 text-[13px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Top entities</h2>
          <div className="space-y-2">
            {(summary?.top_entities ?? []).slice(0, 8).map((item) => (
              <div key={`${item.entity_type}:${item.entity_slug}`} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-[var(--wk-text)]">{item.entity_name || item.entity_slug}</p>
                  <p className="text-[11px] text-[var(--wk-text-faint)]">{item.entity_type} · {item.entity_slug}</p>
                </div>
                <Pill>{item.count}</Pill>
              </div>
            ))}
            {!loading && (summary?.top_entities ?? []).length === 0 && <p className="text-[12px] text-[var(--wk-text-muted)]">No entity signals yet.</p>}
          </div>
        </WkSurface>

        <WkSurface className="p-4">
          <h2 className="mb-3 text-[13px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Source forms</h2>
          <div className="space-y-2">
            {(summary?.source_forms ?? []).slice(0, 8).map((item) => (
              <div key={item.source_form} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2">
                <p className="truncate text-[13px] font-bold text-[var(--wk-text)]">{item.source_form}</p>
                <Pill>{item.count}</Pill>
              </div>
            ))}
            {!loading && (summary?.source_forms ?? []).length === 0 && <p className="text-[12px] text-[var(--wk-text-muted)]">No source data yet.</p>}
          </div>
        </WkSurface>

        <WkSurface className="p-4">
          <h2 className="mb-3 text-[13px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">Briefing overlap</h2>
          <div className="space-y-2">
            {(summary?.per_briefing ?? []).slice(0, 8).map((item) => (
              <div key={item.slug} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-[var(--wk-text)]">{item.title}</p>
                  <p className="text-[11px] text-[var(--wk-text-faint)]">{item.slug}</p>
                </div>
                <Pill>{item.count}</Pill>
              </div>
            ))}
            {!loading && (summary?.per_briefing ?? []).length === 0 && <p className="text-[12px] text-[var(--wk-text-muted)]">No briefing overlap yet.</p>}
          </div>
        </WkSurface>
      </div>

      <WkSurface className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--wk-border)] px-4 py-3">
          <div>
            <h2 className="text-[15px] font-black text-[var(--wk-text)]">Audience rows</h2>
            <p className="text-[12px] text-[var(--wk-text-muted)]">This is the exact contactable segment behind the filters.</p>
          </div>
          {loading && <Pill>Loading...</Pill>}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead className="bg-[var(--wk-bg-subtle)] text-[10px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">
              <tr>
                <th className="px-4 py-3">Subscriber</th>
                <th className="px-4 py-3">Interest</th>
                <th className="px-4 py-3">Briefings</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Strength</th>
                <th className="px-4 py-3">Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--wk-border)]">
              {rows.map((row) => (
                <tr key={row.id} className="align-top hover:bg-[var(--wk-bg-subtle)]/50">
                  <td className="px-4 py-3">
                    <p className="font-bold text-[var(--wk-text)]">{row.email}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Pill>{row.subscriber_status}</Pill>
                      <Pill>{row.status}</Pill>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-[var(--wk-text)]">{row.entity_name || row.entity_slug}</p>
                    <p className="text-[var(--wk-text-faint)]">{row.entity_type} · {row.entity_slug}</p>
                    <p className="mt-1 text-[var(--wk-text-muted)]">{row.interest_kind}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-[260px] flex-wrap gap-1">
                      {row.briefings.length > 0 ? row.briefings.map((briefing) => <Pill key={briefing.slug}>{briefing.title}</Pill>) : <span className="text-[var(--wk-text-faint)]">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[var(--wk-text)]">{row.source_form}</p>
                    {row.source_page && <p className="mt-1 max-w-[260px] truncate text-[var(--wk-text-faint)]">{row.source_page}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-[var(--wk-bg-subtle)]">
                      <div className="h-full rounded-full bg-[var(--wk-brand)]" style={{ width: `${Math.max(2, Math.min(100, row.interest_strength))}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] font-bold text-[var(--wk-text-muted)]">{row.interest_strength}/100</p>
                  </td>
                  <td className="px-4 py-3 text-[var(--wk-text-muted)]">
                    <p>{formatDate(row.last_seen_at)}</p>
                    <p className="mt-1 text-[var(--wk-text-faint)]">First: {formatDate(row.first_seen_at)}</p>
                  </td>
                </tr>
              ))}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <p className="text-[14px] font-bold text-[var(--wk-text)]">No audience rows match this segment.</p>
                    <p className="mt-1 text-[12px] text-[var(--wk-text-muted)]">Try removing one filter or checking pending subscribers too.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </WkSurface>
    </div>
  );
}
