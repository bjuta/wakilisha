import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { WkSearchField } from "@/components/design-system/primitives/Field";
import { WkViewportControls } from "@/components/data-viz/WkViewportControls";
import {
  loadMiziziCaseSubjects, searchMiziziFieldHits, projectMiziziFieldFocus,
  type CaseSubject,
} from "@/services/miziziCaseField";
import type { HeadquartersQueueV2 } from "@/services/miziziHeadquartersBrief";

const W = 1200, H = 760, X = 755, Y = 360;
const MIN = 0.7, MAX = 3.4;
type Camera = { x: number; y: number; zoom: number };
const INITIAL: Camera = { x: 0, y: 0, zoom: 1 };
function tone(value: string) {
  return value === "resolved" || value === "active" ? "text-wk-brand" :
    value === "open" || value === "needs_review" ? "text-wk-warning" :
    "text-wk-text-muted";
}
function stateLabel(value: string) {
  return value === "needs_review" ? "Needs review" :
    value === "active" ? "Active credit" :
    value === "archived" ? "Archived credit" :
    value === "resolved" ? "Resolved review" :
    value === "open" ? "Open review" : "Recorded credit";
}
function label(value: string, max = 20) {
  return value.length > max ? value.slice(0, max - 1) + "…" : value;
}
function layout(index: number, count: number) {
  // A right-facing arc leaves the search and selection rail free.
  const radians = count === 1 ? 0 : -1.35 + (index * 2.7) / (count - 1);
  const distance = count < 5 ? 195 : 240;
  return { x: X + Math.cos(radians) * distance,
    y: Y + Math.sin(radians) * distance };
}
export function MiziziReviewField({
  queue, onInspect,
}: { queue: HeadquartersQueueV2; onInspect: (id: string) => void }) {
  const [cases, setCases] = useState<readonly CaseSubject[]>([]);
  const [loadState, setLoadState] = useState<"loading"|"ready"|"error">("loading");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all"|"open"|"resolved">("all");
  const [chosen, setChosen] = useState<string|null>(null);
  const [camera, setCamera] = useState<Camera>(INITIAL);
  const svg = useRef<SVGSVGElement|null>(null);
  const drag = useRef<{ px:number;py:number;x:number;y:number;active:boolean }|null>(null);
  useEffect(() => {
    let live = true;
    setLoadState("loading");
    void loadMiziziCaseSubjects(queue).then(rows => {
      if (live) { setCases(rows); setLoadState("ready"); }
    }, () => { if (live) setLoadState("error"); });
    return () => { live = false; };
  }, [queue]);
  const matches = useMemo(() => searchMiziziFieldHits(cases, search, filter),
    [cases, search, filter]);
  const selectedKey = chosen && matches.some(item => item.key === chosen) ? chosen :
    matches.length === 1 ? matches[0].key : null;
  const focused = useMemo(() => selectedKey
    ? projectMiziziFieldFocus(cases, selectedKey, filter) : null, [cases, selectedKey, filter]);
  const links = focused?.kind === "artist"
    ? focused.related.map(item => ({
      key: "case:" + item.reviewId, name: item.title,
      detail: stateLabel(item.status), state: item.status,
      kind: "case" as const, record: item,
    }))
    : focused?.kind === "case"
      ? focused.credits.map((credit, i) => ({
        key: "artist:" + credit.id + ":" + i,
        name: credit.name, detail: stateLabel(credit.status) +
          (credit.slug ? " · " + credit.slug : ""),
        state: credit.status, kind: "artist" as const, artistId: credit.id,
      }))
      : [];
  const plotted = links.slice(0, 9);
  const zoom = (factor: number) => setCamera(current => {
    const next = Math.max(MIN, Math.min(MAX, current.zoom * factor));
    const middleX = current.x + W / (2 * current.zoom);
    const middleY = current.y + H / (2 * current.zoom);
    return { zoom: next, x: middleX - W / (2 * next),
      y: middleY - H / (2 * next) };
  });
  const fit = () => setCamera(INITIAL);
  const select = (key: string) => { setChosen(key); fit(); };
  // Zoom with a mouse wheel or trackpad. Buttons remain a secondary control.
  useEffect(() => {
    const target = svg.current;
    if (!target || !focused) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoom(event.deltaY < 0 ? 1.1 : 1 / 1.1);
    };
    target.addEventListener("wheel", onWheel, { passive: false });
    return () => target.removeEventListener("wheel", onWheel);
  }, [Boolean(focused)]);
  const down = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || (e.target as Element).closest?.("[data-field-node]")) return;
    drag.current = { px:e.clientX, py:e.clientY, x:camera.x, y:camera.y, active:false };
  };
  const move = (e: PointerEvent<SVGSVGElement>) => {
    const previous = drag.current;
    if (!previous) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const dx = e.clientX - previous.px, dy = e.clientY - previous.py;
    if (Math.abs(dx) + Math.abs(dy) > 5) previous.active = true;
    if (!previous.active) return;
    if (!e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.setPointerCapture(e.pointerId);
    setCamera(current => ({ ...current,
      x: previous.x - dx * W / (bounds.width * current.zoom),
      y: previous.y - dy * H / (bounds.height * current.zoom) }));
  };
  const up = (e: PointerEvent<SVGSVGElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = null;
  };
  const openCase = focused?.kind === "case" ? focused.record : null;
  const pickLink = (item: (typeof plotted)[number]) =>
    select(item.kind === "case" ? item.key : "artist:" + item.artistId);
  return (
    <section data-wk-mizizi-field aria-label="MIZIZI Field"
      className="relative h-[min(76vh,850px)] min-h-[580px] overflow-hidden border-y border-wk-border bg-wk-surface">
      <svg ref={svg} role="group" aria-label="Actual MIZIZI cases and recorded artist credits"
        className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
        viewBox={camera.x + " " + camera.y + " " + W / camera.zoom + " " + H / camera.zoom}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {focused ? (
          <>
            <g stroke="currentColor" strokeOpacity=".28" strokeWidth="1.5"
              className="text-wk-text-muted">
              {plotted.map((item, i) => {
                const pt = layout(i, plotted.length);
                return <line key={item.key} x1={X} y1={Y} x2={pt.x} y2={pt.y} />;
              })}
            </g>
            <circle cx={X} cy={Y} r="75" stroke="currentColor" strokeWidth="2"
              fill="currentColor" fillOpacity=".08"
              className={tone(focused.kind === "artist" ? focused.creditState : openCase?.status ?? "other")} />
            <text x={X} y={Y-10} textAnchor="middle" fontSize="19" fontWeight="700"
              fill="currentColor" className="text-wk-text">{label(focused.name, 22)}</text>
            <text x={X} y={Y+15} textAnchor="middle" fontSize="12"
              fill="currentColor" className="text-wk-text-muted">
              {focused.kind === "artist"
                ? (focused.creditState === "unknown" ? "Recorded artist credit" :
                    stateLabel(focused.creditState) + " · artist credit")
                : openCase?.kind === "track" ? "Reviewed recording" : "Reviewed release"}
            </text>
            {plotted.map((item, i) => {
              const pt = layout(i, plotted.length);
              return <g key={item.key} data-field-node role="button" tabIndex={0}
                aria-label={item.name + ". " + item.detail + ". Explore"}
                onClick={() => pickLink(item)}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault(); pickLink(item);
                  }
                }} className={tone(item.state)}>
                <title>{item.name + " · " + item.detail}</title>
                {item.kind === "artist"
                  ? <circle cx={pt.x} cy={pt.y} r="30" stroke="currentColor"
                    strokeWidth="2" fill="currentColor" fillOpacity=".10" />
                  : <rect x={pt.x-29} y={pt.y-29} width="58" height="58" rx="5"
                    stroke="currentColor" strokeWidth="2"
                    fill="currentColor" fillOpacity=".10" />}
                <text x={pt.x} y={pt.y+45} textAnchor="middle" fontSize="13"
                  fontWeight="650" fill="currentColor" className="text-wk-text">
                  {label(item.name, 22)}
                </text>
                <text x={pt.x} y={pt.y+60} textAnchor="middle" fontSize="11"
                  fill="currentColor" className="text-wk-text-muted">
                  {label(item.detail, 25)}
                </text>
              </g>;
            })}
          </>
        ) : <g aria-hidden="true" fill="currentColor" className="text-wk-text-muted">
          <circle cx={X} cy={Y} r="40" fillOpacity=".05"
            stroke="currentColor" strokeOpacity=".24" />
          <text x={X} y={Y+67} textAnchor="middle" fontSize="16">
            {search.trim().length < 3 ? "Search to begin" :
              matches.length > 1 ? "Choose a subject to explore" :
              loadState === "error" ? "Could not load cases" : "No related cases found"}
          </text>
        </g>}
      </svg>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between">
        <div className="pointer-events-auto flex w-[min(335px,82%)] max-h-[min(74vh,640px)] flex-col border-b border-r border-wk-border bg-wk-surface/95 p-4">
          <h2 className="mb-3 text-[18px] font-black text-wk-text">The Field</h2>
          <WkSearchField ariaLabel="Find an artist, recording, release or ISRC in real MIZIZI cases"
            placeholder="Artist, recording, ISRC…" value={search}
            onChange={value => { setSearch(value); setChosen(null); fit(); }}
            inputClassName="!rounded-md" />
          <p className="mt-2 text-[11px] text-wk-text-muted" aria-live="polite">
            {loadState === "loading" ? "Reading recorded cases…" :
              loadState === "error" ? "Case records unavailable" :
              search.trim().length < 3 ? "Type at least three characters" :
              matches.length + " matching subjects"}
          </p>
          <div className="mt-3 flex gap-1 border-b border-wk-border"
            aria-label="Case state filters">
            {(["all","open","resolved"] as const).map(value => (
              <button key={value} type="button" aria-pressed={filter === value}
                onClick={() => { setFilter(value); setChosen(null); fit(); }}
                className={"border-b-2 px-2 py-2 text-[12px] font-semibold " +
                  (filter === value ? "border-wk-brand text-wk-text" :
                    "border-transparent text-wk-text-muted hover:text-wk-text")}>
                {value === "all" ? "All" : value === "open" ? "Open" : "Resolved"}
              </button>))}
          </div>
          {matches.length > 0 && (
            <div role="list" aria-label="Matching real case subjects"
              className="mt-1 min-h-0 overflow-y-auto">
              {matches.map(hit => (
                <button key={hit.key} role="listitem" type="button"
                  aria-pressed={selectedKey === hit.key} onClick={() => select(hit.key)}
                  className={"block w-full border-b border-wk-border py-3 text-left " +
                    (selectedKey === hit.key ? "text-wk-brand" : "text-wk-text hover:text-wk-brand")}>
                  <span className="block text-[13px] font-semibold">{hit.label}</span>
                  <span className="mt-1 block text-[11px] leading-4 text-wk-text-muted">
                    {hit.subtitle}</span>
                </button>
              ))}
            </div>
          )}
          {focused && (
            <div className="mt-3 border-t border-wk-border pt-2 text-[11px]">
              <span className="font-semibold text-wk-text">{links.length} recorded connections</span>
              {links.length > plotted.length &&
                <span className="ml-2 text-wk-text-muted">
                  {plotted.length} on canvas, all available below
                </span>}
              {links.length > plotted.length && (
                <div className="mt-2 max-h-28 overflow-auto">
                  {links.map(link => (
                    <button key={link.key} type="button" onClick={() => pickLink(link)}
                      className="block w-full border-b border-wk-border py-1.5 text-left text-wk-text">
                      {link.name} <span className="text-wk-text-muted">· {link.detail}</span>
                    </button>))}
                </div>
              )}
            </div>
          )}
          {search.trim().length >= 3 && loadState === "ready" && !matches.length &&
            <p role="status" className="mt-3 text-[12px] text-wk-text-muted">
              No existing MIZIZI review matches this search.
            </p>}
        </div>
        <div className="pointer-events-auto hidden max-w-[222px] shrink-0 self-start border-b border-l border-wk-border bg-wk-surface/95 px-3 py-3 text-[11px] leading-5 text-wk-text-muted md:block"
          aria-label="Case state key">
          <p className="font-semibold text-wk-text">Reading the Field</p>
          <p className="mt-2">○ Artist-credit identity</p>
          <p>□ Reviewed recording or release</p>
          <div className="my-2 border-t border-wk-border" aria-hidden="true" />
          <p><span className="text-wk-warning">●</span> Open / needs review</p>
          <p><span className="text-wk-brand">●</span> Resolved / active</p>
          <p>○ Archived or unknown. Not approved.</p>
          <p className="mt-2">Lines show recorded credit links, not rights.</p>
        </div>
      </div>
      {focused && (
        <div className="absolute bottom-4 left-4 max-w-[min(60%,390px)] border-l-2 border-wk-brand bg-wk-surface/95 p-3">
          <p className="text-[13px] font-semibold text-wk-text">{focused.name}</p>
          <p className="mt-1 text-[11px] text-wk-text-muted">
            {focused.kind === "artist" ? focused.related.length + " linked MIZIZI reviews" :
              focused.credits.length + " recorded artist credits"}
          </p>
          {openCase && <button type="button" onClick={() => onInspect(openCase.reviewId)}
            className="mt-2 text-[12px] font-semibold text-wk-brand">Inspect Case →</button>}
          {focused.kind === "artist" && focused.related.length === 1 &&
            <button type="button" onClick={() => onInspect(focused.related[0].reviewId)}
              className="mt-2 text-[12px] font-semibold text-wk-brand">Inspect Case →</button>}
        </div>
      )}
      <WkViewportControls onZoomIn={() => zoom(1.22)}
        onZoomOut={() => zoom(1/1.22)} onFit={fit}
        canZoomIn={camera.zoom < MAX} canZoomOut={camera.zoom > MIN} />
    </section>
  );
}
