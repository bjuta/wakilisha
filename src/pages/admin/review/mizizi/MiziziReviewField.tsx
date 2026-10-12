import { useMemo, useRef, useState, type PointerEvent } from "react";
import { WkSearchField } from "@/components/design-system/primitives/Field";
import { WkIcon } from "@/components/design-system/Icon";
import { WkViewportControls } from "@/components/data-viz/WkViewportControls";
import type { HeadquartersQueueV2, QueueReviewV2 } from "@/services/miziziHeadquartersBrief";

const WIDTH = 1400;
const HEIGHT = 820;
const MIN_ZOOM = 0.8;
const MAX_ZOOM = 4;

type FieldNode = Readonly<{
  id: string; x: number; y: number;
  item: QueueReviewV2;
}>;
type FieldGroup = Readonly<{
  key: string; label: string; x: number; y: number; total: number;
}>;
type FieldProjection = Readonly<{ groups: readonly FieldGroup[]; nodes: readonly FieldNode[] }>;

function stableAngle(id: string): number {
  let h = 2166136261;
  for (const char of id) h = Math.imul(h ^ char.charCodeAt(0), 16777619) >>> 0;
  return (h / 4294967296) * Math.PI * 2;
}

/** Registry review -> recorded workstream edge ONLY.
 * Neither spatial position nor workstream link claims artist/credit/ownership provenance.
 */
export function projectMiziziReviewField(queue: HeadquartersQueueV2): FieldProjection {
  const groups = queue.workstreams.map((group, index) => ({
    key: group.key,
    label: group.label,
    x: 260 + (index % 3) * 445,
    y: 310 + (Math.floor(index / 3) * 350) + (index % 2) * 145,
    total: group.open + group.resolved + group.other,
  }));
  const byGroup = new Map(groups.map((g) => [g.key, g]));
  const indices = new Map<string, number>();
  const nodes: FieldNode[] = [];
  for (const item of queue.items) {
    const group = byGroup.get(item.workstream);
    if (!group) continue;
    const index = indices.get(group.key) ?? 0;
    indices.set(group.key, index + 1);
    const spiral = index * 2.399963229728653 + stableAngle(item.id) * 0.12;
    const radius = 30 + Math.sqrt(index + 1) * 16;
    nodes.push({
      id: item.id,
      item,
      x: group.x + Math.cos(spiral) * radius,
      y: group.y + Math.sin(spiral) * radius * 0.87,
    });
  }
  return { groups, nodes };
}

const tones = ["text-wk-brand", "text-wk-warning", "text-wk-text-muted", "text-wk-text"] as const;
const statusText = { open: "Open", resolved: "Resolved", other: "Other status" } as const;

