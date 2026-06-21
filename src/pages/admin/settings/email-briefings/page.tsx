import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { IssuePreviewPanel } from "./components/IssuePreviewPanel";
import {
  briefingService,
  type BriefingCatalogItem,
  type BriefingCuratedContent,
} from "@/services/briefingService";
import type { ContentPickerOutput } from "./components/ContentPicker";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const ContentPicker = lazy(() => import("./components/ContentPicker"));

type Tab = "catalog" | "subscribers" | "issues" | "editor" | "test" | "analytics";

interface IssueItem {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "generated" | "sent";
  iso_week: string;
  sent_count: number;
  sent_at: string | null;
  created_at: string;
  briefing_catalog?: { slug: string; title: string } | null;
  recipient_count?: number;
  opened_count?: number;
  clicked_count?: number;
  bounced_count?: number;
  html_body?: string;
  curated_content?: BriefingCuratedContent | null;
}

interface SubscriberItem {
  id: string;
  email: string;
  status: string;
  confirmed_at: string | null;
  created_at: string;
  briefings?: Array<{ slug: string; title: string }>;
  subscriber_status?: string;
}

interface BriefingAnalytics {
  live_counts: {
    total_subscribers: number; confirmed_subscribers: number; active_opt_ins: number;
    total_issues: number; sent_issues: number; total_recipients: number;
    total_opens: number; total_clicks: number; total_bounces: number;
  };
  event_counts: Record<string, number>;
  daily_timeline: Array<Record<string, number | string>>;
  source_attribution: Array<{ source: string; count: number }>;
  per_briefing: Array<{
    slug: string; title: string; is_active: boolean;
    subscribers: number; issues: number; recipients: number;
    opens: number; clicks: number; bounces: number;
    open_rate: number; click_rate: number;
  }>;
  days: number;
}

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "catalog", label: "Catalog", icon: "LayoutList" },
  { key: "subscribers", label: "Subscribers", icon: "Users" },
  { key: "issues", label: "Issues", icon: "Newspaper" },
  { key: "editor", label: "Issue Editor", icon: "PenLine" },
  { key: "test", label: "Test Send", icon: "Send" },
  { key: "analytics", label: "Analytics", icon: "BarChart3" },
];

