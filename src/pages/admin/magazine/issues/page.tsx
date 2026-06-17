import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ISSUE_TYPES,
  magazineIssueProduction,
  type IssueStatus,
  type IssueWithDetails,
  type MagazineIssue,
} from "@/services/magazineIssueProduction";
import { buildAdminPreviewIssueExperience } from "@/services/magazineIssueEngine/adminPreview";

function StatusBadge({ status }: { status: IssueStatus }) {
  const colors: Record<IssueStatus, string> = {
    draft: "bg-gray-100 text-gray-700 border-gray-300",
    generated: "bg-blue-50 text-blue-700 border-blue-300",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-300",
    published: "bg-green-100 text-green-800 border-green-400",
    locked: "bg-purple-50 text-purple-700 border-purple-300",
    archived: "bg-amber-50 text-amber-700 border-amber-300",
    failed_generation: "bg-red-50 text-red-700 border-red-300",
  };

  return (
    <span className={`inline-block rounded-full border px-3 py-0.5 text-xs font-bold uppercase tracking-wider ${colors[status] || colors.draft}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function AdminQualityPanel({ issue }: { issue: IssueWithDetails }) {
  const experience = buildAdminPreviewIssueExperience(issue);
  const scoring = experience.adminNotes.scoring.slice(0, 5);

  return (
    <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">Magazine Issue Engine</p>
          <h3 className="mt-1 text-lg font-black">Admin quality note</h3>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--wk-text-muted)]">{experience.adminQualityNote}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-[var(--wk-border)] px-3 py-1 text-xs font-bold">{experience.archetypeLabel}</span>
          <span className="rounded-full border border-[var(--wk-border)] px-3 py-1 text-xs font-bold">{experience.interactionPattern}</span>
          <span className="rounded-full border border-[var(--wk-brand)] bg-[var(--wk-brand)]/10 px-3 py-1 text-xs font-bold text-[var(--wk-brand)]">{experience.issueCta}</span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--wk-text-muted)]">Public surface</p>
          <p className="mt-2 text-sm leading-6 text-[var(--wk-text-muted)]">{experience.heroIntro}</p>
        </div>
        <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--wk-text-muted)]">Feature design note</p>
          <p className="mt-2 text-sm leading-6 text-[var(--wk-text-muted)]">{experience.adminNotes.featureDesign}</p>
        </div>
        <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--wk-text-muted)]">Scoring reasons</p>
          {scoring.length ? (
            <ul className="mt-2 space-y-1 text-sm leading-6 text-[var(--wk-text-muted)]">
              {scoring.map((reason) => <li key={reason}>• {reason}</li>)}
            </ul>
          ) : (
            <p className="mt-2 text-sm leading-6 text-[var(--wk-text-muted)]">No scoring warnings returned.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewPanel({ issue }: { issue: IssueWithDetails }) {
  const [validation, setValidation] = useState<{ ready: boolean; issues: string[] } | null>(null);
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    setChecking(true);
    const result = await magazineIssueProduction.validatePublishReadiness(issue.id);
    setValidation(result);
    setChecking(false);
  };

  const selectedEntities = issue.entities.filter((entity) => entity.selection_state !== "excluded");

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6">
        <h3 className="text-lg font-black">Issue Summary</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-[var(--wk-border)] p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Sections</p>
            <p className="mt-1 text-2xl font-black">{issue.sections.length}</p>
          </div>
          <div className="rounded-xl border border-[var(--wk-border)] p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Entities</p>
            <p className="mt-1 text-2xl font-black">{selectedEntities.length}</p>
          </div>
          <div className="rounded-xl border border-[var(--wk-border)] p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Visual</p>
            <p className="mt-1 text-sm font-bold">{issue.visual_family || "Not set"}</p>
          </div>
          <div className="rounded-xl border border-[var(--wk-border)] p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Status</p>
            <p className="mt-1"><StatusBadge status={issue.status} /></p>
          </div>
        </div>
      </div>

      <AdminQualityPanel issue={issue} />

      <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6">
        <h3 className="text-lg font-black">Sections</h3>
        <div className="mt-4 space-y-2">
          {issue.sections.length ? issue.sections.map((section) => (
            <div key={section.id} className="flex items-center justify-between rounded-xl border border-[var(--wk-border)] p-3">
              <div>
                <p className="text-sm font-bold">{section.title}</p>
                <p className="text-xs text-[var(--wk-text-muted)]">{section.section_type} · {section.layout} · order {section.sort_order}</p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                section.status === "approved" || section.status === "locked"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-gray-300 bg-gray-50 text-gray-600"
              }`}>{section.status}</span>
            </div>
          )) : (
            <p className="text-sm text-[var(--wk-text-muted)]">No sections have been generated for this issue yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6">
        <h3 className="text-lg font-black">Selected Entities ({selectedEntities.length})</h3>
        <div className="mt-4 space-y-1">
          {selectedEntities.length ? selectedEntities.map((entity) => (
            <div key={entity.id} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm">
              <span className="rounded-full bg-[var(--wk-brand)]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--wk-brand)]">{entity.entity_type}</span>
              <span className="font-medium">{entity.entity_id}</span>
              <span className="text-xs text-[var(--wk-text-muted)]">· {entity.role}</span>
            </div>
          )) : (
            <p className="text-sm text-[var(--wk-text-muted)]">No selected entities yet.</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleCheck}
          disabled={checking}
          className="rounded-full border border-[var(--wk-border)] px-6 py-2 text-sm font-bold hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)] disabled:opacity-50"
        >
          {checking ? "Checking..." : "Validate Publish Readiness"}
        </button>
        {validation && (
          <div className={`rounded-xl px-4 py-2 text-sm font-bold ${validation.ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {validation.ready ? "Ready to publish" : validation.issues.join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}

function ProduceIssueDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [dek, setDek] = useState("");
  const [timeframeStart, setTimeframeStart] = useState("");
  const [timeframeEnd, setTimeframeEnd] = useState("");
  const [issueType, setIssueType] = useState("standard");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slug) setSlug(normalizeSlug(value));
  };

  const handleCreateDraft = async () => {
    setSaving(true);
    setError(null);
    try {
      await magazineIssueProduction.createIssue({
        title: title || `Issue Draft ${new Date().toISOString().slice(0, 10)}`,
        slug: slug || `issue-draft-${Date.now()}`,
        dek: dek || undefined,
        timeframe_start: timeframeStart || undefined,
        timeframe_end: timeframeEnd || undefined,
        issue_type: issueType,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create issue");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10">
      <div className="w-full max-w-3xl rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-8 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--wk-brand)]">Magazine Production</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">Produce New Issue</h2>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--wk-border)] hover:bg-[var(--wk-surface)]">
            <i className="ri-close-line" />
          </button>
        </div>

        {error && <div className="mb-6 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

        <div className="grid gap-5 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Issue Title</span>
            <input value={title} onChange={(event) => handleTitleChange(event.target.value)} className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3 text-sm font-bold focus:border-[var(--wk-brand)] focus:outline-none" />
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Slug</span>
            <input value={slug} onChange={(event) => setSlug(event.target.value)} className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3 text-sm font-mono focus:border-[var(--wk-brand)] focus:outline-none" />
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Issue Type</span>
            <select value={issueType} onChange={(event) => setIssueType(event.target.value)} className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3 text-sm font-bold focus:border-[var(--wk-brand)] focus:outline-none">
              {ISSUE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label className="md:col-span-2">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Dek / Subtitle</span>
            <input value={dek} onChange={(event) => setDek(event.target.value)} className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3 text-sm focus:border-[var(--wk-brand)] focus:outline-none" />
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Timeframe Start</span>
            <input type="date" value={timeframeStart} onChange={(event) => setTimeframeStart(event.target.value)} className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3 text-sm focus:border-[var(--wk-brand)] focus:outline-none" />
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Timeframe End</span>
            <input type="date" value={timeframeEnd} onChange={(event) => setTimeframeEnd(event.target.value)} className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3 text-sm focus:border-[var(--wk-brand)] focus:outline-none" />
          </label>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-full border border-[var(--wk-border)] px-6 py-2 text-sm font-bold hover:border-[var(--wk-text-muted)]">Cancel</button>
          <button onClick={handleCreateDraft} disabled={saving} className="rounded-full bg-[var(--wk-brand)] px-8 py-2 text-sm font-black text-black transition-opacity hover:opacity-90 disabled:opacity-40">
            {saving ? "Creating..." : "Create Draft"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminMagazineIssuesPage() {
  const [issues, setIssues] = useState<MagazineIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [showProduce, setShowProduce] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<IssueWithDetails | null>(null);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await magazineIssueProduction.listIssues();
      setIssues(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load issues");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  const handleAction = async (action: string, id: string) => {
    setActionFeedback(null);
    try {
      switch (action) {
        case "approve":
          await magazineIssueProduction.approveIssue(id);
          setActionFeedback("Issue approved.");
          break;
        case "publish":
          await magazineIssueProduction.publishIssue(id);
          setActionFeedback("Issue published.");
          break;
        case "lock":
          await magazineIssueProduction.lockIssue(id);
          setActionFeedback("Issue locked.");
          break;
        case "archive":
          await magazineIssueProduction.archiveIssue(id);
          setActionFeedback("Issue archived.");
          break;
        case "delete":
          if (confirm("Delete this issue? This cannot be undone.")) {
            await magazineIssueProduction.deleteIssue(id);
            setActionFeedback("Issue deleted.");
          }
          break;
      }
      await loadIssues();
      if (selectedIssue?.id === id) {
        const detail = await magazineIssueProduction.getIssue(id);
        setSelectedIssue(detail);
      }
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err) {
      setActionFeedback(err instanceof Error ? err.message : "Action failed");
    }
  };

  const handleViewIssue = async (id: string) => {
    try {
      const detail = await magazineIssueProduction.getIssue(id);
      setSelectedIssue(detail);
    } catch (err) {
      setActionFeedback(err instanceof Error ? err.message : "Failed to load issue");
    }
  };

  const drafts = issues.filter((issue) => issue.status === "draft");
  const generated = issues.filter((issue) => issue.status === "generated");
  const approved = issues.filter((issue) => issue.status === "approved");
  const published = issues.filter((issue) => issue.status === "published");

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex items-center justify-center py-24">
            <p className="text-sm text-[var(--wk-text-muted)]">Loading magazine issues...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 border-b border-[var(--wk-border)] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--wk-brand)]">Magazine Production</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] lg:text-6xl">Issue Production</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--wk-text-muted)]">
              Create, review, approve and publish magazine issues with the Magazine Issue Engine visible in the admin preview.
            </p>
          </div>
          <button onClick={() => setShowProduce(true)} className="whitespace-nowrap rounded-full bg-[var(--wk-brand)] px-6 py-3 text-sm font-black text-black transition-opacity hover:opacity-90">
            Produce New Issue
          </button>
        </div>

        {error && <div className="mb-6 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
        {actionFeedback && <div className="mb-6 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{actionFeedback}</div>}

        {issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[var(--wk-border)] py-24">
            <p className="text-xl font-black text-[var(--wk-text-muted)]">No magazine issues have been produced yet.</p>
            <p className="mt-2 text-sm text-[var(--wk-text-muted)]">Create the first issue draft, then review it here.</p>
          </div>
        ) : (
          <>
            <section className="mb-8 grid gap-4 md:grid-cols-5">
              {[
                { label: "Drafts", count: drafts.length, color: "bg-gray-100 text-gray-700" },
                { label: "Generated", count: generated.length, color: "bg-blue-50 text-blue-700" },
                { label: "Approved", count: approved.length, color: "bg-emerald-50 text-emerald-700" },
                { label: "Published", count: published.length, color: "bg-green-100 text-green-800" },
                { label: "Total", count: issues.length, color: "bg-[var(--wk-brand)]/10 text-[var(--wk-brand)]" },
              ].map((stat) => (
                <div key={stat.label} className={`rounded-2xl border border-[var(--wk-border)] p-4 ${stat.count > 0 ? stat.color : "bg-[var(--wk-surface)]"}`}>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-text-muted)]">{stat.label}</p>
                  <p className="mt-2 text-3xl font-black">{stat.count}</p>
                </div>
              ))}
            </section>

            <div className="overflow-hidden rounded-2xl border border-[var(--wk-border)]">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--wk-border)] bg-[var(--wk-surface)]">
                    <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--wk-text-muted)]">Issue</th>
                    <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--wk-text-muted)]">Slug</th>
                    <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--wk-text-muted)]">Timeframe</th>
                    <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--wk-text-muted)]">Status</th>
                    <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--wk-text-muted)]">Created</th>
                    <th className="px-5 py-4 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--wk-text-muted)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((issue) => (
                    <tr key={issue.id} className="border-b border-[var(--wk-border)] hover:bg-[var(--wk-surface)]">
                      <td className="px-5 py-4">
                        <p className="text-sm font-bold">{issue.title}</p>
                        {issue.dek && <p className="mt-0.5 text-xs text-[var(--wk-text-muted)] line-clamp-1">{issue.dek}</p>}
                      </td>
                      <td className="px-5 py-4"><code className="rounded-lg bg-[var(--wk-surface)] px-2 py-1 text-xs">{issue.slug}</code></td>
                      <td className="px-5 py-4 text-xs text-[var(--wk-text-muted)]">{issue.timeframe_start ? `${issue.timeframe_start} → ${issue.timeframe_end || "..."}` : "Not set"}</td>
                      <td className="px-5 py-4"><StatusBadge status={issue.status} /></td>
                      <td className="px-5 py-4 text-xs text-[var(--wk-text-muted)]">{formatDate(issue.created_at)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => handleViewIssue(issue.id)} className="rounded-full border border-[var(--wk-border)] px-3 py-1.5 text-xs font-bold hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]">View</button>
                          {issue.status === "generated" && <button onClick={() => handleAction("approve", issue.id)} className="rounded-full border border-emerald-300 px-3 py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50">Approve</button>}
                          {issue.status === "approved" && <button onClick={() => handleAction("publish", issue.id)} className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700">Publish</button>}
                          {issue.status === "published" && <Link to={`/magazine/issue/${issue.slug}`} className="rounded-full border border-[var(--wk-border)] px-3 py-1.5 text-xs font-bold hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]">Visit</Link>}
                          {issue.status === "published" && <button onClick={() => handleAction("lock", issue.id)} className="rounded-full border border-purple-300 px-3 py-1.5 text-xs font-bold text-purple-600 hover:bg-purple-50">Lock</button>}
                          {issue.status === "locked" && <button onClick={() => handleAction("archive", issue.id)} className="rounded-full border border-amber-300 px-3 py-1.5 text-xs font-bold text-amber-600 hover:bg-amber-50">Archive</button>}
                          {issue.status !== "published" && issue.status !== "locked" && <button onClick={() => handleAction("delete", issue.id)} className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50">Delete</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {showProduce && <ProduceIssueDrawer onClose={() => setShowProduce(false)} onCreated={() => { setShowProduce(false); loadIssues(); }} />}

        {selectedIssue && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10">
            <div className="w-full max-w-5xl rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-8 shadow-2xl">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--wk-brand)]">Production Preview</p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight">{selectedIssue.title}</h2>
                </div>
                <button onClick={() => setSelectedIssue(null)} className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--wk-border)] hover:bg-[var(--wk-surface)]">
                  <i className="ri-close-line" />
                </button>
              </div>
              <ReviewPanel issue={selectedIssue} />
              <div className="mt-6 flex justify-end gap-3">
                {selectedIssue.status === "generated" && <button onClick={async () => { await handleAction("approve", selectedIssue.id); setSelectedIssue(null); }} className="rounded-full border border-emerald-300 px-4 py-2 text-sm font-bold text-emerald-600 hover:bg-emerald-50">Approve</button>}
                {selectedIssue.status === "approved" && <button onClick={async () => { await handleAction("publish", selectedIssue.id); setSelectedIssue(null); }} className="rounded-full bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700">Publish</button>}
                <button onClick={() => setSelectedIssue(null)} className="rounded-full border border-[var(--wk-border)] px-4 py-2 text-sm font-bold">Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
