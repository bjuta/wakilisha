import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { magazineIssueProduction, type MagazineIssue, type IssueStatus, type IssueWithDetails, type IssueCandidate, type CandidateGroup, type EntityType, type SelectionState, type VisualDirection, VISUAL_FAMILIES, TREATMENTS, PALETTES, CONTRAST_MODES, ISSUE_TYPES } from "@/services/magazineIssueProduction";

// ── Status Badge ──

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

// ── Step Indicator ──

function StepIndicator({ currentStep, steps }: { currentStep: number; steps: string[] }) {
  return (
    <div className="mb-8 flex items-center gap-2">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i <= currentStep ? "bg-[var(--wk-brand)] text-black" : "bg-gray-200 text-gray-500"}`}>
            {i < currentStep ? "✓" : i + 1}
          </div>
          <span className={`text-xs font-bold ${i <= currentStep ? "text-[var(--wk-text)]" : "text-[var(--wk-text-muted)]"}`}>{label}</span>
          {i < steps.length - 1 && <div className={`h-px w-6 ${i < currentStep ? "bg-[var(--wk-brand)]" : "bg-gray-200"}`} />}
        </div>
      ))}
    </div>
  );
}

// ── Candidate Discovery Panel ──

function CandidateDiscoveryPanel({
  candidates,
  loading,
  selected,
  onToggle,
  onToggleAll,
}: {
  candidates: Record<CandidateGroup, IssueCandidate[]>;
  loading: boolean;
  selected: Set<string>;
  onToggle: (entityType: EntityType, entityId: string) => void;
  onToggleAll: (group: CandidateGroup, entities: IssueCandidate[]) => void;
}) {
  const [activeGroup, setActiveGroup] = useState<CandidateGroup>("article");

  const groups: { key: CandidateGroup; label: string }[] = [
    { key: "article", label: "Articles" },
    { key: "artist", label: "Artists" },
    { key: "release", label: "Releases" },
    { key: "track", label: "Tracks" },
    { key: "label", label: "Labels" },
    { key: "genre", label: "Genres" },
    { key: "chart", label: "Charts" },
    { key: "guide", label: "Guides" },
  ];

  const activeCandidates = candidates[activeGroup] ?? [];
  const selectedInGroup = activeCandidates.filter((c) => selected.has(`${c.entityType}:${c.entityId}`));
  const allSelected = activeCandidates.length > 0 && selectedInGroup.length === activeCandidates.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-sm text-[var(--wk-text-muted)]">Discovering repaired graph candidates...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
        {groups.map((g) => {
          const count = (candidates[g.key] ?? []).length;
          const selCount = (candidates[g.key] ?? []).filter((c) => selected.has(`${c.entityType}:${c.entityId}`)).length;
          return (
            <button
              key={g.key}
              onClick={() => setActiveGroup(g.key)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                activeGroup === g.key
                  ? "bg-[var(--wk-brand)] text-black"
                  : "border border-[var(--wk-border)] text-[var(--wk-text-muted)] hover:border-[var(--wk-brand)] hover:text-[var(--wk-text)]"
              }`}
            >
              {g.label}
              <span className="ml-1.5 opacity-60">({selCount}/{count})</span>
            </button>
          );
        })}
      </div>

      {activeCandidates.length === 0 ? (
        <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 text-center">
          <p className="text-sm text-[var(--wk-text-muted)]">No {activeGroup} candidates available in repaired graph sources.</p>
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--wk-text-muted)]">{activeCandidates.length} candidates</span>
            <button
              onClick={() => onToggleAll(activeGroup, activeCandidates)}
              className="rounded-full border border-[var(--wk-border)] px-3 py-1 text-xs font-bold hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]"
            >
              {allSelected ? "Deselect All" : "Select All"}
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {activeCandidates.map((candidate) => {
              const key = `${candidate.entityType}:${candidate.entityId}`;
              const isSelected = selected.has(key);
              return (
                <button
                  key={key}
                  onClick={() => onToggle(candidate.entityType, candidate.entityId)}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                    isSelected ? "border-[var(--wk-brand)] bg-[var(--wk-brand)]/5" : "border-[var(--wk-border)] bg-[var(--wk-surface)] hover:border-[var(--wk-text-muted)]"
                  }`}
                >
                  <div className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 ${isSelected ? "border-[var(--wk-brand)] bg-[var(--wk-brand)]" : "border-gray-300"}`}>
                    {isSelected && <i className="ri-check-line text-xs text-black" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{candidate.title}</p>
                    <p className="truncate text-xs text-[var(--wk-text-muted)]">{candidate.subtitle}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Visual Direction Panel ──

function VisualDirectionPanel({
  direction,
  onChange,
}: {
  direction: VisualDirection;
  onChange: (d: VisualDirection) => void;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Visual Family</label>
        <div className="flex flex-wrap gap-2">
          {VISUAL_FAMILIES.map((f) => (
            <button
              key={f}
              onClick={() => onChange({ ...direction, visual_family: f })}
              className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
                direction.visual_family === f ? "border-[var(--wk-brand)] bg-[var(--wk-brand)]/10 text-[var(--wk-brand)]" : "border-[var(--wk-border)] text-[var(--wk-text-muted)] hover:border-[var(--wk-text-muted)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Treatment</label>
        <div className="flex flex-wrap gap-2">
          {TREATMENTS.map((t) => (
            <button
              key={t}
              onClick={() => onChange({ ...direction, treatment: t })}
              className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
                direction.treatment === t ? "border-[var(--wk-brand)] bg-[var(--wk-brand)]/10 text-[var(--wk-brand)]" : "border-[var(--wk-border)] text-[var(--wk-text-muted)] hover:border-[var(--wk-text-muted)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Palette</label>
        <div className="flex flex-wrap gap-2">
          {PALETTES.map((p) => (
            <button
              key={p}
              onClick={() => onChange({ ...direction, palette: p })}
              className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
                direction.palette === p ? "border-[var(--wk-brand)] bg-[var(--wk-brand)]/10 text-[var(--wk-brand)]" : "border-[var(--wk-border)] text-[var(--wk-text-muted)] hover:border-[var(--wk-text-muted)]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Contrast Mode</label>
        <div className="flex flex-wrap gap-2">
          {CONTRAST_MODES.map((c) => (
            <button
              key={c}
              onClick={() => onChange({ ...direction, contrast_mode: c })}
              className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
                direction.contrast_mode === c ? "border-[var(--wk-brand)] bg-[var(--wk-brand)]/10 text-[var(--wk-brand)]" : "border-[var(--wk-border)] text-[var(--wk-text-muted)] hover:border-[var(--wk-text-muted)]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Review Panel ──

function ReviewPanel({ issue }: { issue: IssueWithDetails }) {
  const [validation, setValidation] = useState<{ ready: boolean; issues: string[] } | null>(null);
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    setChecking(true);
    const result = await magazineIssueProduction.validatePublishReadiness(issue.id);
    setValidation(result);
    setChecking(false);
  };

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
            <p className="mt-1 text-2xl font-black">{issue.entities.length}</p>
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

      <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6">
        <h3 className="text-lg font-black">Sections</h3>
        <div className="mt-4 space-y-2">
          {issue.sections.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-xl border border-[var(--wk-border)] p-3">
              <div>
                <p className="text-sm font-bold">{s.title}</p>
                <p className="text-xs text-[var(--wk-text-muted)]">{s.section_type} · {s.layout} · order {s.sort_order}</p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                s.status === "approved" || s.status === "locked" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-300 bg-gray-50 text-gray-600"
              }`}>{s.status}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6">
        <h3 className="text-lg font-black">Selected Entities ({issue.entities.filter((e) => e.selection_state !== "excluded").length})</h3>
        <div className="mt-4 space-y-1">
          {issue.entities.filter((e) => e.selection_state !== "excluded").map((e) => (
            <div key={e.id} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm">
              <span className="rounded-full bg-[var(--wk-brand)]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--wk-brand)]">{e.entity_type}</span>
              <span className="font-medium">{e.entity_id}</span>
              <span className="text-xs text-[var(--wk-text-muted)]">· {e.role}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
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

// ── Produce Issue Drawer ──

function ProduceIssueDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const STEPS = ["Setup", "Discover", "Select", "Visual Direction", "Generate", "Review"];
  const [step, setStep] = useState(0);

  // Step 1: Setup
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [dek, setDek] = useState("");
  const [timeframeStart, setTimeframeStart] = useState("");
  const [timeframeEnd, setTimeframeEnd] = useState("");
  const [issueType, setIssueType] = useState("standard");

  // Step 2-3: Candidates
  const [candidates, setCandidates] = useState<Record<CandidateGroup, IssueCandidate[]> | null>(null);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Step 4: Visual Direction
  const [visualDirection, setVisualDirection] = useState<VisualDirection>({
    visual_family: "Scene / Atmosphere",
    treatment: "annotated-photo",
    palette: "neutral",
    contrast_mode: "dark",
  });

  // Generated issue
  const [generatedIssue, setGeneratedIssue] = useState<IssueWithDetails | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDiscover = async () => {
    setCandidatesLoading(true);
    setError(null);
    try {
      const result = await magazineIssueProduction.discoverCandidates(timeframeStart || undefined, timeframeEnd || undefined);
      setCandidates(result);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setCandidatesLoading(false);
    }
  };

  const handleToggle = (entityType: EntityType, entityId: string) => {
    const key = `${entityType}:${entityId}`;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleToggleAll = (group: CandidateGroup, entities: IssueCandidate[]) => {
    const keys = entities.map((e) => `${e.entityType}:${e.entityId}`);
    const allSelected = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const selectedEntities = Array.from(selected).map((key) => {
        const [entityType, entityId] = key.split(":") as [EntityType, string];
        return { entityType, entityId, role: "supporting" as const, selectionState: "selected" as SelectionState };
      });

      const issue = await magazineIssueProduction.generateIssue(
        generatedIssue?.id ?? "",
        selectedEntities,
        visualDirection,
      );
      setGeneratedIssue(issue);
      setStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateDraft = async () => {
    setError(null);
    try {
      const issue = await magazineIssueProduction.createIssue({
        title: title || `Issue Draft ${new Date().toISOString().slice(0, 10)}`,
        slug: slug || `issue-draft-${Date.now()}`,
        dek: dek || undefined,
        timeframe_start: timeframeStart || undefined,
        timeframe_end: timeframeEnd || undefined,
        issue_type: issueType,
      });
      setGeneratedIssue(issue as unknown as IssueWithDetails);
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create issue");
    }
  };

  // Auto-generate slug from title
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slug || slug.startsWith("issue-draft-")) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "").replace(/^-+/, ""));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-10 pb-20">
      <div className="w-full max-w-4xl rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-8 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-black tracking-tight">Produce New Issue</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--wk-border)] hover:bg-[var(--wk-surface)]">
            <i className="ri-close-line" />
          </button>
        </div>

        <StepIndicator currentStep={step} steps={STEPS} />

        {error && (
          <div className="mb-6 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>
        )}

        {/* Step 0: Setup */}
        {step === 0 && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Issue Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. The Sound Finds a Room"
                className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3 text-sm font-bold placeholder:text-[var(--wk-text-muted)] focus:border-[var(--wk-brand)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="issue-slug"
                className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3 text-sm font-mono placeholder:text-[var(--wk-text-muted)] focus:border-[var(--wk-brand)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Issue Type</label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3 text-sm font-bold focus:border-[var(--wk-brand)] focus:outline-none"
              >
                {ISSUE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Dek / Subtitle</label>
              <input
                type="text"
                value={dek}
                onChange={(e) => setDek(e.target.value)}
                placeholder="A brief description of this issue..."
                className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3 text-sm placeholder:text-[var(--wk-text-muted)] focus:border-[var(--wk-brand)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Timeframe Start</label>
              <input
                type="date"
                value={timeframeStart}
                onChange={(e) => setTimeframeStart(e.target.value)}
                className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3 text-sm focus:border-[var(--wk-brand)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Timeframe End</label>
              <input
                type="date"
                value={timeframeEnd}
                onChange={(e) => setTimeframeEnd(e.target.value)}
                className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3 text-sm focus:border-[var(--wk-brand)] focus:outline-none"
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button
                onClick={handleCreateDraft}
                disabled={!title}
                className="rounded-full bg-[var(--wk-brand)] px-8 py-3 text-sm font-black text-black transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                Create Draft & Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Candidate Discovery */}
        {step === 1 && (
          <div className="text-center">
            <p className="mb-6 text-sm text-[var(--wk-text-muted)]">
              Discover content candidates from repaired graph sources. This pulls from registry tables, not raw imported data.
            </p>
            <button
              onClick={handleDiscover}
              disabled={candidatesLoading}
              className="rounded-full bg-[var(--wk-brand)] px-8 py-3 text-sm font-black text-black transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {candidatesLoading ? "Discovering..." : "Discover Candidates"}
            </button>
          </div>
        )}

        {/* Step 2: Select Candidates */}
        {step === 2 && candidates && (
          <div>
            <p className="mb-4 text-sm text-[var(--wk-text-muted)]">
              Select entities to include in this issue. Selected: <strong>{selected.size}</strong> entities across all groups.
            </p>
            <CandidateDiscoveryPanel
              candidates={candidates}
              loading={false}
              selected={selected}
              onToggle={handleToggle}
              onToggleAll={handleToggleAll}
            />
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setStep(1)} className="rounded-full border border-[var(--wk-border)] px-6 py-2 text-sm font-bold hover:border-[var(--wk-text-muted)]">
                Back
              </button>
              <button onClick={() => setStep(3)} className="rounded-full bg-[var(--wk-brand)] px-8 py-2 text-sm font-black text-black">
                Continue to Visual Direction
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Visual Direction */}
        {step === 3 && (
          <div>
            <p className="mb-4 text-sm text-[var(--wk-text-muted)]">
              Choose the visual direction for this issue. These settings map to the existing visual asset fields.
            </p>
            <VisualDirectionPanel direction={visualDirection} onChange={setVisualDirection} />
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setStep(2)} className="rounded-full border border-[var(--wk-border)] px-6 py-2 text-sm font-bold hover:border-[var(--wk-text-muted)]">
                Back
              </button>
              <button onClick={() => setStep(4)} className="rounded-full bg-[var(--wk-brand)] px-8 py-2 text-sm font-black text-black">
                Review & Generate
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Generate */}
        {step === 4 && (
          <div>
            <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6">
              <h3 className="text-lg font-black">Generation Summary</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-[var(--wk-border)] p-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Selected Entities</p>
                  <p className="mt-1 text-2xl font-black">{selected.size}</p>
                </div>
                <div className="rounded-xl border border-[var(--wk-border)] p-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Visual Family</p>
                  <p className="mt-1 text-sm font-bold">{visualDirection.visual_family}</p>
                </div>
                <div className="rounded-xl border border-[var(--wk-border)] p-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Mode</p>
                  <p className="mt-1 text-sm font-bold">{visualDirection.contrast_mode}</p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setStep(3)} className="rounded-full border border-[var(--wk-border)] px-6 py-2 text-sm font-bold hover:border-[var(--wk-text-muted)]">
                Back
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating || selected.size === 0}
                className="rounded-full bg-[var(--wk-brand)] px-8 py-2 text-sm font-black text-black transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {generating ? "Generating..." : "Generate Issue"}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {step === 5 && generatedIssue && (
          <div>
            <ReviewPanel issue={generatedIssue} />
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={onClose} className="rounded-full border border-[var(--wk-border)] px-6 py-2 text-sm font-bold hover:border-[var(--wk-text-muted)]">
                Close
              </button>
              <button onClick={onCreated} className="rounded-full bg-[var(--wk-brand)] px-8 py-2 text-sm font-black text-black">
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──

export default function AdminMagazineIssuesPage() {
  const [issues, setIssues] = useState<MagazineIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProduce, setShowProduce] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<IssueWithDetails | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

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
          setActionFeedback("Issue published! It is now visible at /magazine/issue/:slug");
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

  const drafts = issues.filter((i) => i.status === "draft");
  const generated = issues.filter((i) => i.status === "generated");
  const approved = issues.filter((i) => i.status === "approved");
  const published = issues.filter((i) => i.status === "published");

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
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 border-b border-[var(--wk-border)] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--wk-brand)]">Magazine Production</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] lg:text-6xl">Issue Production</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--wk-text-muted)]">
              Human-in-the-loop magazine issue production. Create issues, discover repaired graph candidates, select entities, choose visual direction, generate, approve, and publish.
            </p>
          </div>
          <button
            onClick={() => setShowProduce(true)}
            className="whitespace-nowrap rounded-full bg-[var(--wk-brand)] px-6 py-3 text-sm font-black text-black transition-opacity hover:opacity-90"
          >
            Produce New Issue
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>
        )}

        {actionFeedback && (
          <div className="mb-6 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{actionFeedback}</div>
        )}

        {issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[var(--wk-border)] py-24">
            <p className="text-xl font-black text-[var(--wk-text-muted)]">No magazine issues have been produced yet.</p>
            <p className="mt-2 text-sm text-[var(--wk-text-muted)]">Click "Produce New Issue" to create the first one.</p>
          </div>
        ) : (
          <>
            {/* Stats strip */}
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

            {/* Issues table */}
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
                      <td className="px-5 py-4">
                        <code className="rounded-lg bg-[var(--wk-surface)] px-2 py-1 text-xs">{issue.slug}</code>
                      </td>
                      <td className="px-5 py-4 text-xs text-[var(--wk-text-muted)]">
                        {issue.timeframe_start ? `${issue.timeframe_start} → ${issue.timeframe_end || "..."}` : "—"}
                      </td>
                      <td className="px-5 py-4"><StatusBadge status={issue.status} /></td>
                      <td className="px-5 py-4 text-xs text-[var(--wk-text-muted)]">
                        {new Date(issue.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => handleViewIssue(issue.id)} className="rounded-full border border-[var(--wk-border)] px-3 py-1.5 text-xs font-bold hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]">View</button>

                          {issue.status === "generated" && (
                            <button onClick={() => handleAction("approve", issue.id)} className="rounded-full border border-emerald-300 px-3 py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50">Approve</button>
                          )}
                          {issue.status === "approved" && (
                            <button onClick={() => handleAction("publish", issue.id)} className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700">Publish</button>
                          )}
                          {issue.status === "published" && (
                            <>
                              <Link to={`/magazine/issue/${issue.slug}`} className="rounded-full border border-[var(--wk-border)] px-3 py-1.5 text-xs font-bold hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]">Visit</Link>
                              <button onClick={() => handleAction("lock", issue.id)} className="rounded-full border border-purple-300 px-3 py-1.5 text-xs font-bold text-purple-600 hover:bg-purple-50">Lock</button>
                            </>
                          )}
                          {issue.status !== "published" && issue.status !== "locked" && (
                            <button onClick={() => handleAction("delete", issue.id)} className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50">Delete</button>
                          )}
                          {issue.status === "locked" && (
                            <button onClick={() => handleAction("archive", issue.id)} className="rounded-full border border-amber-300 px-3 py-1.5 text-xs font-bold text-amber-600 hover:bg-amber-50">Archive</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Produce Issue Drawer */}
        {showProduce && (
          <ProduceIssueDrawer
            onClose={() => { setShowProduce(false); loadIssues(); }}
            onCreated={() => { setShowProduce(false); loadIssues(); }}
          />
        )}

        {/* Issue Detail Drawer */}
        {selectedIssue && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-10 pb-20">
            <div className="w-full max-w-4xl rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-8 shadow-2xl">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-black tracking-tight">{selectedIssue.title}</h2>
                <button onClick={() => setSelectedIssue(null)} className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--wk-border)] hover:bg-[var(--wk-surface)]">
                  <i className="ri-close-line" />
                </button>
              </div>
              <ReviewPanel issue={selectedIssue} />
              <div className="mt-6 flex justify-end gap-3">
                {selectedIssue.status === "generated" && (
                  <button onClick={async () => { await magazineIssueProduction.approveIssue(selectedIssue.id); setSelectedIssue(null); loadIssues(); }} className="rounded-full border border-emerald-300 px-4 py-2 text-sm font-bold text-emerald-600 hover:bg-emerald-50">Approve</button>
                )}
                {selectedIssue.status === "approved" && (
                  <button onClick={async () => { await magazineIssueProduction.publishIssue(selectedIssue.id); setSelectedIssue(null); loadIssues(); }} className="rounded-full bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700">Publish</button>
                )}
                <button onClick={() => setSelectedIssue(null)} className="rounded-full border border-[var(--wk-border)] px-4 py-2 text-sm font-bold">Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}