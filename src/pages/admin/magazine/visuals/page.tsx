import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useMagazineArticles } from "@/services/magazineArticles";
import { buildMagazineIssues } from "@/services/magazineIssues";
import { buildIssueEditorialSystem } from "@/services/magazineNlg";
import { buildMagazineVisualBriefsForIssue } from "@/services/magazineVisualDirector";
import { MAGAZINE_VISUAL_PALETTES } from "@/services/magazineVisualTaxonomy";

export default function AdminMagazineVisualsPage() {
  const { articles, loading, error } = useMagazineArticles();

  const issues = useMemo(() => buildMagazineIssues(articles), [articles]);
  const previewIssues = issues.slice(0, 6);

  if (loading) {
    return <div className="p-8 text-sm text-[var(--wk-text-muted)]">Loading magazine visual director…</div>;
  }

  if (error) {
    return <div className="p-8 text-sm text-red-500">{error}</div>;
  }

  return (
    <main className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 border-b border-[var(--wk-border)] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--wk-brand)]">Phase 0</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] lg:text-6xl">Magazine Visual Director</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--wk-text-muted)]">
              This is the safe foundation for the WAKILISHA visual language engine. It does not generate images yet. It reads issue/spread/article context and produces structured visual briefs, palette decisions, contrast modes, required data and warnings.
            </p>
          </div>
          <Link to="/magazine/issues" className="rounded-full border border-[var(--wk-border)] px-4 py-2 text-sm font-bold hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]">
            View issue archive
          </Link>
        </div>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          {Object.entries(MAGAZINE_VISUAL_PALETTES).map(([key, palette]) => (
            <div key={key} className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
              <div className="mb-3 h-12 rounded-xl" style={{ background: palette.background, border: `2px solid ${palette.accent}` }} />
              <p className="text-xs font-black uppercase tracking-[0.18em]">{key}</p>
              <p className="mt-1 text-xs text-[var(--wk-text-muted)]">{palette.contrast} · {palette.accent}</p>
            </div>
          ))}
        </section>

        <div className="space-y-8">
          {previewIssues.map((issue) => {
            const editorial = buildIssueEditorialSystem(issue);
            const briefs = buildMagazineVisualBriefsForIssue({ issue, editorialSystem: editorial });
            return (
              <section key={issue.slug} className="overflow-hidden rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
                <div className="border-b border-[var(--wk-border)] p-5 lg:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--wk-text-faint)]">{issue.issueLabel} · {issue.sourceWindowLabel}</p>
                      <h2 className="mt-2 text-3xl font-black tracking-[-0.035em]">{issue.title}</h2>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--wk-text-muted)]">{issue.deck}</p>
                    </div>
                    <Link to={`/magazine/issues/${issue.slug}`} className="rounded-full bg-[var(--wk-brand)] px-4 py-2 text-sm font-black text-black">
                      Open issue
                    </Link>
                  </div>
                </div>

                <div className="grid gap-px bg-[var(--wk-border)] lg:grid-cols-2">
                  {briefs.map((brief) => (
                    <article key={brief.id} className="bg-[var(--wk-surface)] p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--wk-brand)]">{brief.spread_role}</p>
                          <h3 className="mt-2 text-xl font-black tracking-[-0.02em]">{brief.visual_type}</h3>
                        </div>
                        <div className="rounded-full px-3 py-1 text-xs font-black" style={{ background: String(brief.required_data.safe_accent), color: String(brief.required_data.safe_foreground) }}>
                          {Math.round(brief.confidence * 100)}%
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 text-xs text-[var(--wk-text-muted)] md:grid-cols-2">
                        <p><b className="text-[var(--wk-text)]">Family:</b> {brief.visual_family}</p>
                        <p><b className="text-[var(--wk-text)]">Intent:</b> {brief.editorial_intent}</p>
                        <p><b className="text-[var(--wk-text)]">Treatment:</b> {brief.treatment}</p>
                        <p><b className="text-[var(--wk-text)]">Palette:</b> {brief.palette} / {brief.contrast_mode}</p>
                      </div>

                      <p className="mt-4 text-sm leading-6 text-[var(--wk-text-muted)]">{brief.rationale}</p>

                      <details className="mt-4 rounded-2xl border border-[var(--wk-border)] p-3">
                        <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.16em] text-[var(--wk-text)]">Required data JSON</summary>
                        <pre className="mt-3 max-h-56 overflow-auto rounded-xl bg-[var(--wk-bg)] p-3 text-[11px] leading-5 text-[var(--wk-text-muted)]">{JSON.stringify(brief.required_data, null, 2)}</pre>
                      </details>

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