export function MiziziReviewField({
  queue,
  onInspect,
}: {
  queue: HeadquartersQueueV2;
  onInspect: (id: string) => void;
}) {
  const projection = useMemo(() => projectMiziziReviewField(queue), [queue]);
  const [search, setSearch] = useState("");
  const [workstreams, setWorkstreams] = useState<readonly string[]>(() => queue.workstreams.map((x) => x.key));
  const [status, setStatus] = useState<"all" | "open" | "resolved">("all");
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const drag = useRef<{ clientX: number; clientY: number; x: number; y: number; dragged: boolean } | null>(null);
  const suppressNodeClick = useRef(false);
  const query = search.trim().toLocaleLowerCase();
  const activeGroups = new Set(workstreams);
  const matching = projection.nodes.filter(({ item }) => activeGroups.has(item.workstream) &&
    (status === "all" || item.status === status) &&
    (!query || [item.title, item.workstreamLabel, item.id, item.subjectType]
      .some((value) => value.toLocaleLowerCase().includes(query))));
  const allowed = new Set(matching.map((n) => n.id));
  const groupIndex = new Map(projection.groups.map((g, index) => [g.key, index]));
  const groupById = new Map(projection.groups.map((g) => [g.key, g]));
  const viewWidth = WIDTH / camera.zoom;
  const viewHeight = HEIGHT / camera.zoom;

  const zoom = (factor: number) => setCamera((current) => {
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current.zoom * factor));
    const centerX = current.x + WIDTH / (current.zoom * 2);
    const centerY = current.y + HEIGHT / (current.zoom * 2);
    return { zoom: next, x: centerX - WIDTH / (next * 2), y: centerY - HEIGHT / (next * 2) };
  });
  const fit = () => setCamera({ x: 0, y: 0, zoom: 1 });
  const moveStart = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    suppressNodeClick.current = false;
    drag.current = { clientX: e.clientX, clientY: e.clientY, x: camera.x, y: camera.y, dragged: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<SVGSVGElement>) => {
    const prev = drag.current;
    if (!prev) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const dx = e.clientX - prev.clientX;
    const dy = e.clientY - prev.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 3) prev.dragged = true;
    if (prev.dragged) setCamera((current) => ({
      ...current,
      x: prev.x - dx * WIDTH / (bounds.width * current.zoom),
      y: prev.y - dy * HEIGHT / (bounds.height * current.zoom),
    }));
  };
  const release = (e: PointerEvent<SVGSVGElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    suppressNodeClick.current = Boolean(drag.current?.dragged);
    drag.current = null;
  };

  return (
    <section data-wk-mizizi-field aria-label="Registry review Field"
      className="relative min-h-[590px] h-[min(76vh,850px)] overflow-hidden border-y border-wk-border bg-wk-surface">
      <svg className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
        role="img" aria-label={`Registry review landscape, ${matching.length} visible cases grouped by recorded workstream. This is not a map of musical credits.`}
        viewBox={`${camera.x} ${camera.y} ${viewWidth} ${viewHeight}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={moveStart} onPointerMove={move} onPointerUp={release} onPointerCancel={release}>
        <defs><pattern id="wk-mizizi-field-grid" width="42" height="42" patternUnits="userSpaceOnUse">
          <path d="M42 0H0V42" fill="none" stroke="currentColor" strokeOpacity=".07" strokeWidth=".7" />
        </pattern></defs>
        <rect x="-2000" y="-2000" width="5400" height="5400" fill="url(#wk-mizizi-field-grid)" className="text-wk-text-muted" />
        {projection.nodes.filter((n) => allowed.has(n.id)).map((node) => {
          const group = groupById.get(node.item.workstream);
          return group ? (
            <line key={`edge-${node.id}`} x1={group.x} y1={group.y} x2={node.x} y2={node.y}
              stroke="currentColor" strokeOpacity=".12" strokeWidth="1.1"
              className="text-wk-text-muted" />
          ) : null;
        })}
        {projection.groups.filter((g) => activeGroups.has(g.key)).map((group) => {
          const color = tones[(groupIndex.get(group.key) ?? 0) % tones.length];
          return (
            <g key={group.key} className={color}>
              <circle cx={group.x} cy={group.y} r="22" fill="currentColor" fillOpacity=".13"
                stroke="currentColor" strokeWidth="2" />
              <circle cx={group.x} cy={group.y} r="5.5" fill="currentColor" />
              <text x={group.x} y={group.y - 38} textAnchor="middle" fontSize="17"
                fontWeight="700" fill="currentColor">{group.label}</text>
              <text x={group.x} y={group.y + 46} textAnchor="middle" fontSize="12"
                fill="currentColor">{group.total.toLocaleString()} reviews</text>
            </g>
          );
        })}
        {projection.nodes.filter((n) => allowed.has(n.id)).map(({ id, x, y, item }) => (
          <g key={id} className={item.status === "open" ? "text-wk-warning" :
            item.status === "resolved" ? "text-wk-brand" : "text-wk-text-muted"}
            role="button" tabIndex={-1}
            aria-label={`${item.title}; ${statusText[item.status]}; open evidence`}
            onClick={() => { if (!suppressNodeClick.current) onInspect(id); }}>
            <title>{`${item.title} · ${statusText[item.status]} · ${item.workstreamLabel}`}</title>
            {item.subjectType === "track" || item.subjectType === "release" ?
              <rect x={x-4} y={y-4} width="8" height="8" fill="currentColor" stroke="currentColor" strokeWidth=".7" /> :
              <circle cx={x} cy={y} r="4.5" fill="none" stroke="currentColor" strokeWidth="2" />}
            <circle cx={x} cy={y} r="13" fill="transparent" stroke="none" />
          </g>
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between gap-4">
        <div className="pointer-events-auto max-h-[calc(100%-20px)] w-[min(310px,calc(100%-70px))] overflow-auto border-b border-r border-wk-border bg-wk-surface/95 px-4 py-4 backdrop-blur-sm">
          <div className="mb-4 flex items-center gap-2">
            <WkIcon name="Network" size={17} className="text-wk-brand" aria-hidden="true" />
            <h2 className="text-[18px] font-black text-wk-text">The Field</h2>
          </div>
          <div className="border-b border-wk-border pb-4">
            <WkSearchField ariaLabel="Find a review, source or workstream"
              placeholder="Find a review or source ID" value={search} onChange={setSearch}
              inputClassName="!rounded-md" />
            <p className="mt-2 text-[11px] tabular-nums text-wk-text-muted">
              {matching.length.toLocaleString()} of {queue.total.toLocaleString()} reviews
            </p>
            {query ? (
              <div className="mt-2 max-h-44 overflow-auto border-t border-wk-border" role="list">
                {matching.slice(0, 8).map(({ item }) => (
                  <button role="listitem" type="button" key={item.id} onClick={() => onInspect(item.id)}
                    className="block w-full border-b border-wk-border py-2 text-left text-[12px] text-wk-text hover:text-wk-brand">
                    <span className="block font-semibold">{item.title}</span>
                    <span className="text-[11px] text-wk-text-muted">{item.subjectType} · {item.workstreamLabel}</span>
                  </button>
                ))}
                {!matching.length ? <p role="status" className="py-3 text-[12px] text-wk-text-muted">No matching reviews.</p> : null}
              </div>
            ) : null}
          </div>
          <div className="border-b border-wk-border py-3" aria-label="Filter by review status">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-wk-text-muted">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {(["all","open","resolved"] as const).map((value) => (
                <button key={value} type="button" aria-pressed={status === value}
                  onClick={() => setStatus(value)}
                  className={`border px-2.5 py-1.5 text-[12px] font-semibold ${status === value
                    ? "border-wk-brand bg-wk-brand-soft text-wk-brand"
                    : "border-wk-border bg-wk-surface text-wk-text-muted hover:bg-wk-surface-raised"}`}>
                  {value === "all" ? "All" : statusText[value]}
                </button>
              ))}
            </div>
          </div>
          <div className="pt-3" aria-label="Workstream keys and filters">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-wk-text-muted">Workstreams</p>
            {projection.groups.map((group, i) => (
              <button key={group.key} type="button"
                aria-pressed={activeGroups.has(group.key)}
                onClick={() => setWorkstreams((old) => old.includes(group.key)
                  ? old.filter((key) => key !== group.key) : [...old, group.key])}
                className={`flex w-full items-center gap-2 border-t border-wk-border py-2 text-left text-[12px] ${activeGroups.has(group.key)
                  ? "text-wk-text" : "text-wk-text-muted opacity-50"}`}>
                <span className={`h-2.5 w-2.5 shrink-0 ${tones[i % tones.length].replace("text-","bg-")}`} aria-hidden="true" />
                <span className="min-w-0 flex-1 leading-4">{group.label}</span>
                <span className="shrink-0 tabular-nums text-wk-text-muted">{group.total}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="pointer-events-auto hidden shrink-0 border-b border-l border-wk-border bg-wk-surface/95 px-4 py-3 text-[11px] text-wk-text-muted backdrop-blur-sm md:block"
          aria-label="Field visual key">
          <div className="mb-2 flex items-center gap-2"><span className="h-2 w-2 bg-wk-brand" /> Track or release review</div>
          <div className="mb-2 flex items-center gap-2"><span className="h-2 w-2 rounded-full border-2 border-wk-text-muted" /> Other review</div>
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full border-2 border-wk-brand" /> Recorded workstream</div>
        </div>
      </div>
      <div className="absolute bottom-4 left-4 max-w-[min(65%,380px)] border-l-2 border-wk-brand bg-wk-surface/90 px-3 py-2 text-[11px] leading-4 text-wk-text-muted">
        Connected by review workstream, not by inferred artist or recording credits.
      </div>
      <WkViewportControls onZoomIn={() => zoom(1.25)} onZoomOut={() => zoom(0.8)}
        onFit={fit} canZoomIn={camera.zoom < MAX_ZOOM} canZoomOut={camera.zoom > MIN_ZOOM} />
    </section>
  );
}
