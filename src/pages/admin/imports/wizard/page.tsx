import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  DEFAULT_FIELD_MAPPINGS,
  DEFAULT_MIGRATION_CHECKLIST,
  MIGRATION_SOURCE_OPTIONS,
  MIGRATION_WIZARD_STEPS,
  defaultMigrationWizardState,
  migrationReadinessScore,
  type MigrationMappingStatus,
  type MigrationSourceMode,
  type MigrationWizardStepId,
} from "@/services/wordpressReactMigrationWizard";

const stepOrder = MIGRATION_WIZARD_STEPS.map((step) => step.id);

export default function AdminWordPressReactMigrationWizardPage() {
  const navigate = useNavigate();
  const [state, setState] = useState(defaultMigrationWizardState());
  const [activeStep, setActiveStep] = useState<MigrationWizardStepId>("welcome");
  const score = useMemo(() => migrationReadinessScore(state), [state]);
  const active = MIGRATION_WIZARD_STEPS.find((step) => step.id === activeStep) ?? MIGRATION_WIZARD_STEPS[0];
  const currentIndex = stepOrder.indexOf(activeStep);

  const approveCurrentStep = () => {
    setState((prev) => ({
      ...prev,
      approvedSteps: Array.from(new Set([...prev.approvedSteps, activeStep])),
      authState: activeStep === "source" ? "approved" : prev.authState,
      checklist: prev.checklist.map((item) => {
        if (activeStep === "source" && (item.id === "source" || item.id === "auth")) return { ...item, status: "done" as const };
        if (activeStep === "scan" && item.id === "scan") return { ...item, status: "done" as const };
        if (activeStep === "map" && item.id === "mapping") return { ...item, status: "done" as const };
        if (activeStep === "media" && item.id === "media") return { ...item, status: "done" as const };
        if (activeStep === "review" && item.id === "redirects") return { ...item, status: "done" as const };
        if (activeStep === "run" && item.id === "promotion") return { ...item, status: "done" as const };
        return item;
      }),
    }));
    const next = stepOrder[currentIndex + 1];
    if (next) setActiveStep(next);
  };

  const updateMapping = (id: string, status: MigrationMappingStatus) => {
    setState((prev) => ({ ...prev, mappings: prev.mappings.map((mapping) => mapping.id === id ? { ...mapping, status } : mapping) }));
  };

  const selectSource = (sourceMode: MigrationSourceMode) => {
    setState((prev) => ({ ...prev, sourceMode, authState: sourceMode === "zip_upload" ? "approved" : "needs_auth" }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">Imports</div>
          <h1 className="text-[24px] font-black tracking-tight text-wk-text">WordPress → React Migration Wizard</h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-6 text-wk-text-muted">
            A simple, approval-led migration assistant. The user only needs to connect, approve, match uncertain fields and press the safe migration button.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/imports/upload" className="wk-button wk-button-ghost wk-button-sm">Old ZIP upload</Link>
          <button onClick={() => navigate("/admin/imports/jobs")} className="wk-button wk-button-ghost wk-button-sm"><WkIcon name="List" size={14} /> Jobs</button>
        </div>
      </div>

      <WkSurface className="overflow-hidden p-0">
        <div className="grid gap-px bg-wk-border lg:grid-cols-[320px_1fr]">
          <aside className="bg-wk-surface p-5">
            <div className="rounded-2xl border border-wk-border bg-wk-bg-subtle p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-wk-text-muted">Readiness</span>
                <span className="text-[22px] font-black text-wk-text">{score}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-wk-border"><div className="h-full rounded-full bg-wk-brand" style={{ width: `${score}%` }} /></div>
              <p className="mt-3 text-[12px] leading-5 text-wk-text-muted">The wizard keeps production safe until the final approval.</p>
            </div>

            <div className="mt-5 space-y-2">
              {MIGRATION_WIZARD_STEPS.map((step, idx) => {
                const isActive = step.id === activeStep;
                const isApproved = state.approvedSteps.includes(step.id);
                return (
                  <button key={step.id} onClick={() => setActiveStep(step.id)} className={`w-full rounded-xl border p-3 text-left transition ${isActive ? "border-wk-brand bg-wk-brand-soft" : "border-wk-border bg-wk-surface-raised hover:border-wk-border-2"}`}>
                    <div className="flex items-center gap-3">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-black ${isApproved ? "bg-wk-brand text-black" : "bg-wk-bg text-wk-text-muted"}`}>{isApproved ? "✓" : idx + 1}</span>
                      <span className="min-w-0"><span className="block text-[13px] font-black text-wk-text">{step.label}</span><span className="block truncate text-[11px] text-wk-text-muted">{step.childLabel}</span></span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="bg-wk-surface p-5 lg:p-7">
            <div className="mb-6 rounded-3xl border border-wk-border bg-wk-bg-subtle p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-wk-brand">Step {currentIndex + 1} of {MIGRATION_WIZARD_STEPS.length}</p>
                  <h2 className="mt-2 max-w-3xl text-[28px] font-black leading-tight tracking-[-0.04em] text-wk-text">{active.title}</h2>
                  <p className="mt-3 max-w-3xl text-[14px] leading-6 text-wk-text-muted">{active.description}</p>
                </div>
                <button onClick={approveCurrentStep} className="wk-button wk-button-primary whitespace-nowrap">{active.actionLabel}</button>
              </div>
            </div>

            {activeStep === "welcome" && <WelcomePanel />}
            {activeStep === "source" && <SourcePanel selected={state.sourceMode} onSelect={selectSource} />}
            {activeStep === "scan" && <ScanPanel />}
            {activeStep === "map" && <MappingPanel mappings={state.mappings} onUpdate={updateMapping} />}
            {activeStep === "media" && <MediaPanel />}
            {activeStep === "review" && <ReviewPanel checklist={state.checklist} />}
            {activeStep === "run" && <RunPanel />}
            {activeStep === "verify" && <VerifyPanel />}
          </section>
        </div>
      </WkSurface>
    </div>
  );
}

function WelcomePanel() {
  return <div className="grid gap-4 md:grid-cols-3">{[
    ["ShieldCheck", "Safe by default", "Everything stages first. Nothing goes live until approval."],
    ["MousePointerClick", "Tiny decisions", "The wizard asks simple yes/no and match-this-to-that questions."],
    ["PackageCheck", "Reusable engine", "The same flow can later become a standalone WordPress to React migration product."],
  ].map(([icon, title, body]) => <WkSurface key={title} className="p-5"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-wk-brand-soft"><WkIcon name={icon as never} size={18} className="text-wk-brand" /></div><h3 className="text-[14px] font-black text-wk-text">{title}</h3><p className="mt-2 text-[12px] leading-5 text-wk-text-muted">{body}</p></WkSurface>)}</div>;
}

function SourcePanel({ selected, onSelect }: { selected: MigrationSourceMode; onSelect: (mode: MigrationSourceMode) => void }) {
  return <div className="grid gap-3 md:grid-cols-2">{MIGRATION_SOURCE_OPTIONS.map((option) => <button key={option.id} disabled={!option.available} onClick={() => onSelect(option.id)} className={`rounded-2xl border p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-55 ${selected === option.id ? "border-wk-brand bg-wk-brand-soft" : "border-wk-border bg-wk-bg-subtle hover:border-wk-border-2"}`}><div className="mb-3 flex items-center justify-between"><span className="rounded-full bg-wk-surface px-2 py-1 text-[10px] font-black uppercase tracking-wider text-wk-text-muted">{option.badge}</span>{selected === option.id && <span className="text-[12px] font-black text-wk-brand">Selected</span>}</div><h3 className="text-[15px] font-black text-wk-text">{option.title}</h3><p className="mt-2 text-[12px] leading-5 text-wk-text-muted">{option.description}</p></button>)}</div>;
}

function ScanPanel() {
  const cards = [
    ["Articles", "Posts, pages, guides and editorial content", "234 found"],
    ["Media", "Featured images, inline images and attachments", "1,920 found"],
    ["People", "Authors, artists and user profiles", "112 found"],
    ["Taxonomy", "Categories, tags, genres and labels", "386 found"],
  ];
  return <div className="grid gap-4 md:grid-cols-4">{cards.map(([title, desc, count]) => <WkSurface key={title} className="p-5"><p className="text-[28px] font-black text-wk-text">{count}</p><h3 className="mt-2 text-[14px] font-black text-wk-text">{title}</h3><p className="mt-1 text-[12px] leading-5 text-wk-text-muted">{desc}</p></WkSurface>)}</div>;
}

function MappingPanel({ mappings, onUpdate }: { mappings: typeof DEFAULT_FIELD_MAPPINGS; onUpdate: (id: string, status: MigrationMappingStatus) => void }) {
  return <div className="space-y-3">{mappings.map((mapping) => <div key={mapping.id} className="rounded-2xl border border-wk-border bg-wk-bg-subtle p-4"><div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center"><div><p className="text-[10px] font-black uppercase tracking-wider text-wk-text-muted">WordPress</p><h3 className="mt-1 text-[14px] font-black text-wk-text">{mapping.sourceEntity}.{mapping.sourceField}</h3><p className="mt-1 text-[12px] text-wk-text-muted">Example: {mapping.example}</p></div><div className="hidden text-wk-brand lg:block">→</div><div><p className="text-[10px] font-black uppercase tracking-wider text-wk-text-muted">React</p><h3 className="mt-1 text-[14px] font-black text-wk-text">{mapping.targetEntity}.{mapping.targetField}</h3><p className="mt-1 text-[12px] text-wk-text-muted">{mapping.help}</p></div></div><div className="mt-4 flex flex-wrap items-center gap-2"><span className="rounded-full bg-wk-surface px-3 py-1 text-[11px] font-black text-wk-text-muted">{Math.round(mapping.confidence * 100)}% confidence</span><button onClick={() => onUpdate(mapping.id, 'auto_matched')} className="rounded-full border border-wk-border px-3 py-1.5 text-[11px] font-black hover:border-wk-brand hover:text-wk-brand">Approve</button><button onClick={() => onUpdate(mapping.id, 'needs_review')} className="rounded-full border border-wk-border px-3 py-1.5 text-[11px] font-black hover:border-amber-500 hover:text-amber-500">Review later</button><button onClick={() => onUpdate(mapping.id, 'ignored')} className="rounded-full border border-wk-border px-3 py-1.5 text-[11px] font-black hover:border-red-500 hover:text-red-500">Ignore</button><span className={`ml-auto text-[11px] font-black uppercase tracking-wider ${mapping.status === 'auto_matched' ? 'text-wk-success' : mapping.status === 'needs_review' ? 'text-amber-500' : 'text-red-500'}`}>{mapping.status.replace('_', ' ')}</span></div></div>)}</div>;
}

function MediaPanel() {
  return <div className="grid gap-4 md:grid-cols-3">{[
    ["Featured images", "Move and attach to React hero images", "Ready"],
    ["Missing images", "Use the placeholder/fallback image framework", "Needs review"],
    ["Embeds", "Preserve YouTube, Spotify, Audiomack and iframe embeds", "Ready"],
  ].map(([title, desc, badge]) => <WkSurface key={title} className="p-5"><span className="rounded-full bg-wk-brand-soft px-2 py-1 text-[10px] font-black uppercase tracking-wider text-wk-brand">{badge}</span><h3 className="mt-4 text-[15px] font-black text-wk-text">{title}</h3><p className="mt-2 text-[12px] leading-5 text-wk-text-muted">{desc}</p></WkSurface>)}</div>;
}

function ReviewPanel({ checklist }: { checklist: typeof DEFAULT_MIGRATION_CHECKLIST }) {
  return <div className="space-y-3">{checklist.map((item) => <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-wk-border bg-wk-bg-subtle p-4"><span className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg text-[12px] font-black ${item.status === 'done' ? 'bg-wk-brand text-black' : item.status === 'warning' ? 'bg-amber-500/20 text-amber-500' : item.status === 'blocked' ? 'bg-red-500/20 text-red-500' : 'bg-wk-surface text-wk-text-muted'}`}>{item.status === 'done' ? '✓' : '!'}</span><div><h3 className="text-[14px] font-black text-wk-text">{item.label}</h3><p className="mt-1 text-[12px] leading-5 text-wk-text-muted">{item.description}</p></div></div>)}</div>;
}

function RunPanel() {
  return <WkSurface className="p-6"><div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-wk-brand-soft"><WkIcon name="Rocket" size={24} className="text-wk-brand" /></div><div><h3 className="text-[18px] font-black text-wk-text">Ready for staged migration</h3><p className="mt-1 text-[13px] leading-6 text-wk-text-muted">The production version should run: create staging run → import batches → validate counts → promote approved records → generate redirects → queue failures for review.</p></div></div></WkSurface>;
}

function VerifyPanel() {
  return <div className="grid gap-4 md:grid-cols-2">{[
    ["Sample pages", "Open migrated pages and compare old vs new."],
    ["Relationships", "Check authors, artists, tracks, releases, genres and labels."],
    ["Redirects", "Confirm old WordPress URLs land on React pages."],
    ["Media", "Confirm images load or fall back gracefully."],
  ].map(([title, desc]) => <WkSurface key={title} className="p-5"><h3 className="text-[15px] font-black text-wk-text">{title}</h3><p className="mt-2 text-[12px] leading-5 text-wk-text-muted">{desc}</p></WkSurface>)}</div>;
}
