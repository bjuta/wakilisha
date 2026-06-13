import { useState } from "react";
import type { PavilionsGridData, PavilionItem } from "../sectionTypes";

function getFlagEmoji(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function PavilionModal({ pavilion, isOpen, onClose }: { pavilion: PavilionItem; isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  const howToRead = pavilion.how_to_read || pavilion.howToRead || "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[680px] max-h-[90vh] overflow-y-auto rounded-2xl bg-[var(--wk-bg)] border border-[var(--wk-border)] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[var(--wk-divider)] bg-[var(--wk-bg)]/95 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getFlagEmoji(pavilion.flag)}</span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">{pavilion.type} | {pavilion.route}</p>
              <h3 className="text-[18px] font-black text-[var(--wk-text)]">{pavilion.country}</h3>
            </div>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--wk-surface-raised)] hover:bg-[var(--wk-border)] transition-colors cursor-pointer" aria-label="Close pavilion details">
            <i className="ri-close-line text-[var(--wk-text)]" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <h4 className="text-[16px] font-bold italic text-[var(--wk-text)]">{pavilion.title}</h4>
          <p className="text-[14px] leading-relaxed text-[var(--wk-text-soft)]">{pavilion.context}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl bg-[var(--wk-surface)] p-4 border border-[var(--wk-border)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-faint)] mb-1">Commissioner</p>
              <p className="text-[13px] text-[var(--wk-text)]">{pavilion.commissioner}</p>
            </div>
            <div className="rounded-xl bg-[var(--wk-surface)] p-4 border border-[var(--wk-border)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-faint)] mb-1">Curator</p>
              <p className="text-[13px] text-[var(--wk-text)]">{pavilion.curator}</p>
            </div>
            <div className="rounded-xl bg-[var(--wk-surface)] p-4 border border-[var(--wk-border)] sm:col-span-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-faint)] mb-1">Exhibitors</p>
              <p className="text-[13px] text-[var(--wk-text)]">{pavilion.exhibitors}</p>
            </div>
            <div className="rounded-xl bg-[var(--wk-surface)] p-4 border border-[var(--wk-border)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-faint)] mb-1">Venue</p>
              <p className="text-[13px] text-[var(--wk-text)]">{pavilion.venue}</p>
            </div>
            <div className="rounded-xl bg-[var(--wk-surface)] p-4 border border-[var(--wk-border)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-faint)] mb-1">Route</p>
              <p className="text-[13px] text-[var(--wk-text)]">{pavilion.route}</p>
            </div>
            {howToRead && (
              <div className="rounded-xl bg-[var(--wk-surface)] p-4 border border-[var(--wk-border)] sm:col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-faint)] mb-1">How to read it</p>
                <p className="text-[13px] text-[var(--wk-text)]">{howToRead}</p>
              </div>
            )}
          </div>

          <div className="rounded-xl bg-[var(--wk-v-intel)]/10 border border-[var(--wk-v-intel)]/20 p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-v-intel)] mb-2">Why it matters</p>
            <p className="text-[14px] leading-relaxed text-[var(--wk-text)]">{pavilion.why}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PavilionsGridSection({ data }: { data: PavilionsGridData }) {
  const titleItalic = data.titleItalic || data.title_italic || "";
  const [activePavilion, setActivePavilion] = useState<string | null>(null);
  const activePavilionData = data.pavilions.find((p) => p.number === activePavilion);

  return (
    <>
      <section id="pavilions" className="py-16 md:py-24 border-t border-[var(--wk-divider)]" style={{ background: "var(--wk-bg)" }}>
        <div className="wk-container-wide px-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10 md:mb-14">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--wk-text-faint)] mb-3">{data.eyebrow}</p>
              <h2 className="text-[clamp(28px,4vw,48px)] font-black leading-[1.05] tracking-[-0.03em] text-[var(--wk-text)]">
                {data.title}{" "}
                {titleItalic && <span className="italic font-light">{titleItalic}</span>}
              </h2>
            </div>
            {data.label && (
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--wk-text-faint)]">{data.label}</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.pavilions.map((pavilion) => (
              <button
                key={pavilion.number}
                type="button"
                onClick={() => setActivePavilion(pavilion.number)}
                className="group text-left rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 transition-all hover:border-[var(--wk-v-intel)] hover:ring-1 hover:ring-[var(--wk-v-intel)]/20 cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{getFlagEmoji(pavilion.flag)}</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">{pavilion.type}</span>
                </div>
                <h3 className="text-[16px] font-bold text-[var(--wk-text)] mb-1">{pavilion.country}</h3>
                <p className="text-[13px] italic text-[var(--wk-text-soft)] mb-2">{pavilion.title}</p>
                <p className="text-[12px] text-[var(--wk-text-muted)] mb-3">{pavilion.venue}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[var(--wk-v-intel)] group-hover:underline">View details</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--wk-surface-raised)] text-[11px] font-bold text-[var(--wk-text-faint)]">{pavilion.number}</span>
                </div>
              </button>
            ))}
          </div>

          {(data.fieldNote || data.field_note) && (
            <p className="mt-10 text-[14px] leading-relaxed text-[var(--wk-text-muted)] max-w-[720px]">
              {data.fieldNote || data.field_note}
            </p>
          )}
        </div>
      </section>

      {activePavilionData && (
        <PavilionModal pavilion={activePavilionData} isOpen={!!activePavilion} onClose={() => setActivePavilion(null)} />
      )}
    </>
  );
}