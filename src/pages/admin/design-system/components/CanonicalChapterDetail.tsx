import type { WkDesignChapterSpec } from '../../../../design-system/designSystemSpec';
import { WkTag } from '../../../../components/design-system/primitives/Tag';
import { WkSurface } from '../../../../components/design-system/primitives/Surface';
import { RichSpecimenCard } from './RichSpecimenCard';

export function CanonicalChapterDetail({ chapter }: { chapter: WkDesignChapterSpec }) {
  const canonical = chapter.canonical;
  if (!canonical) return null;

  return (
    <div className="space-y-5">
      <WkSurface className="p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Canonical depth</h3>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--wk-text-muted)]">
              Structured from the canonical HTML design bible. This block exposes the sections, visuals, tables, code samples, callouts and QA material the admin page must render.
            </p>
          </div>
          <WkTag variant="brand">{canonical.canonicalAnchor}</WkTag>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric value={canonical.canonicalSubsections.length} label="Sections" />
          <Metric value={canonical.canonicalMetrics.visualSpecimens} label="Visuals" />
          <Metric value={canonical.canonicalMetrics.tables} label="Tables" />
          <Metric value={canonical.canonicalMetrics.codeBlocks} label="Code" />
          <Metric value={canonical.canonicalMetrics.callouts + canonical.canonicalMetrics.doDontCards} label="Callouts" />
        </div>

        <div className="mt-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] p-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">Parity instruction</div>
          <p className="text-[13px] leading-relaxed text-[var(--wk-text-soft)]">{canonical.parityInstruction}</p>
        </div>
      </WkSurface>

      <WkSurface className="p-5">
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Canonical sections to render</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {canonical.canonicalSubsections.map((section, index) => (
            <div key={section} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] p-3">
              <div className="mb-2 font-mono text-[10px] text-[var(--wk-brand)]">{String(index + 1).padStart(2, '0')}</div>
              <div className="text-[13px] font-bold text-[var(--wk-text)]">{section}</div>
            </div>
          ))}
        </div>
      </WkSurface>

      <WkSurface className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Rich media and graphical specimens</h3>
            <p className="mt-1 text-[13px] text-[var(--wk-text-muted)]">
              Live depictions required by the canonical bible: token boards, hover lift, motion wireframes, player states, rows, modals, mobile frames and component previews.
            </p>
          </div>
          <WkTag variant="brand">{canonical.richMedia.length} groups</WkTag>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {canonical.richMedia.map((item) => (
            <RichSpecimenCard key={item.id} item={item} />
          ))}
        </div>
      </WkSurface>
    </div>
  );
}

function Metric({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] p-3">
      <div className="text-2xl font-black tracking-[-0.04em] text-[var(--wk-brand)]">{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--wk-text-muted)]">{label}</div>
    </div>
  );
}
