import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { WkSearchField } from "@/components/design-system/primitives/Field";
import { WkViewportControls } from "@/components/data-viz/WkViewportControls";
import { WkGraphLegend } from "@/components/data-viz/WkGraphLegend";
import {
  loadMiziziCaseSubjects, searchMiziziFieldHits, projectMiziziFieldFocus,
  type CaseSubject,
} from "@/services/miziziCaseField";
import type { HeadquartersQueueV2 } from "@/services/miziziHeadquartersBrief";

/** Canvas and floating controls ported from the supplied MIZIZI HTML Field.
 * Only authenticated, exact-ID Registry review/recording/artist-credit edges
 * enter this graph. No generated catalogue, people, locations or agent activity.
 */
type GraphNode = { key: string; kind: "artist" | "case"; x: number; y: number;
  name: string; status: string; reviewId?: string; };
type GraphLink = { a: string; b: string; status: CaseSubject["status"] };
type Camera = { s: number; x: number; y: number };
type Pointer = { x: number; y: number; sx: number; sy: number; moved: boolean };
type Palette = { text: string; muted: string; brand: string; warning: string; border: string };
function readPalette(canvas: HTMLCanvasElement): Palette {
  const style = getComputedStyle(canvas);
  const token = (name: string) => style.getPropertyValue(name).trim() || "currentColor";
  return {
    text: token("--wk-text"), muted: token("--wk-text-muted"),
    brand: token("--wk-brand"), warning: token("--wk-warning"),
    border: token("--wk-border-strong"),
  };
}
function graphStatusColor(status: string, p: Palette): string {
  return status === "resolved" || status === "active" ? p.brand :
    status === "open" || status === "needs_review" ? p.warning : p.muted;
}
const MIN_ZOOM = .22, MAX_ZOOM = 8;
const hash = (value: string): number => {
  let n = 2166136261;
  for (let i = 0; i < value.length; i++) n = Math.imul(n ^ value.charCodeAt(i), 16777619);
  return n >>> 0;
};
function statusColor(status: string): string {
  return status === "resolved" || status === "active" ? "var(--wk-brand)" :
    status === "open" || status === "needs_review" ? "var(--wk-warning)" : "var(--wk-text-muted)";
}
function statusLabel(status: string): string {
  return status === "resolved" ? "Resolved review" : status === "open" ? "Open review" :
    status === "needs_review" ? "Needs review" : status === "active" ? "Active credit" :
    status === "archived" ? "Archived credit" : "Recorded credit";
}
function buildGraph(cases: readonly CaseSubject[]): { nodes: GraphNode[]; links: GraphLink[] } {
  const artists = new Map<string, { name: string; states: Set<string> }>();
  for (const row of cases) for (const credit of row.artists) {
    if (!credit.id) continue;
    const item = artists.get(credit.id) ?? { name: credit.name, states: new Set<string>() };
    item.states.add(credit.status);
    artists.set(credit.id, item);
  }
  const groups: Array<Array<[string, { name: string; states: Set<string> }]>> =
    [[], [], [], [], []];
  [...artists].sort(([a], [b]) => a.localeCompare(b)).forEach((item) => {
    groups[hash(item[0]) % groups.length].push(item);
  });
  const nodes: GraphNode[] = [], links: GraphLink[] = [];
  const positions = new Map<string, GraphNode>();
  const centers = [[275, 280], [680, 220], [1100, 280], [465, 720], [980, 760]];
  groups.forEach((group, index) => group.forEach(([id, credit], i) => {
    const angle = i * 2.39996323 + (hash(id) % 100) / 300;
    const radius = 16 * Math.sqrt(i + 1);
    const state = credit.states.has("needs_review") ? "needs_review" :
      credit.states.size === 1 && credit.states.has("active") ? "active" :
      credit.states.size === 1 && credit.states.has("archived") ? "archived" : "unknown";
    const node: GraphNode = { key: "artist:" + id, kind: "artist",
      name: credit.name, status: state,
      x: centers[index][0] + Math.cos(angle) * radius,
      y: centers[index][1] + Math.sin(angle) * radius * .78 };
    nodes.push(node); positions.set(node.key, node);
  }));
  const isolated = { x: 780, y: 480 };
  cases.forEach((row, index) => {
    const anchor = row.artists.map(credit => positions.get("artist:" + credit.id)).find(Boolean);
    const seed = hash(row.reviewId);
    const angle = (seed % 6283) / 1000, radius = 11 + (seed % 29);
    const node: GraphNode = { key: "case:" + row.reviewId,
      kind: "case", reviewId: row.reviewId, name: row.title, status: row.status,
      x: (anchor?.x ?? isolated.x) + Math.cos(angle) * radius + (index % 3) * 2,
      y: (anchor?.y ?? isolated.y) + Math.sin(angle) * radius };
    nodes.push(node);
    for (const credit of row.artists) if (positions.has("artist:" + credit.id)) {
      links.push({ a: node.key, b: "artist:" + credit.id, status: row.status });
    }
  });
  return { nodes, links };
}
function fitTo(nodes: GraphNode[], width: number, height: number): Camera {
  if (!nodes.length || width <= 0 || height <= 0) return { s: 1, x: 0, y: 0 };
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const padL = width > 980 ? 320 : 24, padT = width > 980 ? 48 : 200;
  const areaW = Math.max(120, width - padL - 35), areaH = Math.max(120, height - padT - 48);
  const s = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM,
    areaW / Math.max(200, maxX - minX), areaH / Math.max(200, maxY - minY)));
  return { s, x: padL + (areaW - (maxX - minX) * s) / 2 - minX * s,
    y: padT + (areaH - (maxY - minY) * s) / 2 - minY * s };
}
export function MiziziReviewField({ queue, onInspect }: {
  queue: HeadquartersQueueV2; onInspect: (id: string) => void;
}) {
  const [cases, setCases] = useState<readonly CaseSubject[]>([]);
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const [chosen, setChosen] = useState<string | null>(null);
  const [camera, setCamera] = useState<Camera>({ s: 1, x: 0, y: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const anim = useRef<number | null>(null);
  const [themeRevision, setThemeRevision] = useState(0);
  const pointers = useRef<Map<number, Pointer>>(new Map());
  const pinch = useRef<{ span: number; s: number; x: number; y: number } | null>(null);
  const [activeStates, setActiveStates] = useState({ open: true, resolved: true });
  useEffect(() => {
    let live = true;
    setLoad("loading");
    void loadMiziziCaseSubjects(queue).then(rows => {
      if (live) { setCases(rows); setLoad("ready"); }
    }, () => { if (live) setLoad("error"); });
    return () => { live = false; };
  }, [queue]);

  const graph = useMemo(() => buildGraph(cases), [cases]);
  const nodesByKey = useMemo(() => new Map(graph.nodes.map(n => [n.key, n])), [graph]);
  const matches = useMemo(() => searchMiziziFieldHits(cases, search, filter), [cases, search, filter]);
  const chosenKey = chosen && matches.some(h => h.key === chosen) ? chosen :
    matches.length === 1 ? matches[0].key : null;
  const focused = chosenKey ? projectMiziziFieldFocus(cases, chosenKey, filter) : null;
  const counts = { open: cases.filter(r => r.status === "open").length,
    resolved: cases.filter(r => r.status === "resolved").length };
  const allowed = useCallback((node: GraphNode): boolean =>
    node.kind === "artist" || (filter === "all" || node.status === filter) &&
      activeStates[node.status as keyof typeof activeStates] !== false,
    [filter, activeStates]);
  const hovered = hover ? nodesByKey.get(hover) : undefined;

  useEffect(() => {
    const update = () => setThemeRevision(x => x + 1);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => () => { if (anim.current !== null) cancelAnimationFrame(anim.current); }, []);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const resize = () => {
      const rect = c.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(rect.width * dpr); c.height = Math.round(rect.height * dpr);
      setViewport({ width: rect.width, height: rect.height });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(c);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (viewport.width && viewport.height && graph.nodes.length) {
      setCamera(fitTo(graph.nodes, viewport.width, viewport.height));
    }
  }, [graph, viewport.width, viewport.height]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !viewport.width) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const palette = readPalette(c);
    const dpr = c.width / viewport.width;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewport.width, viewport.height);
    const screen = (node: GraphNode) => ({ x: node.x * camera.s + camera.x,
      y: node.y * camera.s + camera.y });
    const focusKey = chosenKey ?? hover;
    const focusLinks = new Set<string>();
    if (focusKey) graph.links.forEach(link => {
      if (link.a === focusKey) focusLinks.add(link.b);
      if (link.b === focusKey) focusLinks.add(link.a);
    });
    ctx.lineWidth = 1;
    graph.links.forEach(link => {
      const a = nodesByKey.get(link.a), b = nodesByKey.get(link.b);
      if (!a || !b || !allowed(a)) return;
      const p = screen(a), q = screen(b);
      if ((p.x < -50 && q.x < -50) || (p.y < -50 && q.y < -50) ||
        (p.x > viewport.width + 50 && q.x > viewport.width + 50) ||
        (p.y > viewport.height + 50 && q.y > viewport.height + 50)) return;
      const highlighted = focusKey === a.key || focusKey === b.key;
      ctx.strokeStyle = palette.border;
      ctx.globalAlpha = highlighted ? .9 : focusKey ? .11 : .38;
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo((p.x + q.x) / 2, Math.max(p.y, q.y) + 13 * camera.s, q.x, q.y);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    graph.nodes.forEach(node => {
      if (!allowed(node)) return;
      const p = screen(node);
      if (p.x < -80 || p.x > viewport.width + 80 || p.y < -80 || p.y > viewport.height + 80) return;
      const highlighted = node.key === focusKey || focusLinks.has(node.key);
      ctx.globalAlpha = focusKey && !highlighted ? .15 : 1;
      if (node.kind === "case") {
        const size = Math.max(3, Math.min(7, 3.6 * camera.s));
        ctx.fillStyle = graphStatusColor(node.status, palette);
        ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
      } else {
        const size = Math.max(3, Math.min(8, 3.2 * camera.s));
        ctx.lineWidth = node.status === "needs_review" ? 1.9 : 1.15;
        ctx.strokeStyle = palette.text;
        ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.stroke();
        if (node.status === "needs_review") {
          ctx.beginPath(); ctx.strokeStyle = palette.warning;
          ctx.arc(p.x, p.y, size + 2, 0, Math.PI * 2); ctx.stroke();
        }
      }
      if (highlighted || camera.s > 1.65 && node.kind === "artist") {
        ctx.fillStyle = palette.text; ctx.globalAlpha = 1;
        ctx.font = "600 12px Archivo, Arial, sans-serif";
        ctx.fillText(node.name.length > 32 ? node.name.slice(0, 31) + "…" : node.name,
          p.x + 11, p.y + 4);
      }
    });
    ctx.globalAlpha = 1;
    if (hovered) {
      const p = screen(hovered);
      ctx.beginPath(); ctx.strokeStyle = palette.brand; ctx.lineWidth = 1.5;
      ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.stroke();
    }
  }, [graph, camera, viewport, hovered, chosenKey, nodesByKey, allowed, themeRevision]);

  const findNear = (x: number, y: number): GraphNode | null => {
    let best: GraphNode | null = null, min = 13 * 13;
    for (const node of graph.nodes) {
      if (!allowed(node)) continue;
      const px = node.x * camera.s + camera.x, py = node.y * camera.s + camera.y;
      const dist = (px - x) ** 2 + (py - y) ** 2;
      if (dist < min) { min = dist; best = node; }
    }
    return best;
  };
  const moveCamera = (target: Camera) => {
    if (anim.current !== null) cancelAnimationFrame(anim.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCamera(target); anim.current = null; return;
    }
    const start = camera, began = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - began) / 310), ease = 1 - Math.pow(1 - t, 3);
      setCamera({ s: start.s + (target.s - start.s) * ease,
        x: start.x + (target.x - start.x) * ease, y: start.y + (target.y - start.y) * ease });
      anim.current = t < 1 ? requestAnimationFrame(frame) : null;
    };
    anim.current = requestAnimationFrame(frame);
  };
  const fit = () => moveCamera(fitTo(graph.nodes, viewport.width, viewport.height));
  const zoomAt = (x: number, y: number, factor: number) =>
    setCamera(current => {
      const s = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current.s * factor));
      return { s, x: x - (x - current.x) / current.s * s,
        y: y - (y - current.y) / current.s * s };
    });
  const centerOn = (key: string) => {
    const n = nodesByKey.get(key);
    setChosen(key); setHover(null);
    if (n) {
      const s = Math.max(camera.s, 1.55);
      moveCamera({ s, x: viewport.width * .58 - n.x * s, y: viewport.height * .51 - n.y * s });
    }
  };
  const localPoint = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const p = localPoint(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: p.x, y: p.y, sx: camera.x, sy: camera.y, moved: false });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { span: Math.hypot(a.x - b.x, a.y - b.y), ...camera };
    }
  };
  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    const p = localPoint(e), drag = pointers.current.get(e.pointerId);
    setPointerPos(p);
    if (drag) {
      const dx = p.x - drag.x, dy = p.y - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      if (pointers.current.size === 2 && pinch.current) {
        const values = [...pointers.current.values()];
        const current = values.map((pt, i) => i === [...pointers.current.keys()].indexOf(e.pointerId) ? p : { x: pt.x, y: pt.y });
        const span = Math.hypot(current[0].x - current[1].x, current[0].y - current[1].y);
        const midX = (current[0].x + current[1].x) / 2, midY = (current[0].y + current[1].y) / 2;
        const original = pinch.current, s = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, original.s * span / Math.max(1, original.span)));
        setCamera({ s, x: midX - (midX - original.x) / original.s * s,
          y: midY - (midY - original.y) / original.s * s });
        drag.moved = true;
      } else if (drag.moved) {
        setCamera(current => ({ ...current, x: drag.sx + dx, y: drag.sy + dy }));
      }
      setHover(null);
    } else setHover(findNear(p.x, p.y)?.key ?? null);
  };
  const up = (e: PointerEvent<HTMLCanvasElement>) => {
    const drag = pointers.current.get(e.pointerId), p = localPoint(e);
    pointers.current.delete(e.pointerId);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (!drag || drag.moved) return;
    const node = findNear(p.x, p.y);
    if (node?.kind === "artist") centerOn(node.key);
    else if (node?.reviewId) onInspect(node.reviewId);
    else setChosen(null);
  };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoomAt(event.clientX - rect.left, event.clientY - rect.top, event.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => canvas.removeEventListener("wheel", wheel);
  }, []);

  return (
    <section data-wk-mizizi-field className="field" aria-label="MIZIZI Field">
      <canvas ref={canvasRef} id="fieldCanvas" role="img"
        aria-label={"Authenticated Registry case graph. " + cases.length + " source-linked reviews; each square is a review, each ring is a recorded artist credit. Lines are exact recorded credits."}
        onPointerDown={down} onPointerMove={move} onPointerUp={up}
        onPointerCancel={e => { pointers.current.delete(e.pointerId); pinch.current = null; }}
        onPointerLeave={() => setHover(null)} />
      <div className="mz-field-panel">
        <h2>The Field</h2>
        <p>Explore recorded credits and reviews. Lines connect exact Registry IDs. Scroll to zoom, drag to move.</p>
        <WkSearchField ariaLabel="Find a recorded artist credit, recording, release, or ISRC"
          className="wk-mizizi-search" inputClassName="h-11"
          placeholder="Search artist, recording, or ISRC" value={search}
          onChange={value => { setSearch(value); setChosen(null); }} />
        <div className="chips" aria-label="Recorded case state filters">
          {(["open", "resolved"] as const).map(state => (
            <button key={state} type="button" className="chip"
              aria-pressed={activeStates[state]}
              onClick={() => setActiveStates(current => ({ ...current, [state]: !current[state] }))}>
              <i style={{ background: statusColor(state) }} />
              {state === "open" ? "Open" : "Resolved"} <b>{counts[state]}</b>
            </button>
          ))}
        </div>
        <div className="chips" aria-label="Search result state">
          {(["all", "open", "resolved"] as const).map(value =>
            <button type="button" className="chip" key={value} aria-pressed={filter === value}
              onClick={() => { setFilter(value); setChosen(null); }}>
              {value === "all" ? "All reviews" : value === "open" ? "Open" : "Resolved"}
            </button>)}
        </div>
        {search.trim().length >= 3 && (
          <div className="mz-field-results" aria-label="Matching real MIZIZI subjects">
            {matches.length ? matches.map(hit => <button key={hit.key} type="button"
              aria-pressed={hit.key === chosenKey} onClick={() => centerOn(hit.key)}>
                {hit.label}<small>{hit.subtitle}</small></button>) :
              <p role="status">No recorded review matches this search.</p>}
          </div>
        )}
        <details>
          <summary>Browse reviews as a list</summary>
          <div className="mz-field-access-list" role="list" aria-label="Keyboard-accessible Registry review list">
            {cases.filter(item => (filter === "all" || item.status === filter)
              && activeStates[item.status as keyof typeof activeStates] !== false)
              .filter(item => !search.trim() || item.title.toLowerCase().includes(search.trim().toLowerCase()))
              .slice(0, 20).map(item => (
                <div role="listitem" key={item.reviewId}>
                  <button type="button" onClick={() => onInspect(item.reviewId)}>
                    {item.title} ({statusLabel(item.status)})
                  </button>
                </div>
              ))}
          </div>
          <p className="mz-info-line">Search for more. This list shows at most 20 matching reviews.</p>
        </details>
        <p role="status" className="mz-info-line">
          {load === "loading" ? "Loading current Registry credits…" :
            load === "error" ? "The current case graph could not be loaded." :
              cases.length + " real reviewed recordings and releases · " +
                graph.nodes.filter(n => n.kind === "artist").length + " distinct credited artist IDs"}
        </p>
      </div>
      <WkGraphLegend title="Graph key" items={[
        { id: "recording", label: "Reviewed recording or release", shape: "square" },
        { id: "artist", label: "Recorded artist credit", shape: "ring",
          count: graph.nodes.filter(node => node.kind === "artist").length },
        { id: "open", label: "Open review", shape: "square", tone: "warning",
          count: counts.open, visible: activeStates.open, toggleable: true },
        { id: "resolved", label: "Resolved review", shape: "square", tone: "brand",
          count: counts.resolved, visible: activeStates.resolved, toggleable: true },
        { id: "link", label: "Recorded credit link", shape: "line",
          count: graph.links.length },
      ]} onToggle={id => {
        if (id === "open" || id === "resolved") {
          setActiveStates(current => ({ ...current, [id]: !current[id] }));
        }
      }} footer="Credit links are not rights. Only recorded relationships appear." />
      {hovered && (
        <div role="status" className="mz-field-tooltip" style={{
          left: Math.max(10, Math.min(pointerPos.x + 15, viewport.width - 290)),
          top: Math.max(10, Math.min(pointerPos.y + 12, viewport.height - 94)),
        }}>
          <strong>{hovered.name}</strong>
          <div>{hovered.kind === "case" ? statusLabel(hovered.status) : statusLabel(hovered.status) + " · artist credit"}</div>
          <div>{hovered.kind === "case" ? "Click to inspect its Core" : "Click to explore linked reviews"}</div>
        </div>
      )}
      {focused && <div className="mz-field-detail" aria-live="polite">
        <strong>{focused.name}</strong>
        <p className="mz-info-line">{focused.kind === "artist"
          ? focused.related.length + " linked MIZIZI reviews" :
            focused.credits.length + " recorded artist credits"}</p>
        {focused.kind === "case" && <button onClick={() => onInspect(focused.record.reviewId)}>Inspect Case</button>}
      </div>}
      <WkViewportControls
        onZoomIn={() => zoomAt(viewport.width / 2, viewport.height / 2, 1.3)}
        onZoomOut={() => zoomAt(viewport.width / 2, viewport.height / 2, 1 / 1.3)}
        onFit={() => { setChosen(null); fit(); }}
        canZoomIn={graph.nodes.length > 0 && camera.s < MAX_ZOOM}
        canZoomOut={graph.nodes.length > 0 && camera.s > MIN_ZOOM}
      />
    </section>
  );
}