const FUNNEL_COLORS = ["#D97706", "#059669", "#7C3AED", "#0891B2", "#DC2626"];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    confirmed: { bg: "bg-emerald-100", text: "text-emerald-800", label: "Confirmed" },
    pending: { bg: "bg-amber-100", text: "text-amber-800", label: "Pending" },
    unsubscribed: { bg: "bg-red-100", text: "text-red-800", label: "Unsubscribed" },
    active: { bg: "bg-emerald-100", text: "text-emerald-800", label: "Active" },
    draft: { bg: "bg-slate-100", text: "text-slate-700", label: "Draft" },
    sent: { bg: "bg-emerald-100", text: "text-emerald-800", label: "Sent" },
    generated: { bg: "bg-sky-100", text: "text-sky-800", label: "Generated" },
  };
  const s = map[status] ?? { bg: "bg-slate-100", text: "text-slate-700", label: status };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${s.bg} ${s.text}`}>{s.label}</span>;
}

function CadenceBadge({ item }: { item: BriefingCatalogItem }) {
  if (item.is_manual) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 whitespace-nowrap"><span className="flex h-3 w-3 items-center justify-center"><WkIcon name="Hand" size={10} /></span>Manual</span>;
  }
  if (item.send_every_days) {
    const label = item.send_every_days === 1 ? "Daily" : item.send_every_days === 7 ? "Weekly" : item.send_every_days === 14 ? "Biweekly" : item.send_every_days === 30 ? "Monthly" : `Every ${item.send_every_days}d`;
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 whitespace-nowrap"><span className="flex h-3 w-3 items-center justify-center"><WkIcon name="Clock" size={10} /></span>{label}</span>;
  }
  return <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 whitespace-nowrap">—</span>;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function EngagementBar({ opened, clicked, total }: { opened: number; clicked: number; total: number }) {
  if (total === 0) return null;
  const openPct = Math.round((opened / total) * 100);
  const clickPct = Math.round((clicked / total) * 100);
  return (
    <div className="flex items-center gap-1 text-[11px]">
      <span className="text-violet-700 font-semibold">{openPct}%</span>
      <span className="text-[var(--wk-text-muted)]">open</span>
      <span className="text-[var(--wk-border-2)] mx-0.5">·</span>
      <span className="text-emerald-700 font-semibold">{clickPct}%</span>
      <span className="text-[var(--wk-text-muted)]">click</span>
    </div>
  );
}

function CadenceEditor({ item, onSave, onClose }: { item: BriefingCatalogItem; onSave: (u: Partial<BriefingCatalogItem>) => Promise<void>; onClose: () => void }) {
  const [isManual, setIsManual] = useState(item.is_manual);
  const [everyDays, setEveryDays] = useState<number | "">(item.send_every_days ?? "");
  const [sendTime, setSendTime] = useState(item.send_time ?? "09:00");
  const [saving, setSaving] = useState(false);
  const presets = [{ label: "Daily", days: 1 }, { label: "Weekly", days: 7 }, { label: "Biweekly", days: 14 }, { label: "Monthly", days: 30 }];
  const handleSave = async () => {
    setSaving(true);
    try { await onSave({ is_manual: isManual, send_every_days: isManual ? null : (typeof everyDays === "number" ? everyDays : null), send_time: sendTime || null, cadence: isManual ? "on_demand" : (everyDays === 7 ? "weekly" : everyDays === 14 ? "biweekly" : everyDays === 30 ? "monthly" : "custom") }); onClose(); } finally { setSaving(false); }
  };
  return (
    <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 space-y-4">
      <div className="flex items-center justify-between"><h3 className="text-[13px] font-bold text-[var(--wk-text)]">Send Cadence — {item.title}</h3><button onClick={onClose} className="flex h-5 w-5 items-center justify-center text-[var(--wk-text-faint)] hover:text-[var(--wk-text)] cursor-pointer"><WkIcon name="X" size={14} /></button></div>
      <div className="flex items-center gap-3">
        <button onClick={() => setIsManual(false)} className={`flex-1 rounded-lg border px-3 py-2 text-[12px] font-semibold transition-all cursor-pointer ${!isManual ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" : "border-[var(--wk-border)] text-[var(--wk-text-muted)]"}`}><span className="flex items-center justify-center gap-1.5"><WkIcon name="Clock" size={13} /> Scheduled</span></button>
        <button onClick={() => setIsManual(true)} className={`flex-1 rounded-lg border px-3 py-2 text-[12px] font-semibold transition-all cursor-pointer ${isManual ? "border-amber-400 bg-amber-50 text-amber-700" : "border-[var(--wk-border)] text-[var(--wk-text-muted)]"}`}><span className="flex items-center justify-center gap-1.5"><WkIcon name="Hand" size={13} /> Manual</span></button>
      </div>
      {isManual ? (<p className="text-[12px] text-[var(--wk-text-muted)] bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">No automatic delivery — admin must manually trigger each issue.</p>) : (
        <div className="space-y-3">
          <div><label className="block text-[11px] font-semibold text-[var(--wk-text-muted)] mb-2">Quick presets</label><div className="flex gap-2 flex-wrap">{presets.map((p) => (<button key={p.days} onClick={() => setEveryDays(p.days)} className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${everyDays === p.days ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]" : "border-[var(--wk-border)] text-[var(--wk-text-muted)]"}`}>{p.label}</button>))}</div></div>
          <div className="flex items-center gap-2"><label className="text-[12px] font-semibold text-[var(--wk-text-muted)] whitespace-nowrap">Every</label><input type="number" min={1} max={365} value={everyDays} onChange={(e) => setEveryDays(e.target.value === "" ? "" : Math.max(1, Math.min(365, Number(e.target.value))))} placeholder="7" className="w-20 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] text-center focus:border-[var(--wk-brand)] focus:outline-none" /><span className="text-[12px] text-[var(--wk-text-muted)]">days</span></div>
          <div className="flex items-center gap-2"><label className="text-[12px] font-semibold text-[var(--wk-text-muted)] whitespace-nowrap">At (UTC)</label><input type="time" value={sendTime} onChange={(e) => setSendTime(e.target.value)} className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none" /></div>
        </div>
      )}
      <div className="flex items-center gap-2 pt-1">
        <button onClick={handleSave} disabled={saving || (!isManual && everyDays === "")} className="wk-button wk-button-primary wk-button-xs flex items-center gap-1.5 disabled:opacity-50">{saving ? <WkIcon name="Loader" size={12} className="animate-spin" /> : <WkIcon name="Check" size={12} />}{saving ? "Saving..." : "Save"}</button>
        <button onClick={onClose} className="wk-button wk-button-ghost wk-button-xs">Cancel</button>
      </div>
    </div>
  );
}

export default function AdminSettingsEmailBriefings() {
  const [tab, setTab] = useState<Tab>("catalog");

  // Catalog
  const [catalog, setCatalog] = useState<BriefingCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [editingCadenceId, setEditingCadenceId] = useState<string | null>(null);

  // Subscribers
  const [subscribers, setSubscribers] = useState<SubscriberItem[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [subsError, setSubsError] = useState<string | null>(null);
  const [subsFilter, setSubsFilter] = useState("");

  // Issues
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesError, setIssuesError] = useState<string | null>(null);
  const [sendingIssueId, setSendingIssueId] = useState<string | null>(null);
  const [deletingIssueId, setDeletingIssueId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<string | null>(null);

  // Editor
  const [editorBriefingSlug, setEditorBriefingSlug] = useState("");
  const [editorContent, setEditorContent] = useState<ContentPickerOutput | null>(null);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorPreviewing, setEditorPreviewing] = useState(false);
  const [editorResult, setEditorResult] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null);
  const [editingIssueTitle, setEditingIssueTitle] = useState<string | null>(null);

  // Preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  // Test
  const [testEmail, setTestEmail] = useState("");
  const [testBriefingSlug, setTestBriefingSlug] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Analytics
  const [analytics, setAnalytics] = useState<BriefingAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsDays, setAnalyticsDays] = useState(30);

  const [stats, setStats] = useState({ totalSubs: 0, confirmedSubs: 0, activeBriefings: 0, totalIssues: 0, totalSent: 0, totalOpens: 0, totalClicks: 0, totalBounces: 0 });

  // ── Loaders ──

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true); setCatalogError(null);
    try {
      const data = await briefingService.admin.listAllCatalog();
      setCatalog(data);
      setStats((s) => ({ ...s, activeBriefings: data.filter((b) => b.is_active).length }));
    } catch (e: any) { setCatalogError(e.message); } finally { setCatalogLoading(false); }
  }, []);

  const loadSubscribers = useCallback(async () => {
    setSubsLoading(true); setSubsError(null);
    try {
      const data = await briefingService.admin.listSubscribers(subsFilter ? { status: subsFilter } : { limit: 100 });
      setSubscribers(data);
      setStats((s) => ({ ...s, totalSubs: data.length, confirmedSubs: data.filter((s: SubscriberItem) => s.status === "confirmed" || s.subscriber_status === "confirmed").length }));
    } catch (e: any) { setSubsError(e.message); } finally { setSubsLoading(false); }
  }, [subsFilter]);

  const loadIssues = useCallback(async () => {
    setIssuesLoading(true); setIssuesError(null);
    try {
      const data = await briefingService.admin.listIssues({ limit: 50 });
      setIssues(data);
      const sent = data.filter((i: IssueItem) => i.status === "sent").length;
      const opens = data.reduce((s: number, i: IssueItem) => s + (i.opened_count ?? 0), 0);
      const clicks = data.reduce((s: number, i: IssueItem) => s + (i.clicked_count ?? 0), 0);
      const bounces = data.reduce((s: number, i: IssueItem) => s + (i.bounced_count ?? 0), 0);
      setStats((s) => ({ ...s, totalIssues: data.length, totalSent: sent, totalOpens: opens, totalClicks: clicks, totalBounces: bounces }));
    } catch (e: any) { setIssuesError(e.message); } finally { setIssuesLoading(false); }
  }, []);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true); setAnalyticsError(null);
    try { const data = await briefingService.admin.getBriefingAnalytics(analyticsDays); setAnalytics(data); }
    catch (e: any) { setAnalyticsError(e.message); } finally { setAnalyticsLoading(false); }
  }, [analyticsDays]);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);
  useEffect(() => {
    if (tab === "subscribers") loadSubscribers();
    if (tab === "issues") loadIssues();
    if (tab === "analytics") loadAnalytics();
  }, [tab, loadSubscribers, loadIssues, loadAnalytics]);

  // ── Handlers ──

  const handleToggleActive = async (item: BriefingCatalogItem) => {
    try { await briefingService.admin.updateCatalog(item.id, { is_active: !item.is_active }); setCatalog((prev) => prev.map((b) => b.id === item.id ? { ...b, is_active: !item.is_active } : b)); } catch (_e) { /* toggle failed silently */ }
  };

  const handleSaveCadence = async (item: BriefingCatalogItem, updates: Partial<BriefingCatalogItem>) => {
    await briefingService.admin.updateCatalog(item.id, updates);
    setCatalog((prev) => prev.map((b) => b.id === item.id ? { ...b, ...updates } : b));
  };

  const handlePreviewExistingIssue = (issue: IssueItem) => {
    const rawHtml = issue.html_body || "<p>No HTML body available.</p>";
    setPreviewHtml(rawHtml);
    setPreviewTitle(issue.title);
    setPreviewError(null);
    setPreviewLoading(false);
    setPreviewOpen(true);
  };

  const handleSendIssue = async (issueId: string) => {
    setSendingIssueId(issueId); setSendResult(null);
    try { const r = await briefingService.admin.sendIssue(issueId); setSendResult(r.message); loadIssues(); }
    catch (e: any) { setSendResult(`Error: ${e.message}`); } finally { setSendingIssueId(null); }
  };

  const handleDeleteIssue = async (issueId: string) => {
    setDeletingIssueId(issueId);
    try { await briefingService.admin.deleteIssue(issueId); setIssues((prev) => prev.filter((i) => i.id !== issueId)); setDeleteConfirmId(null); }
    catch (e: any) { setSendResult(`Delete failed: ${e.message}`); } finally { setDeletingIssueId(null); }
  };

  const handleSendTest = async () => {
    setTestSending(true); setTestResult(null); setTestError(null);
    try { const r = await briefingService.admin.sendTest(testEmail, testBriefingSlug || undefined); setTestResult(r.message); }
    catch (e: any) { setTestError(e.message); } finally { setTestSending(false); }
  };

  const handleEditIssue = async (issue: IssueItem) => {
    setEditorBriefingSlug(issue.briefing_catalog?.slug ?? "");
    setEditingIssueId(issue.id);
    setEditingIssueTitle(issue.title);
    setEditorContent(issue.curated_content ? {
      sections: issue.curated_content.sections ?? [],
      intro: issue.curated_content.intro,
      outro: issue.curated_content.outro,
    } : null);
    setEditorResult(null);
    setEditorError(null);
    setTab("editor");
  };

  const handleEditorPreview = async () => {
    if (!editorBriefingSlug || !editorContent || editorContent.sections.length === 0) {
      setEditorError("Select a briefing and add content before previewing.");
      return;
    }
    setEditorPreviewing(true);
    setPreviewError(null);
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const r = await briefingService.admin.previewContent(editorBriefingSlug, {
        sections: editorContent.sections,
        intro: editorContent.intro,
        outro: editorContent.outro,
      } as BriefingCuratedContent);
      setPreviewHtml(r.html_body);
      setPreviewTitle(r.title);
    } catch (e: any) {
      setPreviewError(e.message);
    } finally {
      setPreviewLoading(false);
      setEditorPreviewing(false);
    }
  };

  const handleEditorSave = async () => {
    if (!editorBriefingSlug) { setEditorError("Select a briefing first."); return; }
    if (!editorContent || editorContent.sections.length === 0) { setEditorError("Add at least one section with content."); return; }

    setEditorSaving(true);
    setEditorError(null);
    setEditorResult(null);
    try {
      const curated: BriefingCuratedContent = {
        sections: editorContent.sections,
        intro: editorContent.intro,
        outro: editorContent.outro,
      };

      if (editingIssueId) {
        await briefingService.admin.updateIssueContent(editingIssueId, curated);
        setEditorResult(`Issue "${editingIssueTitle}" updated with ${editorContent.sections.length} section(s).`);
        loadIssues();
      } else {
        const result = await briefingService.admin.generateIssueFromContent(editorBriefingSlug, curated);
        const total = editorContent.sections.reduce((s, sec) => s + sec.items.length, 0);
        setEditorResult(`Issue "${result?.issue?.title}" created — ${editorContent.sections.length} section(s), ${total} item(s).`);
        setEditingIssueId(result?.issue?.id ?? null);
        setEditingIssueTitle(result?.issue?.title ?? null);
        loadIssues();
      }
    } catch (e: any) {
      setEditorError(e.message);
    } finally {
      setEditorSaving(false);
    }
  };

  const handleNewIssue = () => {
    setEditingIssueId(null);
    setEditingIssueTitle(null);
    setEditorBriefingSlug(catalog.find((b) => b.is_active)?.slug ?? "");
    setEditorContent(null);
    setEditorResult(null);
    setEditorError(null);
    setTab("editor");
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="flex h-5 w-5 items-center justify-center"><WkIcon name="Mail" size={20} className="text-[var(--wk-brand)]" /></span>
          <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">Email &amp; Briefings</h1>
        </div>
        <p className="text-[13px] text-[var(--wk-text-muted)]">Curate and publish editorial briefings to your subscribers. Search content from the site, build sections, preview and send.</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {[
          { label: "Subscribers", value: stats.totalSubs }, { label: "Confirmed", value: stats.confirmedSubs },
          { label: "Briefings", value: stats.activeBriefings }, { label: "Issues", value: stats.totalIssues },
          { label: "Sent", value: stats.totalSent }, { label: "Opens", value: stats.totalOpens, color: "text-violet-700" },
          { label: "Clicks", value: stats.totalClicks, color: "text-emerald-700" }, { label: "Bounces", value: stats.totalBounces, color: "text-red-600" },
        ].map((kpi) => (
          <WkSurface key={kpi.label} className="p-3">
            <div className={`text-[11px] font-semibold uppercase tracking-wide ${(kpi as any).color || "text-[var(--wk-text-muted)]"}`}>{kpi.label}</div>
            <div className={`mt-0.5 text-[22px] font-black tracking-tight ${(kpi as any).color || "text-[var(--wk-text)]"}`}>{kpi.value}</div>
          </WkSurface>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0.5 rounded-xl bg-[var(--wk-bg)] p-1 border border-[var(--wk-border)] overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-[13px] font-semibold transition-all cursor-pointer flex-shrink-0 ${tab === t.key ? "bg-[var(--wk-surface)] text-[var(--wk-text)] shadow-sm" : "text-[var(--wk-text-muted)] hover:text-[var(--wk-text-soft)]"}`}>
            <span className="flex h-4 w-4 items-center justify-center shrink-0"><WkIcon name={t.icon as any} size={14} /></span>
            <span>{t.label}</span>
            {t.key === "editor" && editingIssueId && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 text-white text-[9px] font-bold px-1">edit</span>
            )}
          </button>
        ))}
      </div>

      {/* ── CATALOG TAB ── */}
      {tab === "catalog" && (
        <div className="space-y-4">
          {catalogLoading && <WkSurface className="p-8 flex items-center justify-center gap-3 text-[13px] text-[var(--wk-text-muted)]"><span className="flex h-4 w-4 items-center justify-center"><WkIcon name="Loader" size={16} className="animate-spin" /></span>Loading...</WkSurface>}
          {catalogError && <WkSurface className="p-6 text-center"><p className="text-[13px] text-red-600 mb-3">{catalogError}</p><button onClick={loadCatalog} className="wk-button wk-button-primary wk-button-sm">Retry</button></WkSurface>}
          {!catalogLoading && !catalogError && catalog.length === 0 && <WkSurface className="p-8 text-center text-[13px] text-[var(--wk-text-muted)]">No briefings in the catalog yet.</WkSurface>}
          {!catalogLoading && !catalogError && catalog.length > 0 && (
            <WkSurface className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead><tr className="border-b border-[var(--wk-border)]">
                    <th className="px-4 py-3 text-[11px] font-semibold text-[var(--wk-text-muted)] uppercase tracking-wide">Briefing</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-[var(--wk-text-muted)] uppercase tracking-wide hidden sm:table-cell">Schedule</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-[var(--wk-text-muted)] uppercase tracking-wide hidden md:table-cell">Send Time (UTC)</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-[var(--wk-text-muted)] uppercase tracking-wide text-center">Active</th>
                  </tr></thead>
                  <tbody className="divide-y divide-[var(--wk-border)]">
                    {catalog.map((item) => (
                      <>
                        <tr key={item.id} className="hover:bg-[var(--wk-bg)]/50 transition-colors">
                          <td className="px-4 py-3"><div className="font-semibold text-[var(--wk-text)]">{item.title}</div><div className="text-[11px] text-[var(--wk-text-muted)] mt-0.5 line-clamp-1">{item.description}</div></td>
                          <td className="px-4 py-3 hidden sm:table-cell"><div className="flex items-center gap-2"><CadenceBadge item={item} /><button onClick={() => setEditingCadenceId(editingCadenceId === item.id ? null : item.id)} className="flex h-5 w-5 items-center justify-center text-[var(--wk-text-faint)] hover:text-[var(--wk-brand)] transition-colors cursor-pointer rounded"><WkIcon name="Pencil" size={12} /></button></div></td>
                          <td className="px-4 py-3 hidden md:table-cell"><span className="text-[12px] text-[var(--wk-text-soft)]">{item.is_manual ? "—" : (item.send_time ?? "09:00")}</span></td>
                          <td className="px-4 py-3 text-center"><button onClick={() => handleToggleActive(item)} className={`relative inline-flex h-6 w-11 rounded-full transition-colors cursor-pointer ${item.is_active ? "bg-[var(--wk-brand)]" : "bg-[var(--wk-border-2)]"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${item.is_active ? "translate-x-[22px]" : "translate-x-0.5"}`} /></button></td>
                        </tr>
                        {editingCadenceId === item.id && (
                          <tr key={`${item.id}-editor`}><td colSpan={4} className="px-4 py-3 bg-[var(--wk-bg)]/50"><CadenceEditor item={item} onSave={(updates) => handleSaveCadence(item, updates)} onClose={() => setEditingCadenceId(null)} /></td></tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </WkSurface>
          )}
        </div>
      )}

      {/* ── SUBSCRIBERS TAB ── */}
      {tab === "subscribers" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select value={subsFilter} onChange={(e) => setSubsFilter(e.target.value)} className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]">
              <option value="">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="unsubscribed">Unsubscribed</option>
            </select>
            <span className="text-[11px] text-[var(--wk-text-muted)]">{subscribers.length} subscriber{subscribers.length !== 1 ? "s" : ""}</span>
          </div>
          {subsLoading && <WkSurface className="p-8 flex items-center justify-center gap-3 text-[13px] text-[var(--wk-text-muted)]"><span className="flex h-4 w-4 items-center justify-center"><WkIcon name="Loader" size={16} className="animate-spin" /></span>Loading...</WkSurface>}
          {subsError && <WkSurface className="p-6 text-center"><p className="text-[13px] text-red-600 mb-3">{subsError}</p><button onClick={loadSubscribers} className="wk-button wk-button-primary wk-button-sm">Retry</button></WkSurface>}
          {!subsLoading && !subsError && subscribers.length === 0 && <WkSurface className="p-8 text-center text-[13px] text-[var(--wk-text-muted)]">No subscribers yet.</WkSurface>}
          {!subsLoading && !subsError && subscribers.length > 0 && (
            <WkSurface className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead><tr className="border-b border-[var(--wk-border)]">
                    <th className="px-4 py-3 text-[11px] font-semibold text-[var(--wk-text-muted)] uppercase tracking-wide">Email</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-[var(--wk-text-muted)] uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-[var(--wk-text-muted)] uppercase tracking-wide hidden sm:table-cell">Briefings</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-[var(--wk-text-muted)] uppercase tracking-wide hidden md:table-cell">Confirmed</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-[var(--wk-text-muted)] uppercase tracking-wide hidden lg:table-cell">Joined</th>
                  </tr></thead>
                  <tbody className="divide-y divide-[var(--wk-border)]">
                    {subscribers.map((sub) => (
                      <tr key={sub.id} className="hover:bg-[var(--wk-bg)]/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-[var(--wk-text)]">{sub.email}</td>
                        <td className="px-4 py-3"><StatusBadge status={sub.subscriber_status || sub.status} /></td>
                        <td className="px-4 py-3 hidden sm:table-cell"><span className="text-[12px] text-[var(--wk-text-soft)]">{sub.briefings?.length ? `${sub.briefings.length} briefing${sub.briefings.length !== 1 ? "s" : ""}` : "—"}</span></td>
                        <td className="px-4 py-3 hidden md:table-cell"><span className="text-[12px] text-[var(--wk-text-soft)]">{formatDate(sub.confirmed_at)}</span></td>
                        <td className="px-4 py-3 hidden lg:table-cell"><span className="text-[12px] text-[var(--wk-text-soft)]">{formatDate(sub.created_at)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </WkSurface>
          )}
        </div>
      )}

      {/* ── ISSUES TAB ── */}
      {tab === "issues" && (
        <div className="space-y-4">
          {/* Action bar */}
          <div className="flex items-center justify-between">
            <button onClick={handleNewIssue} className="wk-button wk-button-primary wk-button-sm flex items-center gap-2">
              <span className="flex h-3.5 w-3.5 items-center justify-center"><WkIcon name="PenLine" size={14} /></span>
              Create New Issue
            </button>
            {sendResult && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
                <span className="flex h-3.5 w-3.5 items-center justify-center"><WkIcon name="Check" size={14} /></span>
                {sendResult}
                <button onClick={() => setSendResult(null)} className="ml-auto text-emerald-400"><WkIcon name="X" size={14} /></button>
              </div>
            )}
          </div>

          {issuesLoading && <WkSurface className="p-8 flex items-center justify-center gap-3 text-[13px] text-[var(--wk-text-muted)]"><span className="flex h-4 w-4 items-center justify-center"><WkIcon name="Loader" size={16} className="animate-spin" /></span>Loading issues...</WkSurface>}
          {issuesError && <WkSurface className="p-6 text-center"><p className="text-[13px] text-red-600 mb-3">{issuesError}</p><button onClick={loadIssues} className="wk-button wk-button-primary wk-button-sm">Retry</button></WkSurface>}
          {!issuesLoading && !issuesError && issues.length === 0 && (
            <WkSurface className="p-10 text-center">
              <span className="flex h-10 w-10 items-center justify-center mx-auto mb-3 rounded-full bg-[var(--wk-bg-subtle)]"><WkIcon name="PenLine" size={20} className="text-[var(--wk-text-faint)]" /></span>
              <p className="text-[14px] font-semibold text-[var(--wk-text)] mb-1">No issues yet</p>
              <p className="text-[13px] text-[var(--wk-text-muted)] mb-4">Use the Issue Editor to curate and generate your first email issue.</p>
              <button onClick={handleNewIssue} className="wk-button wk-button-primary wk-button-sm">Create first issue</button>
            </WkSurface>
          )}
          {!issuesLoading && !issuesError && issues.length > 0 && (
            <WkSurface className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead><tr className="border-b border-[var(--wk-border)]">
                    <th className="px-4 py-3 text-[11px] font-semibold text-[var(--wk-text-muted)] uppercase tracking-wide">Issue</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-[var(--wk-text-muted)] uppercase tracking-wide hidden sm:table-cell">Briefing</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-[var(--wk-text-muted)] uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-[var(--wk-text-muted)] uppercase tracking-wide hidden md:table-cell">Sent To</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-[var(--wk-text-muted)] uppercase tracking-wide hidden lg:table-cell">Engagement</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-[var(--wk-text-muted)] uppercase tracking-wide hidden xl:table-cell">Created</th>
                    <th className="px-4 py-3 text-[11px] font-semibold text-[var(--wk-text-muted)] uppercase tracking-wide text-right">Actions</th>
                  </tr></thead>
                  <tbody className="divide-y divide-[var(--wk-border)]">
                    {issues.map((issue) => (
                      <>
                        <tr key={issue.id} className="hover:bg-[var(--wk-bg)]/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-[var(--wk-text)]">{issue.title}</div>
                            <div className="text-[11px] text-[var(--wk-text-muted)]">{issue.iso_week}</div>
                            {issue.curated_content?.sections && <div className="text-[10px] text-[var(--wk-text-faint)] mt-0.5">{issue.curated_content.sections.length} section(s) · {issue.curated_content.sections.reduce((s, sec) => s + (sec.items?.length ?? 0), 0)} items</div>}
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell"><span className="text-[12px] text-[var(--wk-text-soft)]">{issue.briefing_catalog?.title ?? "—"}</span></td>
                          <td className="px-4 py-3"><StatusBadge status={issue.status} /></td>
                          <td className="px-4 py-3 hidden md:table-cell"><span className="text-[12px] text-[var(--wk-text-soft)]">{issue.recipient_count != null ? `${issue.recipient_count} recipients` : issue.status === "sent" ? `${issue.sent_count ?? 0} recipients` : "—"}</span></td>
                          <td className="px-4 py-3 hidden lg:table-cell"><EngagementBar opened={issue.opened_count ?? 0} clicked={issue.clicked_count ?? 0} total={issue.recipient_count ?? issue.sent_count ?? 0} /></td>
                          <td className="px-4 py-3 hidden xl:table-cell"><span className="text-[12px] text-[var(--wk-text-soft)]">{formatDate(issue.created_at)}</span></td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {issue.status !== "sent" && (
                                <button onClick={() => handleEditIssue(issue)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--wk-border)] text-[var(--wk-text-faint)] hover:text-amber-600 hover:border-amber-300 transition-all cursor-pointer" title="Edit issue content">
                                  <span className="flex h-3.5 w-3.5 items-center justify-center"><WkIcon name="PenLine" size={14} /></span>
                                </button>
                              )}
                              <button onClick={() => handlePreviewExistingIssue(issue)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--wk-border)] text-[var(--wk-text-faint)] hover:text-violet-600 hover:border-violet-300 transition-all cursor-pointer" title="Preview HTML">
                                <span className="flex h-3.5 w-3.5 items-center justify-center"><WkIcon name="Eye" size={14} /></span>
                              </button>
                              {issue.status !== "sent" && (
                                <button onClick={() => handleSendIssue(issue.id)} disabled={sendingIssueId === issue.id} className="wk-button wk-button-primary wk-button-xs flex items-center gap-1.5 whitespace-nowrap">
                                  {sendingIssueId === issue.id ? <span className="flex h-3 w-3 items-center justify-center"><WkIcon name="Loader" size={12} className="animate-spin" /></span> : <span className="flex h-3 w-3 items-center justify-center"><WkIcon name="Send" size={12} /></span>}
                                  {sendingIssueId === issue.id ? "Sending..." : "Send"}
                                </button>
                              )}
                              {issue.status === "sent" && <span className="text-[12px] text-[var(--wk-text-muted)]">{issue.sent_at ? formatDate(issue.sent_at) : "Sent"}</span>}
                              {issue.status !== "sent" && (
                                <button onClick={() => setDeleteConfirmId(issue.id)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--wk-border)] text-[var(--wk-text-faint)] hover:text-red-600 hover:border-red-300 transition-all cursor-pointer">
                                  <span className="flex h-3.5 w-3.5 items-center justify-center"><WkIcon name="Trash2" size={14} /></span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {deleteConfirmId === issue.id && (
                          <tr key={`${issue.id}-confirm`}>
                            <td colSpan={7} className="px-4 py-3 bg-red-50 border-t border-red-100">
                              <div className="flex items-center gap-3">
                                <span className="flex h-4 w-4 items-center justify-center shrink-0 text-red-500"><WkIcon name="AlertTriangle" size={14} /></span>
                                <span className="text-[12px] text-red-700 font-semibold">Delete &ldquo;{issue.title}&rdquo;? This cannot be undone.</span>
                                <div className="flex items-center gap-2 ml-auto">
                                  <button onClick={() => handleDeleteIssue(issue.id)} disabled={deletingIssueId === issue.id} className="flex items-center gap-1 rounded-lg bg-red-600 text-white px-3 py-1.5 text-[12px] font-semibold hover:bg-red-700 cursor-pointer disabled:opacity-60 whitespace-nowrap">
                                    {deletingIssueId === issue.id ? <WkIcon name="Loader" size={12} className="animate-spin" /> : <WkIcon name="Trash2" size={12} />}
                                    {deletingIssueId === issue.id ? "Deleting..." : "Delete"}
                                  </button>
                                  <button onClick={() => setDeleteConfirmId(null)} className="rounded-lg border border-[var(--wk-border)] px-3 py-1.5 text-[12px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] cursor-pointer whitespace-nowrap">Cancel</button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </WkSurface>
          )}
        </div>
      )}

      {/* ── ISSUE EDITOR TAB ── */}
      {tab === "editor" && (
        <div className="space-y-4">
          {/* Editor toolbar */}
          <WkSurface className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-3">
              <div>
                <div className="text-[13px] font-bold text-[var(--wk-text)] mb-0.5">
                  {editingIssueId ? `Editing: ${editingIssueTitle ?? "Issue"}` : "New Issue"}
                </div>
                <div className="text-[11px] text-[var(--wk-text-muted)]">
                  {editingIssueId ? "Modify the content selection and save to update the issue." : "Search and select content from the site, arrange into sections, then save as a draft issue."}
                </div>
              </div>
              <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
                {editingIssueId && (
                  <button
                    onClick={() => { setEditingIssueId(null); setEditingIssueTitle(null); setEditorContent(null); setEditorResult(null); setEditorError(null); }}
                    className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap"
                  >
                    New Issue
                  </button>
                )}
                <button
                  onClick={handleEditorPreview}
                  disabled={editorPreviewing || !editorContent || editorContent.sections.length === 0}
                  className="wk-button wk-button-ghost wk-button-sm flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                >
                  {editorPreviewing ? <WkIcon name="Loader" size={13} className="animate-spin" /> : <WkIcon name="Eye" size={13} />}
                  Preview
                </button>
                <button
                  onClick={handleEditorSave}
                  disabled={editorSaving || !editorContent || editorContent.sections.length === 0 || !editorBriefingSlug}
                  className="wk-button wk-button-primary wk-button-sm flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                >
                  {editorSaving ? <WkIcon name="Loader" size={13} className="animate-spin" /> : <WkIcon name="Save" size={13} />}
                  {editorSaving ? "Saving..." : (editingIssueId ? "Update Issue" : "Save as Draft")}
                </button>
              </div>
            </div>

            {/* Briefing selector */}
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-[12px] font-semibold text-[var(--wk-text-muted)] whitespace-nowrap">For briefing:</label>
              <select
                value={editorBriefingSlug}
                onChange={(e) => setEditorBriefingSlug(e.target.value)}
                className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none"
              >
                <option value="">Select a briefing...</option>
                {catalog.map((b) => (
                  <option key={b.id} value={b.slug}>{b.title}{!b.is_active ? " (inactive)" : ""}</option>
                ))}
              </select>
            </div>

            {editorError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                <span className="flex h-3.5 w-3.5 items-center justify-center shrink-0"><WkIcon name="AlertTriangle" size={14} /></span>
                {editorError}
                <button onClick={() => setEditorError(null)} className="ml-auto text-red-400"><WkIcon name="X" size={14} /></button>
              </div>
            )}
            {editorResult && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
                <span className="flex h-3.5 w-3.5 items-center justify-center shrink-0"><WkIcon name="Check" size={14} /></span>
                {editorResult}
                <div className="flex items-center gap-2 ml-auto">
                  <button onClick={() => setTab("issues")} className="text-emerald-600 font-semibold hover:underline whitespace-nowrap">View in Issues →</button>
                  <button onClick={() => setEditorResult(null)} className="text-emerald-400"><WkIcon name="X" size={14} /></button>
                </div>
              </div>
            )}
          </WkSurface>

          {/* Content picker */}
          <WkSurface className="p-4">
            <Suspense fallback={<div className="flex items-center justify-center py-16 gap-3 text-[13px] text-[var(--wk-text-muted)]"><span className="flex h-4 w-4 items-center justify-center"><WkIcon name="Loader" size={16} className="animate-spin" /></span>Loading editor...</div>}>
              <ContentPicker
                initialContent={editorContent}
                onChange={(c) => setEditorContent(c)}
              />
            </Suspense>
          </WkSurface>
        </div>
      )}

      {/* ── TEST SEND TAB ── */}
      {tab === "test" && (
        <WkSurface className="p-5 space-y-4">
          <div><h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-1">Send a test email</h2><p className="text-[12px] text-[var(--wk-text-muted)]">Preview how your briefing will look with real content and your current identity settings.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Recipient Email</label><input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]" /></div>
            <div><label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Briefing (optional)</label><select value={testBriefingSlug} onChange={(e) => setTestBriefingSlug(e.target.value)} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"><option value="">Generic test email</option>{catalog.filter((b) => b.is_active).map((b) => (<option key={b.id} value={b.slug}>{b.title}</option>))}</select></div>
          </div>
          <button onClick={handleSendTest} disabled={testSending || !testEmail} className="wk-button wk-button-primary wk-button-sm flex items-center gap-2">
            {testSending ? <span className="flex h-3.5 w-3.5 items-center justify-center"><WkIcon name="Loader" size={14} className="animate-spin" /></span> : <span className="flex h-3.5 w-3.5 items-center justify-center"><WkIcon name="Send" size={14} /></span>}
            {testSending ? "Sending..." : "Send Test"}
          </button>
          {testResult && <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-700"><span className="flex h-4 w-4 items-center justify-center shrink-0 mt-0.5"><WkIcon name="Check" size={14} /></span><span>{testResult}</span><button onClick={() => setTestResult(null)} className="ml-auto"><WkIcon name="X" size={14} /></button></div>}
          {testError && <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700"><span className="flex h-4 w-4 items-center justify-center shrink-0 mt-0.5"><WkIcon name="AlertTriangle" size={14} /></span><span>{testError}</span><button onClick={() => setTestError(null)} className="ml-auto"><WkIcon name="X" size={14} /></button></div>}
        </WkSurface>
      )}

      {/* ── ANALYTICS TAB ── */}
      {tab === "analytics" && (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            {[7, 30, 90, 365].map((d) => (
              <button key={d} onClick={() => setAnalyticsDays(d)} className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${analyticsDays === d ? "bg-[var(--wk-brand)] text-white" : "bg-[var(--wk-bg)] text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"}`}>{d}d</button>
            ))}
          </div>
          {analyticsLoading && <WkSurface className="p-12 flex items-center justify-center gap-3 text-[13px] text-[var(--wk-text-muted)]"><span className="flex h-4 w-4 items-center justify-center"><WkIcon name="Loader" size={16} className="animate-spin" /></span>Querying analytics...</WkSurface>}
          {analyticsError && <WkSurface className="p-6 text-center"><p className="text-[13px] text-red-600 mb-3">{analyticsError}</p><button onClick={loadAnalytics} className="wk-button wk-button-primary wk-button-sm">Retry</button></WkSurface>}
          {!analyticsLoading && !analyticsError && !analytics && <WkSurface className="p-10 text-center text-[13px] text-[var(--wk-text-muted)]">No analytics data available yet.</WkSurface>}
          {!analyticsLoading && !analyticsError && analytics && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                {[
                  { label: "Live Subs", value: analytics.live_counts.total_subscribers },
                  { label: "Confirmed", value: analytics.live_counts.confirmed_subscribers },
                  { label: "Total Sent", value: analytics.live_counts.total_recipients.toLocaleString() },
                  { label: "Opens", value: analytics.live_counts.total_opens.toLocaleString(), color: "text-violet-700" },
                  { label: "Clicks", value: analytics.live_counts.total_clicks.toLocaleString(), color: "text-emerald-700" },
                  { label: "Bounces", value: analytics.live_counts.total_bounces.toLocaleString(), color: "text-red-600" },
                  { label: "Open Rate", value: analytics.live_counts.total_recipients > 0 ? `${Math.round((analytics.live_counts.total_opens / analytics.live_counts.total_recipients) * 100)}%` : "—" },
                  { label: "Click Rate", value: analytics.live_counts.total_recipients > 0 ? `${Math.round((analytics.live_counts.total_clicks / analytics.live_counts.total_recipients) * 100)}%` : "—" },
                ].map((kpi) => (
                  <WkSurface key={kpi.label} className="p-3">
                    <div className={`text-[11px] font-semibold uppercase tracking-wide ${(kpi as any).color || "text-[var(--wk-text-muted)]"}`}>{kpi.label}</div>
                    <div className={`mt-0.5 text-[20px] font-black tracking-tight ${(kpi as any).color || "text-[var(--wk-text)]"}`}>{kpi.value}</div>
                  </WkSurface>
                ))}
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <WkSurface className="p-5">
                  <div className="mb-4 flex items-center gap-2"><WkIcon name="GitBranch" size={16} className="text-[var(--wk-brand)]" /><h2 className="text-[14px] font-bold text-[var(--wk-text)]">Customer Journey Funnel</h2></div>
                  {(() => {
                    const funnelSteps = [
                      { step: "Subscribed", count: analytics.event_counts.briefing_subscribe || 0 },
                      { step: "Confirmed", count: analytics.event_counts.briefing_confirm_success || 0 },
                      { step: "Emails Delivered", count: analytics.event_counts.briefing_email_delivered || 0 },
                      { step: "Opened", count: analytics.event_counts.briefing_email_opened || 0 },
                      { step: "Clicked", count: analytics.event_counts.briefing_email_clicked || 0 },
                    ];
                    const maxVal = Math.max(...funnelSteps.map((s) => s.count), 1);
                    return (
                      <div className="space-y-2">
                        {funnelSteps.map((step, i) => {
                          const pct = Math.round((step.count / maxVal) * 100);
                          const prevCount = i > 0 ? funnelSteps[i - 1].count : step.count;
                          const dropPct = prevCount > 0 ? Math.round(((prevCount - step.count) / prevCount) * 100) : 0;
                          return (
                            <div key={step.step} className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: FUNNEL_COLORS[i] }}>{i + 1}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1"><span className="text-[12px] font-semibold text-[var(--wk-text)]">{step.step}</span><span className="text-[12px] font-bold text-[var(--wk-text)]">{step.count.toLocaleString()}</span></div>
                                <div className="h-2 rounded-full bg-[var(--wk-bg-subtle)] overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: FUNNEL_COLORS[i] }} /></div>
                                {i > 0 && <div className="mt-0.5 text-[10px] text-[var(--wk-text-faint)]">{dropPct}% from &ldquo;{funnelSteps[i - 1].step}&rdquo;</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </WkSurface>

                <WkSurface className="p-5">
                  <div className="mb-4 flex items-center gap-2"><WkIcon name="TrendingUp" size={16} className="text-[var(--wk-brand)]" /><h2 className="text-[14px] font-bold text-[var(--wk-text)]">Daily Engagement</h2></div>
                  {analytics.daily_timeline.length === 0 ? (
                    <div className="py-12 text-center text-[12px] text-[var(--wk-text-muted)]">No engagement data yet.</div>
                  ) : (
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analytics.daily_timeline} margin={{ top: 4, right: 4, left: -12, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--wk-border)" strokeOpacity={0.4} />
                          <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--wk-text-muted)" }} tickFormatter={(v: string) => { const d = new Date(v); return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }} interval="preserveStartEnd" />
                          <YAxis tick={{ fontSize: 9, fill: "var(--wk-text-muted)" }} allowDecimals={false} />
                          <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--wk-border)", background: "var(--wk-surface)", fontSize: 11 }} />
                          <Area type="monotone" dataKey="briefing_subscribe" name="Subscribes" stackId="1" stroke="#D97706" fill="#D97706" fillOpacity={0.15} strokeWidth={1.5} />
                          <Area type="monotone" dataKey="briefing_confirm_success" name="Confirms" stackId="1" stroke="#059669" fill="#059669" fillOpacity={0.15} strokeWidth={1.5} />
                          <Area type="monotone" dataKey="briefing_email_opened" name="Opens" stackId="2" stroke="#7C3AED" fill="#7C3AED" fillOpacity={0.12} strokeWidth={1.5} />
                          <Area type="monotone" dataKey="briefing_email_clicked" name="Clicks" stackId="2" stroke="#0891B2" fill="#0891B2" fillOpacity={0.12} strokeWidth={1.5} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </WkSurface>

                <WkSurface className="p-5">
                  <div className="mb-4 flex items-center gap-2"><WkIcon name="MapPin" size={16} className="text-[var(--wk-brand)]" /><h2 className="text-[14px] font-bold text-[var(--wk-text)]">Subscription Sources</h2></div>
                  {analytics.source_attribution.length === 0 ? (
                    <div className="py-10 text-center text-[12px] text-[var(--wk-text-muted)]">No source data yet.</div>
                  ) : (
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.source_attribution.slice(0, 8)} layout="vertical" margin={{ top: 4, right: 4, left: 60, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--wk-border)" strokeOpacity={0.4} horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10, fill: "var(--wk-text-muted)" }} allowDecimals={false} />
                          <YAxis type="category" dataKey="source" tick={{ fontSize: 10, fill: "var(--wk-text-muted)" }} width={60} />
                          <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--wk-border)", background: "var(--wk-surface)", fontSize: 11 }} />
                          <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#D97706" name="Signups" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </WkSurface>

                <WkSurface className="p-5">
                  <div className="mb-4 flex items-center gap-2"><WkIcon name="Layers" size={16} className="text-[var(--wk-brand)]" /><h2 className="text-[14px] font-bold text-[var(--wk-text)]">Per-Briefing Engagement</h2></div>
                  <div className="overflow-x-auto max-h-[240px] overflow-y-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead><tr className="border-b border-[var(--wk-border)] sticky top-0 bg-[var(--wk-surface)]"><th className="pb-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">Briefing</th><th className="pb-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-faint)] text-right">Subs</th><th className="pb-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-faint)] text-right">Sent</th><th className="pb-2 text-[10px] font-black uppercase tracking-[0.12em] text-violet-700 text-right">Open%</th><th className="pb-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 text-right">Click%</th></tr></thead>
                      <tbody className="divide-y divide-[var(--wk-border)]">
                        {analytics.per_briefing.map((b) => (
                          <tr key={b.slug} className={!b.is_active ? "opacity-50" : ""}>
                            <td className="py-2"><span className="font-semibold text-[var(--wk-text)]">{b.title}</span>{!b.is_active && <span className="ml-1.5 text-[9px] text-[var(--wk-text-faint)]">(inactive)</span>}</td>
                            <td className="py-2 text-right font-bold text-[var(--wk-text)]">{b.subscribers}</td>
                            <td className="py-2 text-right font-bold text-[var(--wk-text)]">{b.recipients.toLocaleString()}</td>
                            <td className="py-2 text-right font-bold text-violet-700">{b.open_rate}%</td>
                            <td className="py-2 text-right font-bold text-emerald-700">{b.click_rate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </WkSurface>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── PREVIEW PANEL (fullscreen) ── */}
      <IssuePreviewPanel
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        html={previewHtml}
        title={previewTitle || "Issue Preview"}
        loading={previewLoading}
        error={previewError}
      />
    </div>
  );
}