import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMagazineArticles } from "@/services/magazineArticles";
import { buildMagazineIssues } from "@/services/magazineIssues";
import { buildIssueEditorialSystem } from "@/services/magazineNlg";
import { buildMagazineIssueVisualBriefing } from "@/services/magazineVisualDirector";
import { MAGAZINE_VISUAL_PALETTES } from "@/services/magazineVisualTaxonomy";

export default function AdminMagazineVisualsPage() {
  const { articles, loading, error } = useMagazineArticles();
  const [showContext, setShowContext] = useState(false);

  const issues = useMemo(() => buildMagazineIssues(articles), [articles]);
  const previewIssues = issues.slice(0, 8);

  if (loading) return <div className="p-8 text-sm text-[var(--wk-text-muted)]">Loading magazine visual director…</div>;
  if (error) return <div className="p-8 text-sm text-red-500">{error}</div>;

  return (
    <main className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 border-b border-[var(--wk-border)] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--wk-brand)]">Phase 1</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] lg:text-6xl">Visual Intelligence / Briefing Layer</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--wk-text-muted)]">
              This page previews the structured visual briefs that will later drive deterministic renderers. It extracts places, dates, keywords, entities, quote candidates, visual family, treatment, renderer hints, palette, contrast mode, approval risk and warnings.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setShowContext((value) => !value)} className="rounded-full border border-[var(--wk-border)] px-4 py-2 text-sm font-bold hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]">
              {showContext ? "Hide extracted context" : "Show extracted context"}
            </button>
            <Link to="/magazine/issues" className="rounded-full border border-[var(--wk-border)] px-4 py-2 text-sm font-bold hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]">
              View issue archive
            </Link>
          </div>
        </div>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          {Object.entries(MAGAZINE_VISUAL_PALETTES).map(([key, palette]) => (
            <div key={key} className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
              <div className="mb-3 flex h-12 items-center justify-between rounded-xl px-3" style={{ background: palette.background, border: `2px solid ${palette.accent}`, color: palette.foreground }}>
                <span className="text-[10px] font-black uppercase tracking-[0.14em]">Aa</span>
                <span className="h-5 w-5 rounded-full" style={{ background: palette.accent }} />
              </div>
              <p className="text-xs font-black uppercase tracking-[0.18em]">{key}</p>
              <p className="mt-1 text-xs text-[var(--wk-text-muted)]">{palette.contrast} · {palette.accent}</p>
            </div>
          ))}
        </section>

        <div className="space-y-8">
          {previewIssues.map((issue) => {
            const editorial = buildIssueEditorialSystem(issue);
            const briefing = buildMagazineIssueVisualBriefing({ issue, editorialSystem: editorial });
            return (
              <section key={issue.slug} className="overflow-hidden rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
                <div className="border-b border-[var(--wk-border)] p-5 lg:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--wk-text-faint)]">{issue.issueLabel} · {issue.sourceWindowLabel}</p>
                      <h2 className="mt-2 text-3xl font-black tracking-[-0.035em]">{issue.title}</h2>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--wk-text-muted)]">{briefing.summary}</p>
                      {briefing.warnings.length > 0 && <p className="mt-2 text-xs font-bold text-amber-600 dark:text-amber-300">{briefing.warnings.length} issue-level warning(s)</p>}
                    </div>
                    <div className="flex flex-col gap-2 text-right text-xs text-[var(--wk-text-muted)]">
                      <span><b className="text-[var(--wk-text)]">Family:</b> {briefing.dominant_visual_family}</span>
                      <span><b className="text-[var(--wk-text)]">Palette:</b> {briefing.dominant_palette}</span>
                      <Link to={`/magazine/issues/${issue.slug}`} className="mt-2 rounded-full bg-[var(--wk-brand)] px-4 py-2 text-center text-sm font-black text-black">Open issue</Link>
                    </div>
                  </div>
                </div>

                <div className="grid gap-px bg-[var(--wk-border)] lg:grid-cols-2">
                  {briefing.briefs.map((brief) => (
                    <article key={brief.id} className="bg-[var(--wk-surface)] p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--wk-brand)]">{brief.spread_role} · {brief.renderer_hint.renderer_family}</p>
                          <h3 className="mt-2 text-xl font-black tracking-[-0.02em]">{brief.visual_type}</h3>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="rounded-full px-3 py-1 text-xs font-black" style={{ background: String(brief.required_data.safe_accent), color: String(brief.required_data.safe_foreground) }}>{Math.round(brief.confidence * 100)}%</div>
                          <span className={`text-[10px] font-black uppercase tracking-[0.16em] ${brief.approval_risk === 'low' ? 'text-emerald-500' : brief.approval_risk === 'medium' ? 'text-amber-500' : 'text-red-500'}`}>{brief.approval_risk} risk</span>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 text-xs text-[var(--wk-text-muted)] md:grid-cols-2">
                        <p><b className="text-[var(--wk-text)]">Family:</b> {brief.visual_family}</p>
                        <p><b className="text-[var(--wk-text)]">Intent:</b> {brief.editorial_intent}</p>
                        <p><b className="text-[var(--wk-text)]">Treatment:</b> {brief.treatment}</p>
                        <p><b className="text-[var(--wk-text)]">Palette:</b> {brief.palette} / {brief.contrast_mode}</p>
                        <p><b className="text-[var(--wk-text)]">Complexity:</b> {brief.complexity}</p>
                        <p><b className="text-[var(--wk-text)]">Safe zones:</b> {brief.renderer_hint.safe_text_zones.join(', ')}</p>
                      </div>

                      <p className="mt-4 text-sm leading-6 text-[var(--wk-text-muted)]">{brief.rationale}</p>

                      <details className="mt-4 rounded-2xl border border-[var(--wk-border)] p-3">
                        <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.16em] text-[var(--wk-text)]">Required data JSON</summary>
                        <pre className="mt-3 max-h-56 overflow-auto rounded-xl bg-[var(--wk-bg)] p-3 text-[11px] leading-5 text-[var(--wk-text-muted)]">{JSON.stringify(brief.required_data, null, 2)}</pre>
                      </details>

                      {showContext && brief.extracted_context && (
                        <details open className="mt-4 rounded-2xl border border-[var(--wk-border)] p-3">
                          <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.16em] text-[var(--wk-text)]">Extracted context</summary>
                          <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-[var(--wk-bg)] p-3 text-[11px] leading-5 text-[var(--wk-text-muted)]">{JSON.stringify({
                            places: brief.extracted_context.places,
                            dates: brief.extracted_context.dates,
                            keywords: brief.extracted_context.keywords,
                            pullQuotes: brief.extracted_context.pullQuotes,
                            signals: brief.extracted_context.signals,
                          }, null, 2)}</pre>
                        </details>
                      )}

                      {brief.renderer_hint.avoid.length > 0 && (
                        <div className="mt-4 rounded-2xl border border-[var(--wk-border)] p-3 text-xs leading-5 text-[var(--wk-text-muted)]">
                          <b className="text-[var(--wk-text)]">Renderer must avoid:</b>
                          {brief.renderer_hint.avoid.map((warning) => <p key={warning}>• {warning}</p>)}
                        </div>
                      )}

                      {brief.warnings.length > 0 && (
                        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-600 dark:text-amber-300">
                          {brief.warnings.map((warning) => <p key={warning}>• {warning}</p>)}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
