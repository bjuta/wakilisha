// briefing-handler — WAKILISHA email briefing infrastructure
// v10.1: 10 briefings, catalog-driven, app-matching styles + CD-specific rendering fixes
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SU = Deno.env.get("SUPABASE_URL")!;
const SK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RAK = Deno.env.get("RESEND_API_KEY") || "";
const RFE = Deno.env.get("RESEND_FROM_EMAIL") || "briefings@wakilisha.africa";
const RFN = Deno.env.get("RESEND_FROM_NAME") || "WAKILISHA";
const CS = Deno.env.get("CRON_SECRET") || "";
const RW = Deno.env.get("RESEND_WEBHOOK_SECRET") || "";

const MDS: Record<string, string[]> = {
  featured_routes: ["articles"], lead_editorial: ["articles"], story_grid: ["articles"],
  quote_thread: ["articles"], archive_reads: ["guides"], archive_routes: ["guides"],
  keep_going: ["articles", "releases", "guides"], field_notes: ["articles"],
  route_cards: ["articles", "releases", "guides"], listen_read_routes: ["articles", "releases"],
  save_routes: ["articles", "guides"], listen_read_go: ["releases", "articles"],
  diaspora_lead: ["articles"], distance_cards: ["articles"], memory_archive: ["guides"],
  discovery_routes: ["articles", "releases"],
  chart_pulse: ["charts"], chart_lead: ["charts"], ranked_artwork_tiles: ["charts"],
  movement_board: ["charts"], archive_chart_route: ["charts"], chart_context: ["releases", "charts"],
  artist_motion: ["artists"], artist_wall: ["artists"], featured_artist: ["artists"],
  signal_tiles: ["artists"], related_routes: ["artists", "releases"],
  artist_routes: ["artists", "releases"], new_voice_wall: ["artists"],
  spotlight_card: ["artists"], first_signal_tiles: ["artists"],
  release_lead: ["releases"], cover_grid: ["releases"], release_activity: ["releases"],
  guide_hero: ["guides"], numbered_methods: ["guides"],
  agenda_hero: ["articles"], day_cards: ["articles", "releases"],
  label_cards: ["labels"], roster_motion: ["artists"], industry_routes: ["articles", "guides"],
};

function ml(n: string): string {
  return n.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
}

function sl(t: string, origin: string): string {
  if (t === "articles") return `${origin}/magazine`;
  if (t === "charts") return `${origin}/charts`;
  if (t === "artists") return `${origin}/artists`;
  if (t === "releases") return `${origin}/releases`;
  if (t === "guides") return `${origin}/guides`;
  if (t === "labels") return `${origin}/labels`;
  return origin;
}

function sll(t: string): string {
  if (t === "articles") return "Open magazine";
  if (t === "charts") return "Open charts";
  if (t === "artists") return "Open artists";
  if (t === "releases") return "Open releases";
  if (t === "guides") return "Open guides";
  if (t === "labels") return "Open labels";
  return "";
}

const SPECIAL = new Set(["featured_routes", "lead_editorial", "chart_pulse", "chart_lead", "guide_hero"]);

const AO = [
  "https://wakilisha.africa", "https://www.wakilisha.africa",
  "https://staging.wakilisha.africa", "https://wakilisha.africa", "https://wakilisha.africa",
  "https://wakilisha.africa", "http://localhost:5173", "http://localhost:4173", "http://localhost:3000"
];

function cR(r: Request, m = "GET, POST, OPTIONS"): Record<string, string> {
  const o = r.headers.get("Origin") ?? "";
  const ir = o.endsWith(".wakilisha.africa") || o === "https://wakilisha.africa";
  const ao = AO.includes(o) || ir ? o : AO[0];
  return {
    "Access-Control-Allow-Origin": ao,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
    "Access-Control-Allow-Methods": m,
    "Vary": "Origin"
  };
}

const ri = () => crypto.randomUUID().slice(0, 12);
const is = () => new Date().toISOString();

function jO(d: any, c: Record<string, string>, s = 200, extra?: Record<string, string>) {
  return new Response(JSON.stringify({ ok: true, data: d, meta: { requestId: ri(), servedAt: is() } }), {
    status: s, headers: { ...c, ...(extra ?? {}), "Content-Type": "application/json" }
  });
}
function jE(code: string, msg: string, c: Record<string, string>, s = 400, det?: string) {
  return new Response(JSON.stringify({
    ok: false, error: { code, message: msg, ...(det ? { detail: det } : {}) },
    meta: { requestId: ri(), servedAt: is() }
  }), { status: s, headers: { ...c, "Content-Type": "application/json" } });
}

async function sendEmail(to: string, subject: string, html: string, text: string, tags?: { name: string; value: string }[], headers?: Record<string, string>) {
  if (!RAK) throw new Error("RESEND_API_KEY not configured");
  const from = `${RFN} <${RFE}>`;
  const payload: any = { from, to: [to], subject, html, text, ...(tags ? { tags } : {}) };
  if (headers) payload.headers = headers;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RAK}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const d = await res.json().catch(() => null) as any;
  if (!res.ok) throw new Error(typeof d?.message === "string" ? d.message : `Resend ${res.status}`);
  return d;
}

const eH = (v: string) => v.replace(/[&<>'"]/g, (ch: string) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch] ?? ch)
);

interface Branding { brandName: string; brandLogoUrl: string; brandFaviconUrl: string; }
const defaultBranding: Branding = { brandName: "WAKILISHA", brandLogoUrl: "", brandFaviconUrl: "" };

function logoHtml(logoUrl: string, brandName: string, size: number): string {
  if (logoUrl) return `<img src="${eH(logoUrl)}" alt="${eH(brandName)}" style="height:${size}px;max-width:180px;object-fit:contain;display:block" />`;
  return `<div style="font-weight:900;letter-spacing:-0.04em;font-size:${size}px;color:#0C0D0A">${eH(brandName)}</div>`;
}

function formatDisplayDate(raw: string): string {
  try {
    const d = new Date(raw); if (Number.isNaN(d.getTime())) return raw;
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const dayName = days[d.getDay()]; const month = months[d.getMonth()]; const date = d.getDate(); const year = d.getFullYear();
    const suffix = date === 1 || date === 21 || date === 31 ? "st" : date === 2 || date === 22 ? "nd" : date === 3 || date === 23 ? "rd" : "th";
    return `${dayName}, ${month} ${date}${suffix}, ${year}`;
  } catch { return raw; }
}

interface SectionItem {
  slug?: string; title?: string; name?: string; track_title?: string; artist_name?: string;
  artist?: string; display_name?: string; excerpt?: string; bio_excerpt?: string;
  contextText?: string; description?: string; image_url?: string; artwork_url?: string;
  imageUrl?: string; hero_url?: string; heroUrl?: string; coverUrl?: string;
  rank?: number; movement?: string; movementAmount?: number; type?: string;
  release_type?: string; author?: string; published_at?: string; url?: string;
  link?: string; genre?: string; label?: string; duration?: string;
  edition_slug?: string; chart_name?: string; readingTime?: number; date?: string;
  section?: string; country?: string; artistCount?: number; trackCount?: number; accentVar?: string;
}

interface ContentSection { title: string; type: string; items: SectionItem[]; layout?: string; }
interface CuratedContent { sections: ContentSection[]; intro?: string; outro?: string; subject?: string; }

function resolveImg(item: SectionItem): string {
  return item.artwork_url || item.image_url || item.imageUrl || item.coverUrl || item.hero_url || item.heroUrl || "";
}
function resolveTitle(item: SectionItem): string {
  return item.title || item.name || item.display_name || item.track_title || "";
}
function resolveSubtitle(item: SectionItem): string {
  return item.artist || item.artist_name || item.author || item.genre || item.label || "";
}
function readingTimeLabel(item: SectionItem): string {
  return item.readingTime ? `${item.readingTime} min read` : "";
}
function dateLabel(item: SectionItem): string {
  if (!item.published_at) return "";
  try { const d = new Date(item.published_at); if (Number.isNaN(d.getTime())) return ""; return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch { return ""; }
}

const CHART_RANK_COLORS: Record<number, string> = { 1: "#C9A96E", 2: "#A8A8A8", 3: "#B87333" };
function chartRankColor(rank: number | undefined, accent: string): string {
  if (rank && CHART_RANK_COLORS[rank]) return CHART_RANK_COLORS[rank];
  return accent;
}
function movementBadge(m: string | undefined): string {
  if (m === "up") return '<span style="color:#2D9E5B;font-weight:800;">&#9650;</span>';
  if (m === "down") return '<span style="color:#C24545;font-weight:800;">&#9660;</span>';
  if (m === "new") return '<span style="display:inline-block;background:rgba(92,142,37,.12);color:#5C8E25;font-weight:800;font-size:10px;line-height:1;padding:2px 6px;border-radius:99px;">NEW</span>';
  return '<span style="color:#9A9C8E;font-weight:800;">&mdash;</span>';
}
function findSectionUnused(curated: CuratedContent, types: string[], consumed: Set<number>): ContentSection | undefined {
  return (curated.sections || []).find((sec, idx) => types.includes(sec.type) && sec.items && sec.items.length > 0 && !consumed.has(idx));
}

const FNT = `Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif`;

function genStoryCardRows(items: SectionItem[], origin: string, accent: string): string {
  const s = eH; const rows: string[] = [];
  for (const it of items) {
    const img = resolveImg(it); const title = resolveTitle(it); const cat = it.section || "";
    const link = it.url || it.link || getEntityUrl(origin, "articles", it);
    const imgHtml = img
      ? `<div style="width:100%;aspect-ratio:16/9;border-radius:12px 12px 0 0;overflow:hidden;background:#EEF1E8;"><img src="${s(img)}" alt="${s(title)}" width="100%" style="display:block;border:0;outline:none;width:100%;height:100%;object-fit:cover;"></div>`
      : `<div style="width:100%;aspect-ratio:16/9;border-radius:12px 12px 0 0;background:#EEF1E8;display:flex;align-items:center;justify-content:center;"><span style="font-size:36px;font-weight:900;color:#C4C8BC;">${s(title.charAt(0).toUpperCase())}</span></div>`;
    rows.push(`<table role="presentation" width="100%" class="wk-card" style="border:1px solid rgba(12,13,10,.14);border-radius:14px;overflow:hidden;background:#FFFFFF;">
<tr><td style="padding:0;">${imgHtml}</td></tr>
<tr><td style="padding:16px;">
${cat ? `<div class="wk-eyebrow" style="font-family:${FNT};font-size:10px;line-height:1;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:${s(accent)};display:flex;align-items:center;gap:8px;margin-bottom:10px;"><span style="display:inline-block;width:20px;height:1px;background:${s(accent)};flex:none;"></span>${s(cat)}</div>` : ""}
<h3 class="wk-h3" style="margin:0 0 6px;font-family:${FNT};font-size:18px;line-height:1.15;font-weight:800;letter-spacing:-.02em;color:#0C0D0A;"><a href="${s(link)}" style="color:#0C0D0A;text-decoration:none;">${s(title)}</a></h3>
<p class="wk-muted" style="margin:0;font-family:${FNT};font-size:12px;line-height:1.5;color:#6B6E62;">${s(dateLabel(it))}${readingTimeLabel(it) ? ` &middot; ${s(readingTimeLabel(it))}` : ""}</p>
</td></tr>
</table>`);
    if (items.indexOf(it) < items.length - 1) rows.push(`<div style="height:16px;"></div>`);
  }
  return rows.join("");
}

function genStoryFeaturedRows(items: SectionItem[], origin: string, accent: string): string {
  const s = eH; const rows: string[] = [];
  for (const it of items) {
    const img = resolveImg(it); const title = resolveTitle(it); const cat = it.section || "";
    const deck = (it.excerpt || it.description || "").replace(/<[^>]+>/g, "").slice(0, 120);
    const link = it.url || it.link || getEntityUrl(origin, "articles", it);
    const imgHtml = img
      ? `<img src="${s(img)}" alt="${s(title)}" style="display:block;border:0;outline:none;width:100%;height:100%;object-fit:cover;">`
      : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#EEF1E8;"><span style="font-size:36px;font-weight:900;color:#C4C8BC;">${s(title.charAt(0).toUpperCase())}</span></div>`;
    rows.push(`<table role="presentation" width="100%" class="wk-card" style="border:1px solid rgba(12,13,10,.14);border-radius:14px;overflow:hidden;background:#FFFFFF;">
<tr>
<td class="wk-stack" width="42%" style="padding:0;vertical-align:top;">
<div style="width:100%;aspect-ratio:4/3;overflow:hidden;border-radius:12px 0 0 12px;background:#EEF1E8;">${imgHtml}</div>
</td>
<td class="wk-stack" style="padding:22px 24px;vertical-align:top;">
${cat ? `<div class="wk-eyebrow" style="font-family:${FNT};font-size:10px;line-height:1;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:${s(accent)};display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span style="display:inline-block;width:20px;height:1px;background:${s(accent)};flex:none;"></span>${s(cat)}</div>` : ""}
<h3 style="margin:0 0 6px;font-family:${FNT};font-size:17px;line-height:1.2;font-weight:800;letter-spacing:-.02em;color:#0C0D0A;"><a href="${s(link)}" style="color:#0C0D0A;text-decoration:none;">${s(title)}</a></h3>
${deck ? `<p style="margin:0 0 8px;font-family:${FNT};font-size:13px;line-height:1.5;color:#6B6E62;">${s(deck)}</p>` : ""}
<p style="margin:0;font-family:${FNT};font-size:12px;line-height:1.4;color:#9A9C8E;">${s(dateLabel(it))}${readingTimeLabel(it) ? ` &middot; ${s(readingTimeLabel(it))}` : ""}</p>
</td>
</tr>
</table>`);
    if (items.indexOf(it) < items.length - 1) rows.push(`<div style="height:14px;"></div>`);
  }
  return rows.join("");
}

function genChartTrackTileRows(items: SectionItem[], origin: string, accent: string): string {
  const s = eH; const rows: string[] = [];
  for (let i = 0; i < items.length; i += 2) {
    const a = items[i]; const b = items[i + 1]; const cells: string[] = [];
    [a, b].filter(Boolean).forEach((it: any) => {
      const img = resolveImg(it); const title = resolveTitle(it); const artist = resolveSubtitle(it);
      const link = it.url || it.link || getEntityUrl(origin, "charts", it);
      const rColor = chartRankColor(it.rank, accent);
      const rankNum = it.rank !== undefined ? `<div style="position:absolute;top:10px;left:10px;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:${FNT};font-size:16px;font-weight:900;letter-spacing:-.03em;color:#FFFFFF;background:${rColor};">${it.rank}</div>` : "";
      const imgHtml = img
        ? `<div style="width:100%;aspect-ratio:1/1;border-radius:14px 14px 0 0;overflow:hidden;background:#EEF1E8;position:relative;">${rankNum}<img src="${s(img)}" alt="${s(title)}" width="100%" style="display:block;border:0;outline:none;width:100%;height:100%;object-fit:cover;"></div>`
        : `<div style="width:100%;aspect-ratio:1/1;border-radius:14px 14px 0 0;background:#EEF1E8;display:flex;align-items:center;justify-content:center;position:relative;">${rankNum}<span style="font-size:32px;font-weight:900;color:#C4C8BC;">${s(title.charAt(0).toUpperCase())}</span></div>`;
      cells.push(`<td class="wk-stack-pad" width="${b ? "50%" : "100%"}" style="vertical-align:top;padding-right:${b ? "8px" : "0"};padding-bottom:${b ? "0" : "8px"};">
<table role="presentation" width="100%" class="wk-card" style="border:1px solid rgba(12,13,10,.14);border-radius:14px;overflow:hidden;background:#FFFFFF;">
<tr><td style="padding:0;">${imgHtml}</td></tr>
<tr><td style="padding:14px 16px;">
<h3 class="wk-h3" style="margin:0 0 3px;font-family:${FNT};font-size:14px;line-height:1.2;font-weight:700;letter-spacing:-.01em;color:#0C0D0A;"><a href="${s(link)}" style="color:#0C0D0A;text-decoration:none;">${s(title)}</a></h3>
<p class="wk-muted" style="margin:0;font-family:${FNT};font-size:12px;line-height:1.4;color:#6B6E62;">${s(artist)} ${movementBadge(it.movement)}</p>
</td></tr>
</table>
</td>`);
    });
    if (!b) cells.push(`<td class="wk-stack-pad" width="50%" style="vertical-align:top;padding-right:0;">&nbsp;</td>`);
    rows.push(`<tr>${cells.join("")}</tr>`);
    if (i + 2 < items.length) rows.push(`<tr><td colspan="2" style="height:16px;"></td></tr>`);
  }
  return rows.join("");
}

function genArtistImageCardRows(items: SectionItem[], origin: string, accent: string): string {
  const s = eH; const rows: string[] = [];
  for (let i = 0; i < items.length; i += 4) {
    const batch = items.slice(i, i + 4); const cells: string[] = [];
    batch.forEach((it, idx) => {
      const img = resolveImg(it); const name = resolveTitle(it);
      const bio = (it.bio_excerpt || it.contextText || "").replace(/<[^>]+>/g, "").slice(0, 140);
      const country = it.country || "";
      const link = it.url || it.link || getEntityUrl(origin, "artists", it);
      const padRight = idx < batch.length - 1 ? "padding-right:8px;" : "";
      cells.push(`<td class="wk-stack-pad" width="25%" style="vertical-align:top;${padRight}">
<table role="presentation" width="100%" class="wk-card" style="border:1px solid rgba(12,13,10,.14);border-radius:14px;overflow:hidden;background:#FFFFFF;position:relative;">
<tr><td style="padding:0;">
<div style="position:relative;width:100%;aspect-ratio:3/4;overflow:hidden;background:#EEF1E8;">
${img ? `<img src="${s(img)}" alt="${s(name)}" width="100%" style="display:block;border:0;outline:none;width:100%;height:100%;object-fit:cover;object-position:top;">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><span style="font-size:40px;font-weight:900;color:#C4C8BC;">${s(name.charAt(0).toUpperCase())}</span></div>`}
<div style="position:absolute;bottom:0;left:0;right:0;padding:40px 14px 14px;background:linear-gradient(to top,rgba(0,0,0,.85),rgba(0,0,0,.10),transparent);">
<div style="font-family:${FNT};font-size:16px;line-height:1.15;font-weight:800;letter-spacing:-.015em;color:#FFFFFF;margin-bottom:3px;"><a href="${s(link)}" style="color:#FFFFFF;text-decoration:none;">${s(name)}</a></div>
${country ? `<div style="font-family:${FNT};font-size:11px;line-height:1.4;color:rgba(255,255,255,.60);margin-bottom:2px;">${s(country)}</div>` : ""}
${bio ? `<div style="font-family:${FNT};font-size:13px;line-height:1.4;color:rgba(255,255,255,.70);max-height:3.6em;overflow:hidden;font-weight:600;">${s(bio)}</div>` : ""}
</div>
</div>
</td></tr>
</table>
</td>`);
    });
    while (cells.length < 4) cells.push(`<td class="wk-stack-pad" width="25%" style="vertical-align:top;">&nbsp;</td>`);
    rows.push(`<tr>${cells.join("")}</tr>`);
    if (i + 4 < items.length) rows.push(`<tr><td colspan="4" style="height:16px;"></td></tr>`);
  }
  return rows.join("");
}

function genRouteTileRows(items: SectionItem[], origin: string, accent: string): string {
  const s = eH; const rows: string[] = [];
  for (let i = 0; i < items.length; i += 3) {
    const batch = items.slice(i, i + 3); const cells: string[] = [];
    batch.forEach((it, idx) => {
      const img = resolveImg(it); const title = resolveTitle(it); const sub = resolveSubtitle(it);
      const type = it.type || it.release_type || "";
      const link = it.url || it.link || getEntityUrl(origin, it.type || "articles", it);
      const padRight = idx < batch.length - 1 ? "padding-right:10px;" : "";
      cells.push(`<td class="wk-route-cell" width="33%" style="vertical-align:top;${padRight}">
<table role="presentation" width="100%" class="wk-card" style="border:1px solid rgba(12,13,10,.14);border-radius:14px;overflow:hidden;background:#FFFFFF;">
<tr><td style="padding:0;">
<div style="width:100%;aspect-ratio:16/9;overflow:hidden;background:#EEF1E8;">
${img ? `<img src="${s(img)}" alt="${s(title)}" width="100%" style="display:block;border:0;outline:none;width:100%;height:100%;object-fit:cover;">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><span style="font-size:32px;font-weight:900;color:#C4C8BC;">${s(title.charAt(0).toUpperCase())}</span></div>`}
</div>
</td></tr>
<tr><td style="padding:14px 16px;">
<div style="font-family:${FNT};font-size:14px;line-height:1.2;font-weight:700;letter-spacing:-.01em;color:#0C0D0A;margin-bottom:3px;"><a href="${s(link)}" style="color:#0C0D0A;text-decoration:none;">${s(title)}</a></div>
<div style="font-family:${FNT};font-size:12px;line-height:1.4;color:#6B6E62;">${s(sub)}${type ? ` &middot; ${s(type)}` : ""}</div>
</td></tr>
</table>
</td>`);
    });
    while (cells.length < 3) cells.push(`<td class="wk-route-cell" width="33%" style="vertical-align:top;">&nbsp;</td>`);
    rows.push(`<tr>${cells.join("")}</tr>`);
    if (i + 3 < items.length) rows.push(`<tr><td colspan="3" style="height:16px;"></td></tr>`);
  }
  return rows.join("");
}

function renderModule(
  moduleName: string, curated: CuratedContent, origin: string, accent: string,
  branding: Branding, consumed: Set<number>
): string {
  const sectionTypes = MDS[moduleName];
  if (!sectionTypes) return "";
  const s = eH;
  const label = ml(moduleName);
  const firstType = sectionTypes[0];
  const linkUrl = SPECIAL.has(moduleName) ? `${origin}${sl(firstType, "").replace(origin, "")}` : `${origin}${sl(firstType, origin).replace(origin, "")}`;
  const linkLabel = SPECIAL.has(moduleName) ? sll(firstType) : "";
  const bgStyle = "background:#EEF1E8;";

  function sectionHeader(): string {
    const linkTD = linkUrl && linkLabel && !SPECIAL.has(moduleName)
      ? `<td align="right" style="padding-bottom:12px;"><a href="${s(linkUrl)}" style="font-family:${FNT};font-size:13px;font-weight:700;color:${s(accent)};text-decoration:none;">${s(linkLabel)} &rarr;</a></td>`
      : "";
    return `<table role="presentation" width="100%"><tr><td style="padding-bottom:12px;"><div class="wk-eyebrow" style="font-family:${FNT};font-size:10px;line-height:1;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:${s(accent)};display:flex;align-items:center;gap:8px;"><span style="display:inline-block;width:20px;height:1px;background:${s(accent)};flex:none;"></span>${s(label)}</div></td>${linkTD}</tr></table>`;
  }

  // ── Featured / Lead Editorial: vertical artwork-first layout ──
  if (moduleName === "featured_routes" || moduleName === "lead_editorial") {
    const section = findSectionUnused(curated, sectionTypes, consumed);
    if (!section || !section.items || section.items.length === 0) return "";
    const idx = curated.sections.findIndex((sc) => sc === section);
    if (idx >= 0) consumed.add(idx);
    const featured = section.items[0]; const rest = section.items.slice(1);
    const fsImg = resolveImg(featured); const fsTitle = resolveTitle(featured);
    const fsCat = featured.section || featured.type || "Story";
    const fsUrl = featured.url || featured.link || getEntityUrl(origin, "articles", featured);
    const fsDeck = featured.excerpt || featured.description || "";
    const imgBlock = fsImg
      ? `<tr><td style="padding:0;"><div style="width:100%;aspect-ratio:16/9;border-radius:14px 14px 0 0;overflow:hidden;background:#EEF1E8;"><img src="${s(fsImg)}" alt="${s(fsTitle)}" style="display:block;border:0;outline:none;width:100%;height:100%;object-fit:cover;"></div></td></tr>`
      : "";
    let parts = `<tr><td class="wk-pad" style="padding:32px 48px;border-bottom:1px solid rgba(12,13,10,.08);background:#EEF1E8;">
${sectionHeader()}
<table role="presentation" width="100%" class="wk-card" style="border:1px solid rgba(12,13,10,.14);border-radius:14px;overflow:hidden;background:#FFFFFF;">
${imgBlock}
<tr><td style="padding:24px;vertical-align:top;">
<div class="wk-eyebrow" style="font-family:${FNT};font-size:10px;line-height:1;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:${s(accent)};display:flex;align-items:center;gap:8px;margin-bottom:12px;"><span style="display:inline-block;width:20px;height:1px;background:${s(accent)};flex:none;"></span>${s(fsCat)}</div>
<h2 class="wk-h2" style="margin:0 0 10px;font-family:${FNT};font-size:30px;line-height:1.02;font-weight:900;letter-spacing:-.038em;color:#0C0D0A;">${s(fsTitle)}</h2>
<p class="wk-faint" style="margin:0 0 12px;font-family:${FNT};font-size:12px;line-height:1.5;color:#9A9C8E;">${s(dateLabel(featured))}${readingTimeLabel(featured) ? ` &middot; ${s(readingTimeLabel(featured))}` : ""}</p>
<p class="wk-body" style="margin:0 0 18px;font-family:${FNT};font-size:15px;line-height:1.55;color:#3F4138;">${s(fsDeck.slice(0, 160))}</p>
<a class="wk-button" href="${s(fsUrl)}" style="display:inline-flex;align-items:center;gap:8px;border:1px solid ${s(accent)}44;border-radius:6px;padding:11px 18px;font-family:${FNT};font-size:13px;line-height:1;font-weight:700;letter-spacing:-.005em;color:${s(accent)};background:#fff;text-decoration:none;">Read the dispatch</a>
</td></tr></table>`;
    if (rest.length > 0) parts += `<div style="height:20px"></div>${genStoryFeaturedRows(rest, origin, accent)}`;
    parts += `</td></tr>`;
    return parts;
  }

  // ── Chart Pulse / Chart Lead ──
  if (moduleName === "chart_pulse" || moduleName === "chart_lead") {
    const section = findSectionUnused(curated, sectionTypes, consumed);
    if (!section || !section.items || section.items.length === 0) return "";
    const idx = curated.sections.findIndex((sc) => sc === section);
    if (idx >= 0) consumed.add(idx);
    const lead = section.items[0]; if (!lead) return "";
    const tiles = section.items.slice(1, 5);
    const chartTitle = lead.chart_name || "Chart";
    const clImg = resolveImg(lead); const clTitle = resolveTitle(lead); const clArtist = resolveSubtitle(lead);
    const rColor = chartRankColor(lead.rank, accent);
    let parts = `<tr><td class="wk-pad" style="padding:32px 48px;background:#EEF1E8;border-bottom:1px solid rgba(12,13,10,.08);">
${sectionHeader()}
<h2 class="wk-h2" style="margin:0 0 10px;font-family:${FNT};font-size:30px;line-height:1.02;font-weight:900;letter-spacing:-.038em;color:#0C0D0A;">${s(chartTitle)}</h2>
<p class="wk-body" style="margin:0 0 20px;font-family:${FNT};font-size:15px;line-height:1.55;color:#3F4138;">${s(clArtist)} &mdash; ${s(clTitle)}</p>
<table role="presentation" width="100%" class="wk-card" style="border:1px solid rgba(12,13,10,.14);border-radius:14px;overflow:hidden;background:#FFFFFF;">
<tr>
<td class="wk-stack" width="260">${clImg ? `<div style="width:260px;aspect-ratio:1/1;border-radius:14px 0 0 14px;overflow:hidden;"><img src="${s(clImg)}" alt="${s(clTitle)}" width="260" style="display:block;border:0;outline:none;width:100%;height:100%;object-fit:cover;"></div>` : `<div style="width:260px;aspect-ratio:1/1;border-radius:14px 0 0 14px;background:#EEF1E8;display:flex;align-items:center;justify-content:center;"><span style="font-size:56px;font-weight:900;color:#C4C8BC;">${s(clTitle.charAt(0).toUpperCase())}</span></div>`}</td>
<td class="wk-stack" style="padding:28px;vertical-align:bottom;">
<div class="wk-rank" style="font-family:${FNT};font-size:52px;line-height:1;font-weight:900;letter-spacing:-.04em;color:${rColor};">${lead.rank !== undefined ? `#${lead.rank}` : ""}</div>
<h3 class="wk-h2" style="margin:10px 0 8px;font-family:${FNT};font-size:30px;line-height:1.02;font-weight:900;letter-spacing:-.038em;color:#0C0D0A;">${s(clTitle)}</h3>
<p class="wk-body" style="margin:0 0 10px;font-family:${FNT};font-size:15px;line-height:1.55;color:#3F4138;">${s(clArtist)}</p>
<p class="wk-muted" style="margin:0;font-family:${FNT};font-size:13px;line-height:1.5;color:#6B6E62;">${s(chartTitle)} ${movementBadge(lead.movement)}</p>
</td></tr></table>`;
    if (tiles.length > 0) parts += `<div style="height:20px"></div><table role="presentation" width="100%">${genChartTrackTileRows(tiles, origin, accent)}</table>`;
    parts += `</td></tr>`;
    return parts;
  }

  // ── Guide Hero ──
  if (moduleName === "guide_hero") {
    const section = findSectionUnused(curated, sectionTypes, consumed);
    if (!section || !section.items || section.items.length === 0) return "";
    const idx = curated.sections.findIndex((sc) => sc === section);
    if (idx >= 0) consumed.add(idx);
    const hero = section.items[0]; if (!hero) return "";
    const hImg = resolveImg(hero); const hTitle = resolveTitle(hero); const hSub = resolveSubtitle(hero);
    const hUrl = hero.url || hero.link || getEntityUrl(origin, "guides", hero);
    return `<tr><td class="wk-pad" style="padding:32px 48px;border-bottom:1px solid rgba(12,13,10,.08);background:#EEF1E8;">
${sectionHeader()}
<table role="presentation" width="100%" class="wk-card" style="margin-top:18px;border:1px solid rgba(12,13,10,.14);border-radius:14px;overflow:hidden;background:#FFFFFF;">
<tr>
${hImg ? `<td class="wk-stack" width="45%"><div style="width:100%;aspect-ratio:16/9;border-radius:12px 0 0 12px;overflow:hidden;"><img src="${s(hImg)}" alt="${s(hTitle)}" style="display:block;border:0;outline:none;width:100%;height:100%;object-fit:cover;"></div></td>` : `<td class="wk-stack" width="45%"><div style="width:100%;aspect-ratio:16/9;border-radius:12px 0 0 12px;background:#EEF1E8;display:flex;align-items:center;justify-content:center;"><span style="font-size:48px;font-weight:900;color:#C4C8BC;">${s(hTitle.charAt(0).toUpperCase())}</span></div></td>`}
<td class="wk-stack" width="55%" style="padding:24px;vertical-align:middle;">
<h2 class="wk-h2" style="margin:0 0 10px;font-family:${FNT};font-size:30px;line-height:1.02;font-weight:900;letter-spacing:-.038em;color:#0C0D0A;"><a href="${s(hUrl)}" style="color:#0C0D0A;text-decoration:none;">${s(hTitle)}</a></h2>
<p class="wk-body" style="margin:0 0 18px;font-family:${FNT};font-size:15px;line-height:1.55;color:#3F4138;">${s(hSub)}</p>
<a class="wk-button" href="${s(hUrl)}" style="display:inline-flex;align-items:center;gap:8px;border:1px solid ${s(accent)}44;border-radius:6px;padding:11px 18px;font-family:${FNT};font-size:13px;line-height:1;font-weight:700;letter-spacing:-.005em;color:${s(accent)};background:#fff;text-decoration:none;">Explore the guide</a>
</td></tr></table></td></tr>`;
  }

  // ── Archive Routes / Archive Reads: use story cards with featured images ──
  if (moduleName === "archive_routes" || moduleName === "archive_reads") {
    const section = findSectionUnused(curated, sectionTypes, consumed);
    if (!section || !section.items || section.items.length === 0) return "";
    const idx = curated.sections.findIndex((sc) => sc === section);
    if (idx >= 0) consumed.add(idx);
    const items = section.items.slice(0, 6);
    const inner = genStoryCardRows(items, origin, accent);
    return `<tr><td class="wk-pad" style="padding:32px 48px;border-bottom:1px solid rgba(12,13,10,.08);${bgStyle}">${sectionHeader()}<table role="presentation" width="100%">${inner}</table></td></tr>`;
  }

  // ── Generic fallthrough: match by section type ──
  for (const secType of sectionTypes) {
    const section = findSectionUnused(curated, [secType], consumed);
    if (!section || !section.items || section.items.length === 0) continue;
    const idx = curated.sections.findIndex((sc) => sc === section);
    if (idx >= 0) consumed.add(idx);
    const items = section.items.slice(0, 6);
    let inner = "";
    if (secType === "articles") inner = genStoryCardRows(items, origin, accent);
    else if (secType === "charts") inner = genChartTrackTileRows(items, origin, accent);
    else if (secType === "artists") inner = genArtistImageCardRows(items, origin, accent);
    else inner = genRouteTileRows(items, origin, accent);
    return `<tr><td class="wk-pad" style="padding:32px 48px;border-bottom:1px solid rgba(12,13,10,.08);${bgStyle}">${sectionHeader()}<table role="presentation" width="100%">${inner}</table></td></tr>`;
  }
  return "";
}

interface TemplateProfile { headlinePattern?: string; deckPattern?: string; primaryModules?: string[]; accentColor?: string; }

function generateRichEmailHtml(
  briefingSlug: string, curated: CuratedContent, isoWeek: string, date: string,
  origin: string, branding: Branding = defaultBranding, issueId?: string,
  visualConfig?: { accent_color?: string; header_style?: string }, templateProfile?: TemplateProfile
): string {
  const s = eH;
  const accent = templateProfile?.accentColor || visualConfig?.accent_color || "#5C8E25";
  const primaryModules = templateProfile?.primaryModules || ["featured_routes", "chart_pulse", "artist_motion", "archive_routes", "keep_going"];
  const headlinePattern = templateProfile?.headlinePattern || "";
  const deckPattern = templateProfile?.deckPattern || "";
  const webViewUrl = issueId ? `${origin}/briefing/issue/${issueId}` : `${origin}/briefing/issues`;
  const displayDate = formatDisplayDate(date);
  const dateLabelStr = `${displayDate} &middot; Week ${isoWeek}`;
  const effectiveTitle = briefingSlug ? briefingSlug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : "Culture Dispatch";
  const headline = curated.intro ? curated.intro.split(".")[0] + "." : headlinePattern || effectiveTitle;
  const deck = curated.intro || deckPattern || `Your weekly briefing from WAKILISHA.`;
  const rows: string[] = [];

  rows.push(`<tr><td class="wk-pad wk-topbar" style="padding:14px 34px;background:#EEF1E8;font-family:${FNT};font-size:12px;line-height:1;font-weight:600;color:#6B6E62;"><table role="presentation" width="100%"><tr><td>${s(dateLabelStr)}</td><td align="right"><a href="${s(webViewUrl)}" style="color:${s(accent)};font-weight:800;">Read on web</a></td></tr></table></td></tr>`);

  const logoImg = branding.brandLogoUrl
    ? `<img src="${s(branding.brandLogoUrl)}" alt="${s(branding.brandName)}" width="180" style="display:block;width:180px;max-width:180px;height:auto;margin:0 0 32px;">`
    : `<div style="font-weight:900;letter-spacing:-0.04em;font-size:22px;color:#0C0D0A;margin:0 0 32px;font-family:${FNT};">${s(branding.brandName)}</div>`;
  rows.push(`<tr><td class="wk-pad" style="padding:40px 48px 44px;background:#F7F8F3;border-bottom:1px solid rgba(12,13,10,.08);">${logoImg}
<div style="display:flex;align-items:center;gap:8px;margin-bottom:18px;"><span style="display:inline-block;width:24px;height:1px;background:${s(accent)};flex:none;"></span><span style="font-family:${FNT};font-size:10px;line-height:1;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:${s(accent)};">${s(effectiveTitle)}</span></div>
<h1 class="wk-h1" style="margin:0 0 16px;font-family:${FNT};font-size:52px;line-height:.94;font-weight:900;letter-spacing:-.045em;color:#0C0D0A;">${s(headline)}</h1>
<p class="wk-body" style="margin:0;font-family:${FNT};font-size:16px;line-height:1.55;color:#3F4138;">${s(deck)}</p>
</td></tr>`);

  const consumedSections = new Set<number>();
  for (const moduleName of primaryModules) {
    const html = renderModule(moduleName, curated, origin, accent, branding, consumedSections);
    if (html) rows.push(html);
  }

  rows.push(`<tr><td class="wk-pad" style="padding:32px 48px;background:#EEF1E8;font-family:${FNT};font-size:13px;line-height:1.6;color:#6B6E62;">
${branding.brandLogoUrl ? `<img src="${s(branding.brandLogoUrl)}" alt="${s(branding.brandName)}" width="140" style="display:block;width:140px;height:auto;margin:0 0 12px;">` : `<div style="font-weight:900;font-size:16px;color:#0C0D0A;margin:0 0 12px;">${s(branding.brandName)}</div>`}
<p style="margin:0 0 12px;">Culture, charts, stories and the wider creative record.</p>
<p style="margin:0;"><a href="{{preferences_url}}" style="color:${s(accent)};font-weight:700;">Manage preferences</a> &middot; <a href="{{unsubscribe_url}}" style="color:${s(accent)};font-weight:700;">Unsubscribe</a> &middot; <a href="https://wakilisha.africa/privacy" style="color:${s(accent)};font-weight:700;">Privacy</a></p>
</td></tr>`);

  return rows.join("");
}

function getEntityUrl(origin: string, type: string, item: SectionItem): string {
  const s = eH;
  switch (type) {
    case "articles": case "article": return `${origin}/magazine/${s(item.slug || "")}`;
    case "artists": case "artist": return `${origin}/artists/${s(item.slug || "")}`;
    case "releases": case "release": return `${origin}/releases/${s((item.artist_name || "artist").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}/${s(item.slug || "")}`;
    case "tracks": case "track": return `${origin}/tracks/${s((item.artist || "artist").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}/${s(item.slug || "")}`;
    case "charts": case "chart": return item.edition_slug ? `${origin}/charts/${s(item.edition_slug)}` : `${origin}/charts`;
    case "genres": case "genre": return `${origin}/genres/${s(item.slug || "")}`;
    case "labels": case "label": return `${origin}/labels/${s(item.slug || "")}`;
    case "guides": case "guide": return `${origin}/guides/${s(item.slug || "")}`;
    default: return origin;
  }
}

function generatePlainTextFromCurated(title: string, curated: CuratedContent, isoWeek: string, date: string): string {
  const lines: string[] = [];
  lines.push(`WAKILISHA \u2014 ${title}`); lines.push(`Week ${isoWeek} \u00b7 ${date}`); lines.push("");
  if (curated.intro) lines.push(curated.intro);
  lines.push("");
  for (const section of (curated.sections || [])) {
    if (!section.items || section.items.length === 0) continue;
    lines.push(`\u2500\u2500 ${section.title.toUpperCase()} \u2500\u2500`);
    for (const item of section.items) {
      const t = item.title || item.name || item.display_name || item.track_title || "";
      const artist = item.artist || item.artist_name || "";
      lines.push(`  \u2022 ${t}${artist ? ` \u2014 ${artist}` : ""}`);
      if (item.excerpt || item.bio_excerpt || item.contextText) {
        const body = item.excerpt || item.bio_excerpt || item.contextText || "";
        lines.push(`    ${body.slice(0, 100)}${body.length > 100 ? "..." : ""}`);
      }
    }
    lines.push("");
  }
  if (curated.outro) { lines.push(curated.outro); lines.push(""); }
  lines.push("\u2014 WAKILISHA");
  return lines.join("\n");
}

function briefingEmailHtml(title: string, intro: string, ctaLabel: string, ctaUrl: string, footer: string, branding: Branding = defaultBranding) {
  const s = eH; const accent = "#5C8E25";
  return `<!doctype html><html><body style="margin:0;background:#F7F8F3;font-family:${FNT};color:#0C0D0A"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F7F8F3;padding:32px 16px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid rgba(12,13,10,.12)"><tr><td style="padding:28px 28px 8px">${logoHtml(branding.brandLogoUrl, branding.brandName, 24)}</td></tr><tr><td style="padding:12px 28px 8px"><h1 style="margin:0;font-size:28px;line-height:1.05;letter-spacing:-0.04em;color:#0C0D0A">${s(title)}</h1></td></tr><tr><td style="padding:8px 28px 20px"><p style="margin:0;font-size:15px;line-height:1.65;color:#3F4138">${s(intro)}</p></td></tr><tr><td style="padding:0 28px 26px"><a href="${s(ctaUrl)}" style="display:inline-flex;align-items:center;border:1px solid ${accent}44;border-radius:6px;padding:11px 18px;font-size:13px;line-height:1;font-weight:700;color:${accent};background:#fff;text-decoration:none">${s(ctaLabel)}</a></td></tr><tr><td style="padding:0 28px 24px"><p style="margin:0;font-size:12px;line-height:1.6;color:#9A9C8E">If the button does not work, copy this link:<br><span style="word-break:break-all;color:#6B6E62">${s(ctaUrl)}</span></p></td></tr><tr><td style="padding:18px 28px;background:#EEF1E8;border-top:1px solid rgba(12,13,10,.08)"><p style="margin:0;font-size:12px;line-height:1.6;color:#6B6E62">${s(footer)}</p></td></tr></table></td></tr></table></body></html>`;
}

// ═══ CONTENT FETCH ═══
interface BriefingContent {
  articles: Array<{ title: string; slug: string; excerpt: string; image_url?: string; author?: string; published_at?: string }>;
  chartHighlights: Array<{ track_title: string; artist_name: string; rank: number; movement?: string; chart_name: string; edition_slug?: string }>;
  newReleases: Array<{ title: string; slug: string; artist_name: string; type: string; artwork_url?: string; release_date?: string }>;
  featuredArtists: Array<{ display_name: string; slug: string; bio_excerpt?: string; image_url?: string; genres?: string[] }>;
}

async function fetchRecentArticles(db: any, limit = 5): Promise<BriefingContent["articles"]> {
  try {
    const { data } = await db.from("wk_articles").select("slug, title, excerpt, hero_image_url, published_at, author").eq("wp_status", "publish").order("published_at", { ascending: false }).limit(limit);
    return (data ?? []).map((a: any) => ({ title: a.title ?? "", slug: a.slug ?? "", excerpt: a.excerpt ?? "", image_url: a.hero_image_url ?? undefined, author: a.author ?? undefined, published_at: a.published_at ?? undefined }));
  } catch { return []; }
}

async function fetchChartHighlights(db: any, limit = 5): Promise<BriefingContent["chartHighlights"]> {
  try {
    const { data } = await db.from("wk_chart_entries_v2").select("rank, movement, track_title, artist_name, wk_chart_editions_v2!inner(slug, title, edition_date)").order("wk_chart_editions_v2(edition_date)", { ascending: false }).limit(limit);
    return (data ?? []).map((e: any) => ({ track_title: e.track_title ?? "", artist_name: e.artist_name ?? "", rank: e.rank ?? 0, movement: e.movement ?? undefined, chart_name: (e.wk_chart_editions_v2 as any)?.title ?? "", edition_slug: (e.wk_chart_editions_v2 as any)?.slug ?? undefined }));
  } catch { return []; }
}

async function fetchNewReleases(db: any, limit = 5): Promise<BriefingContent["newReleases"]> {
  try {
    const { data } = await db.from("registry_releases").select("slug, title, release_type, release_date, artwork_url, registry_release_artists(registry_artists(display_name, slug))").order("release_date", { ascending: false }).limit(limit);
    return (data ?? []).map((r: any) => {
      const artists = (r.registry_release_artists ?? []).map((ra: any) => ra.registry_artists).filter(Boolean);
      return { title: r.title ?? "", slug: r.slug ?? "", artist_name: artists.map((a: any) => a.display_name).join(", ") || "Unknown", type: r.release_type ?? "release", artwork_url: r.artwork_url ?? undefined, release_date: r.release_date ?? undefined };
    });
  } catch { return []; }
}

async function fetchFeaturedArtists(db: any, limit = 5): Promise<BriefingContent["featuredArtists"]> {
  try {
    const { data } = await db.from("registry_artists").select("slug, display_name, bio, image_url").order("created_at", { ascending: false }).limit(limit);
    return (data ?? []).map((a: any) => ({ display_name: a.display_name ?? "", slug: a.slug ?? "", bio_excerpt: a.bio ? a.bio.slice(0, 160) + "..." : undefined, image_url: a.image_url ?? undefined }));
  } catch { return []; }
}

async function fetchAllContent(db: any): Promise<BriefingContent> {
  const [articles, chartHighlights, newReleases, featuredArtists] = await Promise.all([fetchRecentArticles(db, 4), fetchChartHighlights(db, 5), fetchNewReleases(db, 3), fetchFeaturedArtists(db, 3)]);
  return { articles, chartHighlights, newReleases, featuredArtists };
}

// ═══ RATE LIMITER ═══
const RL_MAX = 30; const RL_WINDOW = 60;
async function ckRL(db: any, key: string) {
  const ws = new Date(Date.now() - RL_WINDOW * 1000).toISOString();
  try {
    const { count, error } = await db.from("rate_limit_log").select("*", { count: "exact", head: true }).eq("bucket_key", key).gte("created_at", ws);
    if (error) return { allowed: true, remaining: RL_MAX };
    const c = (count ?? 0); const rem = Math.max(0, RL_MAX - c - 1);
    db.from("rate_limit_log").insert({ bucket_key: key, created_at: is() }).then(() => {});
    return { allowed: c < RL_MAX, remaining: rem };
  } catch { return { allowed: true, remaining: RL_MAX }; }
}

// ═══ AUTH ═══
async function vJ(req: Request): Promise<{ id: string; email: string } | null> {
  const ah = req.headers.get("Authorization"); if (!ah || !ah.startsWith("Bearer ")) return null;
  const t = ah.replace("Bearer ", "");
  const uc = createClient(SU, SK, { global: { headers: { Authorization: "Bearer " + t } } });
  const { data: { user }, error } = await uc.auth.getUser(t);
  if (error || !user) return null;
  return { id: user.id, email: user.email! };
}

async function rC(uid: string, cap: string): Promise<boolean> {
  const db = createClient(SU, SK);
  const { data: roles } = await db.from("user_role_assignments").select("role_key, role_definitions!inner(role_capabilities(capability_key))").eq("user_id", uid).eq("status", "active").or("expires_at.is.null,expires_at.gt.now()");
  if (!roles || roles.length === 0) return false;
  if (roles.some((r: any) => r.role_key === "administrator")) return true;
  const all = new Set<string>();
  for (const r of roles) { const caps = (r.role_definitions as any)?.role_capabilities ?? []; for (const c of caps) all.add(c.capability_key); }
  return all.has(cap);
}

async function trackAnalyticsEvent(db: any, eventName: string, opts: { pageUrl?: string; pageType?: string; entitySlug?: string; entityType?: string; sessionId?: string; userId?: string; referrer?: string; context?: Record<string, unknown>; }) {
  try { await db.from("analytics_events").insert({ event_name: eventName, page_url: opts.pageUrl ?? "https://wakilisha.africa", page_type: opts.pageType ?? null, entity_slug: opts.entitySlug ?? null, entity_type: opts.entityType ?? null, context: opts.context ?? null, session_id: opts.sessionId ?? "wk_server_webhook", user_id: opts.userId ?? null, referrer: opts.referrer ?? null, created_at: is() }); } catch (e) { console.error("[analytics] track failed:", e instanceof Error ? e.message : String(e)); }
}


type AudienceInterestInput = {
  entity_type?: unknown;
  entity_slug?: unknown;
  entity_name?: unknown;
  entity_id?: unknown;
  interest_kind?: unknown;
  source_form?: unknown;
  source_page?: unknown;
  source_context?: unknown;
  interest_strength?: unknown;
};

const AUDIENCE_ENTITY_TYPES = new Set(["artist", "track", "release", "guide", "chart", "genre", "label", "article", "briefing"]);
const AUDIENCE_INTEREST_KINDS = new Set(["follow", "subscribe", "download", "save", "click", "read", "manual"]);

function cleanAudienceText(value: unknown, max = 180): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function cleanAudienceSlug(value: unknown): string {
  return cleanAudienceText(value, 220)
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanAudienceUuid(value: unknown): string | null {
  const text = cleanAudienceText(value, 80);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
}

function cleanAudienceObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cleanInterestStrength(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.max(1, Math.min(100, Math.round(number)));
}

function normalizeAudienceInterestInputs(body: any): Array<Required<Pick<AudienceInterestInput, "entity_type" | "entity_slug">> & AudienceInterestInput> {
  const rawItems: unknown[] = [
    ...(Array.isArray(body.interests) ? body.interests : []),
    ...(Array.isArray(body.audience_interests) ? body.audience_interests : []),
  ];

  if (body.entity_type && body.entity_slug) {
    rawItems.push({
      entity_type: body.entity_type,
      entity_slug: body.entity_slug,
      entity_name: body.entity_name,
      entity_id: body.entity_id,
      interest_kind: body.interest_kind,
      source_form: body.source_form,
      source_page: body.source_page ?? body.page_url,
      source_context: body.source_context,
      interest_strength: body.interest_strength,
    });
  }

  const seen = new Set<string>();
  const out: Array<Required<Pick<AudienceInterestInput, "entity_type" | "entity_slug">> & AudienceInterestInput> = [];

  for (const raw of rawItems.slice(0, 25)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const item = raw as AudienceInterestInput;

    const entityType = cleanAudienceText(item.entity_type, 40).toLowerCase();
    const entitySlug = cleanAudienceSlug(item.entity_slug);
    if (!AUDIENCE_ENTITY_TYPES.has(entityType) || !entitySlug) continue;

    const key = `${entityType}:${entitySlug}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const kind = cleanAudienceText(item.interest_kind, 40).toLowerCase();
    out.push({
      ...item,
      entity_type: entityType,
      entity_slug: entitySlug,
      interest_kind: AUDIENCE_INTEREST_KINDS.has(kind) ? kind : "follow",
    });
  }

  return out;
}

async function recordAudienceInterests(
  db: any,
  subscriberId: string,
  inputs: ReturnType<typeof normalizeAudienceInterestInputs>,
  defaults: {
    sourceForm: string;
    sourcePage: string;
    pageType: string;
    briefingSlugs: string[];
  },
) {
  const now = is();
  const recorded: any[] = [];

  for (const input of inputs) {
    const sourceContext = {
      ...cleanAudienceObject(input.source_context),
      page_type: defaults.pageType,
      briefing_slugs: defaults.briefingSlugs,
    };

    const sourceForm = cleanAudienceText(input.source_form, 80) || defaults.sourceForm || "unknown";
    const sourcePage = cleanAudienceText(input.source_page, 500) || defaults.sourcePage || "";
    const entityName = cleanAudienceText(input.entity_name, 180) || null;
    const entityId = cleanAudienceUuid(input.entity_id);
    const interestKind = cleanAudienceText(input.interest_kind, 40).toLowerCase() || "follow";
    const interestStrength = cleanInterestStrength(input.interest_strength);

    const { data: existing } = await db
      .from("audience_interests")
      .select("id, interest_strength")
      .eq("subscriber_id", subscriberId)
      .eq("entity_type", input.entity_type)
      .eq("entity_slug", input.entity_slug)
      .maybeSingle();

    if (existing?.id) {
      const nextStrength = Math.max(Number(existing.interest_strength) || 1, interestStrength);
      const { data: updated, error } = await db
        .from("audience_interests")
        .update({
          entity_name: entityName,
          entity_id: entityId,
          interest_kind: interestKind,
          source_form: sourceForm,
          source_page: sourcePage,
          source_context: sourceContext,
          interest_strength: nextStrength,
          status: "active",
          last_seen_at: now,
          updated_at: now,
        })
        .eq("id", existing.id)
        .select("entity_type, entity_slug, entity_name, interest_kind, source_form, interest_strength")
        .maybeSingle();

      if (!error && updated) recorded.push(updated);
      continue;
    }

    const { data: inserted, error } = await db
      .from("audience_interests")
      .insert({
        subscriber_id: subscriberId,
        entity_type: input.entity_type,
        entity_slug: input.entity_slug,
        entity_name: entityName,
        entity_id: entityId,
        interest_kind: interestKind,
        source_form: sourceForm,
        source_page: sourcePage,
        source_context: sourceContext,
        interest_strength: interestStrength,
        status: "active",
        first_seen_at: now,
        last_seen_at: now,
        created_at: now,
        updated_at: now,
      })
      .select("entity_type, entity_slug, entity_name, interest_kind, source_form, interest_strength")
      .maybeSingle();

    if (!error && inserted) recorded.push(inserted);
  }

  return recorded;
}


// ═══ HANDLERS ═══
async function listCatalog(c: Record<string, string>, includeAll = false) {
  const db = createClient(SU, SK); let query = db.from("briefing_catalog").select("*").order("sort_order");
  if (!includeAll) query = query.eq("is_active", true);
  const { data, error } = await query; if (error) return jE("query_failed", error.message, c, 500);
  return jO(data ?? [], c);
}

async function handleUpdateCatalog(body: any, c: Record<string, string>) {
  const db = createClient(SU, SK); const briefingId = String(body.briefing_id ?? "").trim(); const now = is();
  if (!briefingId) return jE("missing_id", "briefing_id is required.", c);
  const updates: Record<string, any> = { updated_at: now };
  if (body.is_active !== undefined && body.is_active !== null) updates.is_active = Boolean(body.is_active);
  if (body.send_day !== undefined) updates.send_day = String(body.send_day).trim() || null;
  if (body.send_time !== undefined) updates.send_time = String(body.send_time).trim() || null;
  if (body.cadence !== undefined) updates.cadence = String(body.cadence).trim();
  if (body.send_every_days !== undefined) updates.send_every_days = body.send_every_days === null ? null : Math.max(1, Math.min(365, Number(body.send_every_days)));
  if (body.is_manual !== undefined) updates.is_manual = Boolean(body.is_manual);
  const { data: updated, error } = await db.from("briefing_catalog").update(updates).eq("id", briefingId).select("*").single();
  if (error) return jE("update_failed", error.message, c, 500);
  return jO(updated, c);
}

async function handleSubscribe(body: any, c: Record<string, string>, ip: string, ua: string) {
  const email = String(body.email ?? "").trim().toLowerCase(); const briefingSlugs: string[] = Array.isArray(body.briefing_slugs) ? body.briefing_slugs : [];
  const origin = body.origin || "https://wakilisha.africa";
  const sourceForm = cleanAudienceText(body.source_form, 80) || "briefing_subscribe";
  const pageUrl = cleanAudienceText(body.page_url ?? body.source_page, 500) || origin;
  const pageType = cleanAudienceText(body.page_type, 80) || "briefing";
  const audienceInterestInputs = normalizeAudienceInterestInputs(body);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jE("invalid_email", "A valid email address is required.", c);
  if (briefingSlugs.length === 0) return jE("no_briefings", "Select at least one briefing to subscribe to.", c);
  const db = createClient(SU, SK); const now = is();
  const { data: briefings } = await db.from("briefing_catalog").select("id, slug, title").in("slug", briefingSlugs).eq("is_active", true);
  if (!briefings || briefings.length === 0) return jE("invalid_briefings", "None of the requested briefings are available.", c);
  const { data: existing } = await db.from("briefing_subscribers").select("id, status").eq("email", email).maybeSingle();
  let subscriberId: string;
  if (existing) { subscriberId = existing.id; if (existing.status === "unsubscribed") { await db.from("briefing_subscribers").update({ status: "pending", unsubscribed_at: null, updated_at: now }).eq("id", subscriberId); } }
  else { const { data: ns } = await db.from("briefing_subscribers").insert({ email, status: "pending", ip_address: ip, user_agent: ua, created_at: now, updated_at: now }).select("id").single(); if (!ns) return jE("insert_failed", "Could not create subscriber.", c, 500); subscriberId = ns.id; }

  const optedIn: string[] = [];
  for (const b of briefings) { const { error: oiErr } = await db.from("briefing_opt_ins").upsert({ subscriber_id: subscriberId, briefing_id: b.id, status: "active", subscribed_at: now, unsubscribed_at: null }, { onConflict: "subscriber_id,briefing_id" }); if (!oiErr) optedIn.push(b.title); }

  const recordedInterests = await recordAudienceInterests(db, subscriberId, audienceInterestInputs, {
    sourceForm,
    sourcePage: pageUrl,
    pageType,
    briefingSlugs,
  });

  const token = crypto.randomUUID(); const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await db.from("briefing_tokens").insert({ subscriber_id: subscriberId, token, purpose: "confirm", expires_at: expiresAt });
  await db.from("briefing_tokens").delete().eq("subscriber_id", subscriberId).eq("purpose", "confirm").is("used_at", null).neq("token", token);

  trackAnalyticsEvent(db, "briefing_subscribe", {
    pageUrl: body.page_url ?? origin,
    pageType,
    entitySlug: recordedInterests[0]?.entity_slug ?? briefingSlugs[0] ?? null,
    entityType: recordedInterests[0]?.entity_type ?? "briefing",
    sessionId: body.session_id ?? null,
    referrer: body.referrer ?? null,
    context: {
      email,
      briefing_count: optedIn.length,
      briefings: optedIn,
      audience_interest_count: recordedInterests.length,
      audience_interests: recordedInterests,
      source_form: sourceForm,
    }
  });

  try {
    const confirmUrl = `${origin}/briefing/confirm?token=${token}`; const briefingList = optedIn.map((t: string) => `&bull; ${t}`).join("<br>");
    const branding: Branding = { brandName: body.brand_name || "WAKILISHA", brandLogoUrl: body.brand_logo_url || "", brandFaviconUrl: body.brand_favicon_url || "" };
    const html = briefingEmailHtml("Confirm your WAKILISHA briefings", `You signed up for these briefings:<br><br>${briefingList}<br><br>Click below to confirm your subscription.`, "Confirm subscription", confirmUrl, "This confirmation link expires in 7 days. If you didn't request this, you can safely ignore it.", branding);
    await sendEmail(email, "Confirm your WAKILISHA briefing subscription", html, `Confirm: ${confirmUrl}`, [{ name: "wakilisha_event", value: "briefing_confirm" }]);
  } catch (e) { console.error("[briefing] confirm email failed:", e instanceof Error ? e.message : String(e)); }

  return jO({
    subscriber_id: subscriberId,
    email,
    briefings: optedIn,
    audience_interests: recordedInterests,
    status: existing?.status === "confirmed" ? "already_confirmed" : "pending_confirmation",
    message: existing?.status === "confirmed" ? "Briefings updated. You're already confirmed." : "Check your email to confirm your subscription."
  }, c);
}


async function handleConfirm(body: any, c: Record<string, string>) {
  const token = String(body.token ?? "").trim(); if (!token) return jE("missing_token", "Confirmation token is required.", c);
  const db = createClient(SU, SK); const now = is();
  const { data: tk } = await db.from("briefing_tokens").select("*").eq("token", token).eq("purpose", "confirm").is("used_at", null).maybeSingle();
  if (!tk) return jE("invalid_token", "This confirmation link is invalid or has already been used.", c);
  if (new Date(tk.expires_at) < new Date()) return jE("expired_token", "This confirmation link has expired. Please subscribe again.", c);
  await db.from("briefing_tokens").update({ used_at: now }).eq("id", tk.id);
  await db.from("briefing_subscribers").update({ status: "confirmed", confirmed_at: now, updated_at: now }).eq("id", tk.subscriber_id);
  const { data: subscriber } = await db.from("briefing_subscribers").select("email").eq("id", tk.subscriber_id).maybeSingle();
  trackAnalyticsEvent(db, "briefing_confirm_success", { pageUrl: body.page_url ?? "https://wakilisha.africa", pageType: "briefing_confirm", sessionId: body.session_id ?? null, context: { email: subscriber?.email ?? "", subscriber_id: tk.subscriber_id } });
  return jO({ confirmed: true, email: subscriber?.email ?? "", message: "Your subscription is confirmed." }, c);
}

async function handleUnsubscribe(body: any, c: Record<string, string>) {
  const token = String(body.token ?? "").trim(); const email = String(body.email ?? "").trim().toLowerCase();
  const briefingSlug = String(body.briefing_slug ?? "").trim(); const all = Boolean(body.all);
  const db = createClient(SU, SK); const now = is(); let subscriberId: string | null = null;
  if (token) {
    const { data: tk } = await db.from("briefing_tokens").select("*").eq("token", token).eq("purpose", "unsubscribe").is("used_at", null).maybeSingle();
    if (!tk) return jE("invalid_token", "This unsubscribe link is invalid or has already been used.", c);
    if (new Date(tk.expires_at) < new Date()) return jE("expired_token", "This unsubscribe link has expired.", c);
    subscriberId = tk.subscriber_id; await db.from("briefing_tokens").update({ used_at: now }).eq("id", tk.id);
  } else if (email) {
    const { data: sub } = await db.from("briefing_subscribers").select("id").eq("email", email).maybeSingle();
    if (!sub) return jE("not_found", "No subscriber found with this email.", c);
    subscriberId = sub.id;
  } else { return jE("missing_identifier", "Provide a token or email to unsubscribe.", c); }
  if (all || !briefingSlug) {
    await db.from("briefing_opt_ins").update({ status: "unsubscribed", unsubscribed_at: now }).eq("subscriber_id", subscriberId).eq("status", "active");
    await db.from("briefing_subscribers").update({ status: "unsubscribed", unsubscribed_at: now, updated_at: now }).eq("id", subscriberId);
    await db.from("briefing_tokens").update({ used_at: now }).eq("subscriber_id", subscriberId).is("used_at", null);
    return jO({ unsubscribed: true, all: true, message: "You have been unsubscribed from all WAKILISHA briefings." }, c);
  }
  const { data: briefing } = await db.from("briefing_catalog").select("id").eq("slug", briefingSlug).maybeSingle();
  if (!briefing) return jE("not_found", `Briefing "${briefingSlug}" not found.`, c);
  await db.from("briefing_opt_ins").update({ status: "unsubscribed", unsubscribed_at: now }).eq("subscriber_id", subscriberId).eq("briefing_id", briefing.id).eq("status", "active");
  const { count } = await db.from("briefing_opt_ins").select("*", { count: "exact", head: true }).eq("subscriber_id", subscriberId).eq("status", "active");
  if ((count ?? 0) === 0) { await db.from("briefing_subscribers").update({ status: "unsubscribed", unsubscribed_at: now, updated_at: now }).eq("id", subscriberId); }
  return jO({ unsubscribed: true, briefing: briefingSlug, message: `Unsubscribed from ${briefingSlug}.` }, c);
}

async function handlePreferences(body: any, c: Record<string, string>) {
  const token = String(body.token ?? "").trim(); if (!token) return jE("missing_token", "Preferences token is required.", c);
  const db = createClient(SU, SK);
  const { data: tk } = await db.from("briefing_tokens").select("*").eq("token", token).eq("purpose", "preferences").is("used_at", null).maybeSingle();
  if (!tk) return jE("invalid_token", "This preferences link is invalid or has already been used.", c);
  if (new Date(tk.expires_at) < new Date()) return jE("expired_token", "This link has expired.", c);
  const { data: subscriber } = await db.from("briefing_subscribers").select("id, email, status").eq("id", tk.subscriber_id).maybeSingle();
  if (!subscriber) return jE("not_found", "Subscriber not found.", c);
  const { data: optIns } = await db.from("briefing_opt_ins").select("briefing_id, status, briefing_catalog!inner(slug, title, description, cadence, send_day, send_every_days, is_manual)").eq("subscriber_id", tk.subscriber_id);
  const { data: allBriefings } = await db.from("briefing_catalog").select("*").eq("is_active", true).order("sort_order");
  const optInMap = new Map((optIns ?? []).map((o: any) => [o.briefing_id, o.status]));
  const briefings = (allBriefings ?? []).map((b: any) => ({ id: b.id, slug: b.slug, title: b.title, description: b.description, cadence: b.cadence, send_day: b.send_day, send_every_days: b.send_every_days, is_manual: b.is_manual, subscribed: optInMap.get(b.id) === "active" }));
  return jO({ email: subscriber.email, status: subscriber.status, briefings }, c);
}

// ═══ CRON ═══
async function handleCronGenerate(body: any, c: Record<string, string>) {
  const secret = String(body.cron_secret ?? "").trim();
  if (!CS) return jE("cron_not_configured", "CRON_SECRET is not set on this function.", c, 500);
  if (secret !== CS) return jE("invalid_secret", "Cron secret mismatch.", c, 403);
  const db = createClient(SU, SK); const now = is(); const today = new Date();
  const dayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][today.getDay()];
  const dateStr = now.split("T")[0]; const isoWeek = getIsoWeek(today);
  const { data: briefings } = await db.from("briefing_catalog").select("*").eq("is_active", true).eq("is_manual", false).not("send_every_days", "is", null).order("sort_order");
  if (!briefings || briefings.length === 0) return jO({ generated: 0, message: "No automated briefings scheduled.", day: dayName }, c);
  const results: Array<{ briefing: string; status: string; issueId?: string }> = [];
  for (const briefing of briefings) {
    const intervalDays = briefing.send_every_days; const sendTime = briefing.send_at ?? "09:00";
    const [targetHour, targetMin] = sendTime.split(":").map(Number);
    const currentHour = today.getUTCHours(); const currentMin = today.getUTCMinutes();
    const hourDiff = Math.abs(currentHour - targetHour);
    if (hourDiff > 1 || (hourDiff === 1 && currentMin > targetMin)) { results.push({ briefing: briefing.slug, status: "skipped_time" }); continue; }
    const lastIssueDate = new Date(today); lastIssueDate.setDate(lastIssueDate.getDate() - intervalDays);
    const lastIssueDateStr = lastIssueDate.toISOString().split("T")[0];
    const { data: existing } = await db.from("briefing_issues").select("id, issue_date").eq("briefing_id", briefing.id).gte("issue_date", lastIssueDateStr).order("issue_date", { ascending: false }).limit(1).maybeSingle();
    if (existing) { results.push({ briefing: briefing.slug, status: "skipped_interval", issueId: existing.id }); continue; }
    const content = await fetchAllContent(db); const curated = convertLegacyContentToCurated(content);
    const issueSlug = `${briefing.slug}-${isoWeek}`; const issueTitle = `${briefing.title} \u2014 Week ${isoWeek}`;
    const origin = body.origin || "https://wakilisha.africa";
    const vc = briefing.visual_config as { accent_color?: string; header_style?: string } | null;
    const tp = (briefing.template_profile as any) || {};
    const htmlBody = generateRichEmailHtml(briefing.slug, curated, isoWeek, dateStr, origin, defaultBranding, undefined, vc ?? undefined, tp);
    const plainText = generatePlainTextFromCurated(briefing.title, curated, isoWeek, dateStr);
    const { data: issue, error } = await db.from("briefing_issues").insert({ briefing_id: briefing.id, title: issueTitle, slug: issueSlug, status: "draft", iso_week: isoWeek, issue_date: dateStr, html_body: htmlBody, plain_text: plainText, utm_campaign: `${briefing.slug}-${isoWeek}`.replace(/[^a-zA-Z0-9_-]/g, "-"), curated_content: curated, created_at: now, updated_at: now }).select("id, title, slug, status, iso_week").single();
    if (error) { results.push({ briefing: briefing.slug, status: "failed" }); }
    else { results.push({ briefing: briefing.slug, status: "generated", issueId: issue?.id }); }
  }
  return jO({ generated: results.filter((r: any) => r.status === "generated").length, skipped: results.filter((r: any) => r.status === "skipped_interval" || r.status === "skipped_time").length, failed: results.filter((r: any) => r.status === "failed").length, day: dayName, iso_week: isoWeek, results }, c);
}

function convertLegacyContentToCurated(content: BriefingContent): CuratedContent {
  const sections: ContentSection[] = [];
  if (content.articles.length > 0) {
    const half = Math.ceil(content.articles.length / 2);
    sections.push({ title: "Latest Stories", type: "articles", layout: "list", items: content.articles.slice(0, half).map((a: any) => ({ slug: a.slug, title: a.title, excerpt: a.excerpt, heroUrl: a.image_url, author: a.author, published_at: a.published_at })) });
    if (content.articles.length > half) sections.push({ title: "More Stories", type: "articles", layout: "list", items: content.articles.slice(half).map((a: any) => ({ slug: a.slug, title: a.title, excerpt: a.excerpt, heroUrl: a.image_url, author: a.author, published_at: a.published_at })) });
  }
  if (content.chartHighlights.length > 0) {
    const half = Math.ceil(content.chartHighlights.length / 2);
    sections.push({ title: "Chart Watch", type: "charts", layout: "list", items: content.chartHighlights.slice(0, half).map((ch: any) => ({ track_title: ch.track_title, artist_name: ch.artist_name, rank: ch.rank, movement: ch.movement, edition_slug: ch.edition_slug, chart_name: ch.chart_name })) });
    if (content.chartHighlights.length > half) sections.push({ title: "Chart Movement", type: "charts", layout: "list", items: content.chartHighlights.slice(half).map((ch: any) => ({ track_title: ch.track_title, artist_name: ch.artist_name, rank: ch.rank, movement: ch.movement, edition_slug: ch.edition_slug, chart_name: ch.chart_name })) });
  }
  if (content.newReleases.length > 0) {
    const third = Math.ceil(content.newReleases.length / 3);
    sections.push({ title: "New releases", type: "releases", layout: "grid", items: content.newReleases.slice(0, third).map((r: any) => ({ slug: r.slug, title: r.title, artist_name: r.artist_name, type: r.type, artwork_url: r.artwork_url, release_date: r.release_date })) });
    if (content.newReleases.length > third) sections.push({ title: "Fresh covers", type: "releases", layout: "grid", items: content.newReleases.slice(third, third * 2).map((r: any) => ({ slug: r.slug, title: r.title, artist_name: r.artist_name, type: r.type, artwork_url: r.artwork_url, release_date: r.release_date })) });
    if (content.newReleases.length > third * 2) sections.push({ title: "More releases", type: "releases", layout: "grid", items: content.newReleases.slice(third * 2).map((r: any) => ({ slug: r.slug, title: r.title, artist_name: r.artist_name, type: r.type, artwork_url: r.artwork_url, release_date: r.release_date })) });
  }
  if (content.featuredArtists.length > 0) {
    const half = Math.ceil(content.featuredArtists.length / 2);
    sections.push({ title: "Artists to Watch", type: "artists", layout: "grid", items: content.featuredArtists.slice(0, half).map((a: any) => ({ slug: a.slug, display_name: a.display_name, bio_excerpt: a.bio_excerpt, image_url: a.image_url })) });
    if (content.featuredArtists.length > half) sections.push({ title: "More Artists", type: "artists", layout: "grid", items: content.featuredArtists.slice(half).map((a: any) => ({ slug: a.slug, display_name: a.display_name, bio_excerpt: a.bio_excerpt, image_url: a.image_url })) });
  }
  if (content.articles.length > 0) sections.push({ title: "From the Archive", type: "guides", layout: "list", items: content.articles.slice(0, 3).map((a: any) => ({ slug: a.slug, title: a.title, excerpt: a.excerpt, heroUrl: a.image_url, author: a.author, published_at: a.published_at })) });
  return { sections };
}

// ═══ ADMIN HANDLERS ═══
async function handleGenerateIssueFromContent(body: any, c: Record<string, string>, auth: { id: string; email: string }) {
  const briefingSlug = String(body.briefing_slug ?? "").trim(); if (!briefingSlug) return jE("missing_briefing", "briefing_slug is required.", c);
  const curated = body.curated_content as CuratedContent | undefined; if (!curated || !curated.sections || curated.sections.length === 0) return jE("missing_content", "curated_content with sections is required.", c);
  const db = createClient(SU, SK); const { data: briefing } = await db.from("briefing_catalog").select("*").eq("slug", briefingSlug).maybeSingle();
  if (!briefing) return jE("not_found", `Briefing "${briefingSlug}" not found.`, c);
  const now = is(); const today = now.split("T")[0]; const isoWeek = getIsoWeek(new Date(today));
  const issueSlug = `${briefingSlug}-${isoWeek}`; const issueTitle = `${briefing.title} \u2014 Week ${isoWeek}`;
  const origin = body.origin || "https://wakilisha.africa";
  const branding: Branding = { brandName: body.brand_name || "WAKILISHA", brandLogoUrl: body.brand_logo_url || "", brandFaviconUrl: body.brand_favicon_url || "" };
  const vc = briefing.visual_config as { accent_color?: string; header_style?: string } | null;
  const tp = (briefing.template_profile as any) || {};
  const htmlBody = generateRichEmailHtml(briefing.slug, curated, isoWeek, today, origin, branding, undefined, vc ?? undefined, tp);
  const plainText = generatePlainTextFromCurated(briefing.title, curated, isoWeek, today);
  const utmCampaign = `${briefingSlug}-${isoWeek}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  const { data: issue } = await db.from("briefing_issues").insert({ briefing_id: briefing.id, title: issueTitle, slug: issueSlug, status: "draft", iso_week: isoWeek, issue_date: today, html_body: htmlBody, plain_text: plainText, utm_campaign: utmCampaign, curated_content: curated, generated_by: auth.id, created_at: now, updated_at: now }).select("id, title, slug, status, iso_week, html_body, plain_text, curated_content").single();
  if (!issue) return jE("insert_failed", "Could not create issue.", c, 500);
  return jO({ issue, briefing: { slug: briefing.slug, title: briefing.title }, content_stats: { section_count: curated.sections.length, total_items: curated.sections.reduce((sum: number, s: any) => sum + (s.items?.length || 0), 0) } }, c, 201);
}

async function handlePreviewContent(body: any, c: Record<string, string>, auth: { id: string; email: string }) {
  const briefingSlug = String(body.briefing_slug ?? "").trim(); if (!briefingSlug) return jE("missing_briefing", "briefing_slug is required.", c);
  const curated = body.curated_content as CuratedContent | undefined; if (!curated || !curated.sections || curated.sections.length === 0) return jE("missing_content", "curated_content with sections is required.", c);
  const db = createClient(SU, SK); const { data: briefing } = await db.from("briefing_catalog").select("*").eq("slug", briefingSlug).maybeSingle();
  if (!briefing) return jE("not_found", `Briefing "${briefingSlug}" not found.`, c);
  const now = is(); const today = now.split("T")[0]; const isoWeek = getIsoWeek(new Date(today));
  const origin = body.origin || "https://wakilisha.africa";
  const branding: Branding = { brandName: body.brand_name || "WAKILISHA", brandLogoUrl: body.brand_logo_url || "", brandFaviconUrl: body.brand_favicon_url || "" };
  const vc = briefing.visual_config as { accent_color?: string; header_style?: string } | null;
  const tp = (briefing.template_profile as any) || {};
  const issueTitle = `${briefing.title} \u2014 Week ${isoWeek}`;
  const htmlBody = generateRichEmailHtml(briefing.slug, curated, isoWeek, today, origin, branding, undefined, vc ?? undefined, tp);
  const plainText = generatePlainTextFromCurated(briefing.title, curated, isoWeek, today);
  const fullHtml = wrapBriefingHtml(htmlBody, issueTitle, "preview@wakilisha.africa", "preview-token", origin, branding);
  return jO({ preview: true, title: issueTitle, briefing: { slug: briefing.slug, title: briefing.title }, iso_week: isoWeek, html_body: fullHtml, plain_text: plainText, content_stats: { section_count: curated.sections.length, total_items: curated.sections.reduce((sum: number, s: any) => sum + (s.items?.length || 0), 0) } }, c);
}

async function handleGetIssue(body: any, c: Record<string, string>) {
  const issueId = String(body.issue_id ?? "").trim(); if (!issueId) return jE("missing_issue", "issue_id is required.", c);
  const db = createClient(SU, SK);
  const { data: issue } = await db.from("briefing_issues").select("*, briefing_catalog(slug, title, visual_config)").eq("id", issueId).maybeSingle();
  if (!issue) return jE("not_found", "Issue not found.", c);
  return jO({ issue: { id: issue.id, title: issue.title, slug: issue.slug, status: issue.status, iso_week: issue.iso_week, issue_date: issue.issue_date, html_body: issue.html_body, plain_text: issue.plain_text, curated_content: issue.curated_content, sent_count: issue.sent_count, sent_at: issue.sent_at }, briefing: issue.briefing_catalog }, c);
}

async function handleUpdateIssueContent(body: any, c: Record<string, string>, auth: { id: string; email: string }) {
  const issueId = String(body.issue_id ?? "").trim(); const curated = body.curated_content as CuratedContent | undefined;
  if (!issueId) return jE("missing_issue", "issue_id is required.", c);
  if (!curated || !curated.sections) return jE("missing_content", "curated_content is required.", c);
  const db = createClient(SU, SK);
  const { data: issue } = await db.from("briefing_issues").select("id, briefing_id, status, title, slug, iso_week, issue_date").eq("id", issueId).maybeSingle();
  if (!issue) return jE("not_found", "Issue not found.", c);
  if (issue.status === "sent") return jE("already_sent", "Cannot edit a sent issue.", c, 409);
  const now = is(); const origin = body.origin || "https://wakilisha.africa";
  const branding: Branding = { brandName: body.brand_name || "WAKILISHA", brandLogoUrl: body.brand_logo_url || "", brandFaviconUrl: body.brand_favicon_url || "" };
  const { data: briefing } = await db.from("briefing_catalog").select("title, slug, visual_config").eq("id", issue.briefing_id).maybeSingle();
  const briefingSlug = briefing?.slug || "culture-dispatch";
  const vc = briefing?.visual_config as { accent_color?: string; header_style?: string } | null;
  const tp = (briefing?.template_profile as any) || {};
  const htmlBody = generateRichEmailHtml(briefingSlug, curated, issue.iso_week, issue.issue_date, origin, branding, issueId, vc ?? undefined, tp);
  const plainText = generatePlainTextFromCurated(briefing?.title || issue.title, curated, issue.iso_week, issue.issue_date);
  const { data: updated } = await db.from("briefing_issues").update({ curated_content: curated, html_body: htmlBody, plain_text: plainText, updated_at: now }).eq("id", issueId).select("id, title, slug, status, html_body, curated_content").single();
  if (!updated) return jE("update_failed", "Could not update issue.", c, 500);
  return jO({ updated: true, issue: updated, content_stats: { section_count: curated.sections.length, total_items: curated.sections.reduce((sum: number, s: any) => sum + (s.items?.length || 0), 0) } }, c);
}

async function handleGenerateIssue(body: any, c: Record<string, string>, auth: { id: string; email: string }) {
  const briefingSlug = String(body.briefing_slug ?? "").trim(); if (!briefingSlug) return jE("missing_briefing", "briefing_slug is required.", c);
  const db = createClient(SU, SK); const { data: briefing } = await db.from("briefing_catalog").select("*").eq("slug", briefingSlug).maybeSingle();
  if (!briefing) return jE("not_found", `Briefing "${briefingSlug}" not found.`, c);
  const now = is(); const today = now.split("T")[0]; const isoWeek = getIsoWeek(new Date(today));
  const issueSlug = `${briefingSlug}-${isoWeek}`; const issueTitle = `${briefing.title} \u2014 Week ${isoWeek}`;
  const origin = body.origin || "https://wakilisha.africa";
  const branding: Branding = { brandName: body.brand_name || "WAKILISHA", brandLogoUrl: body.brand_logo_url || "", brandFaviconUrl: body.brand_favicon_url || "" };
  const vc = briefing.visual_config as { accent_color?: string; header_style?: string } | null;
  const tp = (briefing.template_profile as any) || {};
  const content = await fetchAllContent(db); const curated = convertLegacyContentToCurated(content);
  const htmlBody = generateRichEmailHtml(briefing.slug, curated, isoWeek, today, origin, branding, undefined, vc ?? undefined, tp);
  const plainText = generatePlainTextFromCurated(briefing.title, curated, isoWeek, today);
  const { data: issue } = await db.from("briefing_issues").insert({ briefing_id: briefing.id, title: issueTitle, slug: issueSlug, status: "draft", iso_week: isoWeek, issue_date: today, html_body: htmlBody, plain_text: plainText, utm_campaign: `${briefingSlug}-${isoWeek}`.replace(/[^a-zA-Z0-9_-]/g, "-"), curated_content: curated, generated_by: auth.id, created_at: now, updated_at: now }).select("id, title, slug, status, iso_week").single();
  if (!issue) return jE("insert_failed", "Could not create issue.", c, 500);
  return jO({ issue, briefing: { slug: briefing.slug, title: briefing.title }, content_stats: { articles: content.articles.length, chart_highlights: content.chartHighlights.length, new_releases: content.newReleases.length, featured_artists: content.featuredArtists.length } }, c, 201);
}

async function handleDeleteIssue(body: any, c: Record<string, string>, auth: { id: string; email: string }) {
  const issueId = String(body.issue_id ?? "").trim(); if (!issueId) return jE("missing_issue", "issue_id is required.", c);
  const db = createClient(SU, SK); const { data: issue } = await db.from("briefing_issues").select("id, status, briefing_id").eq("id", issueId).maybeSingle();
  if (!issue) return jE("not_found", "Issue not found.", c);
  if (issue.status === "sent") return jE("cannot_delete_sent", "Cannot delete an issue that has already been sent.", c, 409);
  await db.from("briefing_issue_recipients").delete().eq("issue_id", issueId);
  const { error } = await db.from("briefing_issues").delete().eq("id", issueId);
  if (error) return jE("delete_failed", error.message, c, 500);
  return jO({ deleted: true, issue_id: issueId, message: "Issue deleted successfully." }, c);
}

async function handlePreviewIssue(body: any, c: Record<string, string>, auth: { id: string; email: string }) {
  const briefingSlug = String(body.briefing_slug ?? "").trim(); if (!briefingSlug) return jE("missing_briefing", "briefing_slug is required.", c);
  const db = createClient(SU, SK); const { data: briefing } = await db.from("briefing_catalog").select("*").eq("slug", briefingSlug).maybeSingle();
  if (!briefing) return jE("not_found", `Briefing "${briefingSlug}" not found.`, c);
  const now = is(); const today = now.split("T")[0]; const isoWeek = getIsoWeek(new Date(today));
  const origin = body.origin || "https://wakilisha.africa";
  const branding: Branding = { brandName: body.brand_name || "WAKILISHA", brandLogoUrl: body.brand_logo_url || "", brandFaviconUrl: body.brand_favicon_url || "" };
  const vc = briefing.visual_config as { accent_color?: string; header_style?: string } | null;
  const tp = (briefing.template_profile as any) || {};
  const content = await fetchAllContent(db); const curated = convertLegacyContentToCurated(content);
  const htmlBody = generateRichEmailHtml(briefing.slug, curated, isoWeek, today, origin, branding, undefined, vc ?? undefined, tp);
  const plainText = generatePlainTextFromCurated(briefing.title, curated, isoWeek, today);
  const issueTitle = `${briefing.title} \u2014 Week ${isoWeek}`;
  const fullHtml = wrapBriefingHtml(htmlBody, issueTitle, "preview@wakilisha.africa", "preview-token", origin, branding);
  return jO({ preview: true, title: issueTitle, briefing: { slug: briefing.slug, title: briefing.title }, iso_week: isoWeek, html_body: fullHtml, plain_text: plainText, content_stats: { articles: content.articles.length, chart_highlights: content.chartHighlights.length, new_releases: content.newReleases.length, featured_artists: content.featuredArtists.length } }, c);
}

async function handleSendIssue(body: any, c: Record<string, string>, auth: { id: string; email: string }) {
  const issueId = String(body.issue_id ?? "").trim(); if (!issueId) return jE("missing_issue", "issue_id is required.", c);
  const db = createClient(SU, SK); const now = is();
  const { data: issue } = await db.from("briefing_issues").select("*, briefing_catalog!inner(slug, title, visual_config)").eq("id", issueId).maybeSingle();
  if (!issue) return jE("not_found", "Issue not found.", c);
  if (issue.status === "sent") return jE("already_sent", "This issue has already been sent.", c, 409);

  const briefingTitle = (issue.briefing_catalog as any)?.title ?? issue.title;
  const briefingSlug = (issue.briefing_catalog as any)?.slug ?? "";
  const origin = body.origin || "https://wakilisha.africa";
  const branding: Branding = { brandName: body.brand_name || "WAKILISHA", brandLogoUrl: body.brand_logo_url || "", brandFaviconUrl: body.brand_favicon_url || "" };

  const rawSegmentFilters = body.segment_filters && typeof body.segment_filters === "object" ? body.segment_filters : null;
  const hasSegmentFilters = Boolean(rawSegmentFilters && [
    rawSegmentFilters.briefing_slug,
    rawSegmentFilters.entity_type,
    rawSegmentFilters.entity_slug,
    rawSegmentFilters.source_form,
  ].some((value) => String(value ?? "").trim().length > 0));

  const segmentFilters = hasSegmentFilters ? {
    subscriber_status: "confirmed",
    interest_status: "active",
    briefing_slug: String(rawSegmentFilters.briefing_slug ?? briefingSlug).trim() || briefingSlug,
    entity_type: String(rawSegmentFilters.entity_type ?? "").trim(),
    entity_slug: String(rawSegmentFilters.entity_slug ?? "").trim(),
    source_form: String(rawSegmentFilters.source_form ?? "").trim(),
  } : null;

  if (segmentFilters?.briefing_slug && segmentFilters.briefing_slug !== briefingSlug) {
    return jE("briefing_mismatch", `Selected segment briefing "${segmentFilters.briefing_slug}" does not match issue briefing "${briefingSlug}".`, c, 409);
  }

  let segmentSubscriberIds: string[] | null = null;

  if (segmentFilters) {
    let segmentQuery = db
      .from("audience_interests")
      .select("subscriber_id, briefing_subscribers!inner(id,email,status)")
      .eq("status", "active")
      .eq("briefing_subscribers.status", "confirmed")
      .limit(5000);

    if (segmentFilters.entity_type) segmentQuery = segmentQuery.eq("entity_type", segmentFilters.entity_type);
    if (segmentFilters.entity_slug) segmentQuery = segmentQuery.eq("entity_slug", segmentFilters.entity_slug);
    if (segmentFilters.source_form) segmentQuery = segmentQuery.eq("source_form", segmentFilters.source_form);

    const { data: segmentRows, error: segmentError } = await segmentQuery;
    if (segmentError) return jE("query_failed", segmentError.message, c, 500);

    segmentSubscriberIds = Array.from(new Set((segmentRows ?? []).map((row: any) => row.subscriber_id).filter(Boolean)));

    if (segmentSubscriberIds.length === 0) {
      return jO({
        sent: false,
        sent_count: 0,
        failed_count: 0,
        total_subscribers: 0,
        segment_send: true,
        segment_filters: segmentFilters,
        message: "No confirmed subscribers match this segment.",
      }, c);
    }
  }

  let optInQuery = db
    .from("briefing_opt_ins")
    .select("subscriber_id, briefing_subscribers!inner(id, email, status)")
    .eq("briefing_id", issue.briefing_id)
    .eq("status", "active")
    .eq("briefing_subscribers.status", "confirmed");

  if (segmentSubscriberIds) optInQuery = optInQuery.in("subscriber_id", segmentSubscriberIds);

  const { data: optIns, error: optInError } = await optInQuery;
  if (optInError) return jE("query_failed", optInError.message, c, 500);

  const subscriberMap = new Map<string, { subscriber_id: string; email: string }>();
  for (const optIn of optIns ?? []) {
    const email = (optIn.briefing_subscribers as any)?.email ?? "";
    if (!email) continue;
    subscriberMap.set(optIn.subscriber_id, { subscriber_id: optIn.subscriber_id, email });
  }

  const subscribers = Array.from(subscriberMap.values());

  if (subscribers.length === 0) {
    return jO({
      sent: false,
      sent_count: 0,
      failed_count: 0,
      total_subscribers: 0,
      segment_send: hasSegmentFilters,
      segment_filters: segmentFilters,
      message: hasSegmentFilters ? "No confirmed active opt-ins match this segment for this briefing." : "No confirmed active subscribers for this briefing.",
    }, c);
  }

  let sentCount = 0; let failedCount = 0; const recipients: any[] = [];
  for (const sub of subscribers) {
    const rId = crypto.randomUUID();
    try {
      if (RAK) {
        const unsubToken = crypto.randomUUID(); const unsubExpires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        await db.from("briefing_tokens").insert({ subscriber_id: sub.subscriber_id, token: unsubToken, purpose: "unsubscribe", expires_at: unsubExpires });
        const unsubUrl = `${origin}/briefing/unsubscribe?token=${unsubToken}`; const prefsUrl = `${origin}/briefing/preferences?token=${unsubToken}`;
        let htmlBody = issue.html_body ?? ""; htmlBody = htmlBody.replace(/\{\{unsubscribe_url\}\}/g, eH(unsubUrl)); htmlBody = htmlBody.replace(/\{\{preferences_url\}\}/g, eH(prefsUrl));
        const html = wrapBriefingHtml(htmlBody, briefingTitle, sub.email, unsubToken, origin, branding);
        const text = (issue.plain_text ?? `${briefingTitle}\n\nUnsubscribe: ${unsubUrl}`).replace(/\{\{unsubscribe_url\}\}/g, `Unsubscribe: ${unsubUrl}`).replace(/\{\{preferences_url\}\}/g, `Manage preferences: ${prefsUrl}`);
        const resendHeaders: Record<string, string> = { "List-Unsubscribe": `<mailto:${RFE}?subject=Unsubscribe%20${briefingSlug}>, <${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
        const resendResult = await sendEmail(sub.email, briefingTitle, html, text, [
          { name: "wakilisha_event", value: "briefing_send" },
          { name: "briefing_slug", value: briefingSlug },
          { name: "send_scope", value: hasSegmentFilters ? "segment" : "briefing" },
        ], resendHeaders);
        recipients.push({ id: rId, issue_id: issueId, subscriber_id: sub.subscriber_id, delivery_status: "sent", delivered_at: now, resend_message_id: resendResult?.id ?? null });
      } else { recipients.push({ id: rId, issue_id: issueId, subscriber_id: sub.subscriber_id, delivery_status: "queued" }); }
      sentCount++;
    } catch (e) { recipients.push({ id: rId, issue_id: issueId, subscriber_id: sub.subscriber_id, delivery_status: "queued" }); failedCount++; }
  }

  if (recipients.length > 0) { for (let j = 0; j < recipients.length; j += 100) { await db.from("briefing_issue_recipients").insert(recipients.slice(j, j + 100)); } }
  await db.from("briefing_issues").update({ status: "sent", sent_at: now, sent_count: sentCount, sent_by: auth.id, updated_at: now }).eq("id", issueId);

  return jO({
    sent: true,
    sent_count: sentCount,
    failed_count: failedCount,
    total_subscribers: subscribers.length,
    segment_send: hasSegmentFilters,
    segment_filters: segmentFilters,
    message: `${hasSegmentFilters ? "Segment sent" : "Sent"} to ${sentCount}/${subscribers.length} confirmed subscriber${subscribers.length === 1 ? "" : "s"}.`,
  }, c);
}

async function handleSendTest(body: any, c: Record<string, string>, auth: { id: string; email: string }) {
  const email = String(body.email ?? "").trim().toLowerCase(); const briefingSlug = String(body.briefing_slug ?? "").trim();
  if (!email) return jE("missing_email", "Test email address is required.", c);
  if (!RAK) return jE("resend_not_configured", "RESEND_API_KEY is not configured.", c, 500);
  const db = createClient(SU, SK); const now = is(); const origin = body.origin || "https://wakilisha.africa";
  const branding: Branding = { brandName: body.brand_name || "WAKILISHA", brandLogoUrl: body.brand_logo_url || "", brandFaviconUrl: body.brand_favicon_url || "" };
  let subject = "WAKILISHA \u2014 Test Briefing"; let html = ""; let plainText = "This is a test email from the WAKILISHA briefing system.";
  if (briefingSlug) {
    const { data: briefing } = await db.from("briefing_catalog").select("*").eq("slug", briefingSlug).maybeSingle();
    if (briefing) { subject = `${briefing.title} \u2014 Test Send`; const vc = briefing.visual_config as { accent_color?: string; header_style?: string } | null; const tp = (briefing.template_profile as any) || {}; const isoWeek = getIsoWeek(new Date()); const dateStr = now.split("T")[0]; const content = await fetchAllContent(db); const curated = convertLegacyContentToCurated(content); html = generateRichEmailHtml(briefing.slug, curated, isoWeek, dateStr, origin, branding, undefined, vc ?? undefined, tp); plainText = generatePlainTextFromCurated(briefing.title, curated, isoWeek, dateStr); }
  }
  if (!html) { html = briefingEmailHtml("WAKILISHA Briefing Test", "This is a test email to confirm the briefing delivery system is working correctly.", "Visit WAKILISHA", origin, "This is a test. No briefings are attached.", branding); }
  else { html = wrapBriefingHtml(html, subject, email, "test-token", origin, branding); }
  await sendEmail(email, subject, html, plainText, [{ name: "wakilisha_event", value: "briefing_test" }]);
  return jO({ sent: true, email, subject, message: "Test email sent successfully." }, c);
}

async function handleListIssues(body: any, c: Record<string, string>) {
  const db = createClient(SU, SK); const briefingSlug = String(body.briefing_slug ?? "").trim(); const limit = Math.min(Number(body.limit) || 50, 200); const status = String(body.status ?? "").trim();
  let query = db.from("briefing_issues").select("*, briefing_catalog(slug, title)").order("created_at", { ascending: false }).limit(limit);
  if (briefingSlug) { const { data: b } = await db.from("briefing_catalog").select("id").eq("slug", briefingSlug).maybeSingle(); if (b) query = query.eq("briefing_id", b.id); }
  if (status) query = query.eq("status", status);
  const { data, error } = await query; if (error) return jE("query_failed", error.message, c, 500);
  const enriched = await Promise.all((data ?? []).map(async (issue: any) => {
    const { count: rc } = await db.from("briefing_issue_recipients").select("*", { count: "exact", head: true }).eq("issue_id", issue.id);
    const { count: oc } = await db.from("briefing_issue_recipients").select("*", { count: "exact", head: true }).eq("issue_id", issue.id).not("opened_at", "is", null);
    const { count: cc } = await db.from("briefing_issue_recipients").select("*", { count: "exact", head: true }).eq("issue_id", issue.id).not("clicked_at", "is", null);
    const { count: bc } = await db.from("briefing_issue_recipients").select("*", { count: "exact", head: true }).eq("issue_id", issue.id).not("bounced_at", "is", null);
    return { ...issue, recipient_count: rc ?? 0, opened_count: oc ?? 0, clicked_count: cc ?? 0, bounced_count: bc ?? 0 };
  }));
  return jO(enriched, c);
}

async function handleListSubscribers(body: any, c: Record<string, string>) {
  const db = createClient(SU, SK); const status = String(body.status ?? "").trim(); const briefingSlug = String(body.briefing_slug ?? "").trim(); const limit = Math.min(Number(body.limit) || 100, 500);
  if (briefingSlug) { const { data: b } = await db.from("briefing_catalog").select("id").eq("slug", briefingSlug).maybeSingle(); if (!b) return jE("not_found", `Briefing "${briefingSlug}" not found.`, c); const { data: optIns } = await db.from("briefing_opt_ins").select("subscriber_id, status, briefing_subscribers!inner(id, email, status, confirmed_at, created_at)").eq("briefing_id", b.id).eq("status", "active").limit(limit); const subscribers = (optIns ?? []).map((o: any) => ({ id: o.subscriber_id, email: (o.briefing_subscribers as any)?.email ?? "", subscriber_status: (o.briefing_subscribers as any)?.status ?? "", confirmed_at: (o.briefing_subscribers as any)?.confirmed_at ?? null, created_at: (o.briefing_subscribers as any)?.created_at ?? null, opt_in_status: o.status })); return jO(subscribers, c); }
  let query = db.from("briefing_subscribers").select("*").order("created_at", { ascending: false }).limit(limit); if (status) query = query.eq("status", status);
  const { data, error } = await query; if (error) return jE("query_failed", error.message, c, 500);
  const subs = (data ?? []); if (subs.length > 0) { const sids = subs.map((s: any) => s.id); const { data: oi } = await db.from("briefing_opt_ins").select("subscriber_id, briefing_catalog(slug, title)").in("subscriber_id", sids).eq("status", "active"); const oiMap = new Map<string, any[]>(); for (const o of (oi ?? [])) { if (!oiMap.has(o.subscriber_id)) oiMap.set(o.subscriber_id, []); oiMap.get(o.subscriber_id)!.push(o.briefing_catalog); } for (const s of subs) { s.briefings = oiMap.get(s.id) ?? []; } }
  return jO(subs, c);
}


async function handleListAudienceSegments(body: any, c: Record<string, string>) {
  const db = createClient(SU, SK);

  const limit = Math.min(Math.max(Number(body.limit) || 250, 1), 1000);
  const subscriberStatus = String(body.subscriber_status ?? "").trim();
  const interestStatus = String(body.interest_status ?? "").trim();
  const briefingSlug = String(body.briefing_slug ?? "").trim();
  const entityType = String(body.entity_type ?? "").trim();
  const entitySlug = String(body.entity_slug ?? "").trim();
  const sourceForm = String(body.source_form ?? "").trim();

  let allowedSubscriberIds: string[] | null = null;

  if (briefingSlug) {
    const { data: briefing, error: briefingError } = await db
      .from("briefing_catalog")
      .select("id, slug, title")
      .eq("slug", briefingSlug)
      .maybeSingle();

    if (briefingError) return jE("query_failed", briefingError.message, c, 500);
    if (!briefing) return jE("not_found", `Briefing "${briefingSlug}" not found.`, c, 404);

    const { data: optIns, error: optInError } = await db
      .from("briefing_opt_ins")
      .select("subscriber_id")
      .eq("briefing_id", briefing.id)
      .eq("status", "active")
      .limit(5000);

    if (optInError) return jE("query_failed", optInError.message, c, 500);

    allowedSubscriberIds = Array.from(new Set((optIns ?? []).map((row: any) => row.subscriber_id).filter(Boolean)));

    if (allowedSubscriberIds.length === 0) {
      return jO({
        rows: [],
        summary: {
          total_interests: 0,
          distinct_subscribers: 0,
          confirmed_subscribers: 0,
          active_interests: 0,
          top_entities: [],
          source_forms: [],
          per_briefing: [],
        },
        filters: {
          subscriber_status: subscriberStatus || null,
          interest_status: interestStatus || null,
          briefing_slug: briefingSlug || null,
          entity_type: entityType || null,
          entity_slug: entitySlug || null,
          source_form: sourceForm || null,
          limit,
        },
      }, c);
    }
  }

  let query = db
    .from("audience_interests")
    .select(`
      id,
      subscriber_id,
      entity_type,
      entity_slug,
      entity_name,
      interest_kind,
      source_form,
      source_page,
      source_context,
      interest_strength,
      status,
      first_seen_at,
      last_seen_at,
      created_at,
      briefing_subscribers!inner(id,email,status,confirmed_at,created_at)
    `)
    .order("last_seen_at", { ascending: false })
    .limit(limit);

  if (interestStatus) query = query.eq("status", interestStatus);
  if (entityType) query = query.eq("entity_type", entityType);
  if (entitySlug) query = query.eq("entity_slug", entitySlug);
  if (sourceForm) query = query.eq("source_form", sourceForm);
  if (subscriberStatus) query = query.eq("briefing_subscribers.status", subscriberStatus);
  if (allowedSubscriberIds) query = query.in("subscriber_id", allowedSubscriberIds);

  const { data, error } = await query;
  if (error) return jE("query_failed", error.message, c, 500);

  const rawRows = data ?? [];
  const subscriberIds = Array.from(new Set(rawRows.map((row: any) => row.subscriber_id).filter(Boolean)));

  const briefingMap = new Map<string, Array<{ slug: string; title: string }>>();
  if (subscriberIds.length > 0) {
    const { data: optIns } = await db
      .from("briefing_opt_ins")
      .select("subscriber_id, briefing_catalog(slug,title)")
      .in("subscriber_id", subscriberIds)
      .eq("status", "active");

    for (const optIn of optIns ?? []) {
      const catalog = optIn.briefing_catalog as any;
      if (!catalog) continue;
      if (!briefingMap.has(optIn.subscriber_id)) briefingMap.set(optIn.subscriber_id, []);
      briefingMap.get(optIn.subscriber_id)!.push({
        slug: catalog.slug,
        title: catalog.title,
      });
    }
  }

  const rows = rawRows.map((row: any) => {
    const subscriber = row.briefing_subscribers as any;
    return {
      id: row.id,
      subscriber_id: row.subscriber_id,
      email: subscriber?.email ?? "",
      subscriber_status: subscriber?.status ?? "",
      confirmed_at: subscriber?.confirmed_at ?? null,
      entity_type: row.entity_type,
      entity_slug: row.entity_slug,
      entity_name: row.entity_name ?? null,
      interest_kind: row.interest_kind,
      source_form: row.source_form,
      source_page: row.source_page ?? null,
      interest_strength: row.interest_strength ?? 1,
      status: row.status,
      first_seen_at: row.first_seen_at,
      last_seen_at: row.last_seen_at,
      created_at: row.created_at,
      briefings: briefingMap.get(row.subscriber_id) ?? [],
    };
  });

  const subscriberSet = new Set(rows.map((row: any) => row.subscriber_id));
  const confirmedSet = new Set(rows.filter((row: any) => row.subscriber_status === "confirmed").map((row: any) => row.subscriber_id));

  const entityCounts = new Map<string, { entity_type: string; entity_slug: string; entity_name: string | null; count: number }>();
  const sourceCounts = new Map<string, number>();
  const briefingCounts = new Map<string, { slug: string; title: string; count: number }>();

  for (const row of rows) {
    const entityKey = `${row.entity_type}:${row.entity_slug}`;
    const currentEntity = entityCounts.get(entityKey) ?? {
      entity_type: row.entity_type,
      entity_slug: row.entity_slug,
      entity_name: row.entity_name,
      count: 0,
    };
    currentEntity.count += 1;
    entityCounts.set(entityKey, currentEntity);

    sourceCounts.set(row.source_form || "unknown", (sourceCounts.get(row.source_form || "unknown") ?? 0) + 1);

    for (const briefing of row.briefings ?? []) {
      const currentBriefing = briefingCounts.get(briefing.slug) ?? {
        slug: briefing.slug,
        title: briefing.title,
        count: 0,
      };
      currentBriefing.count += 1;
      briefingCounts.set(briefing.slug, currentBriefing);
    }
  }

  return jO({
    rows,
    summary: {
      total_interests: rows.length,
      distinct_subscribers: subscriberSet.size,
      confirmed_subscribers: confirmedSet.size,
      active_interests: rows.filter((row: any) => row.status === "active").length,
      top_entities: Array.from(entityCounts.values()).sort((a, b) => b.count - a.count).slice(0, 12),
      source_forms: Array.from(sourceCounts.entries()).map(([source_form, count]) => ({ source_form, count })).sort((a, b) => b.count - a.count).slice(0, 12),
      per_briefing: Array.from(briefingCounts.values()).sort((a, b) => b.count - a.count),
    },
    filters: {
      subscriber_status: subscriberStatus || null,
      interest_status: interestStatus || null,
      briefing_slug: briefingSlug || null,
      entity_type: entityType || null,
      entity_slug: entitySlug || null,
      source_form: sourceForm || null,
      limit,
    },
  }, c);
}


async function handleBriefingAnalytics(body: any, c: Record<string, string>) {
  const db = createClient(SU, SK); const days = Math.min(Number(body.days) || 30, 365); const since = new Date(Date.now() - days * 86400000).toISOString();
  const be = ["briefing_subscribe","briefing_confirm_success","briefing_unsubscribe","briefing_email_delivered","briefing_email_opened","briefing_email_clicked","briefing_email_bounced","briefing_email_complained","briefing_issue_generated","briefing_issue_sent","briefing_test_sent","briefing_issue_deleted"];
  const [{ data: events }, { data: eventCounts }, { data: timeline }, { data: sources }] = await Promise.all([db.from("analytics_events").select("event_name, context, created_at, page_type, entity_slug").in("event_name", be).gte("created_at", since).order("created_at", { ascending: false }).limit(5000), db.from("analytics_events").select("event_name").in("event_name", be).gte("created_at", since), db.from("analytics_events").select("event_name, created_at").in("event_name", ["briefing_subscribe","briefing_confirm_success","briefing_email_opened","briefing_email_clicked"]).gte("created_at", since).order("created_at", { ascending: true }), db.from("analytics_events").select("page_type, context").eq("event_name", "briefing_subscribe").gte("created_at", since)]);
  const counts: Record<string, number> = {}; for (const e of (eventCounts ?? [])) { counts[e.event_name] = (counts[e.event_name] || 0) + 1; }
  const dm = new Map<string, Record<string, number>>(); for (const e of (timeline ?? [])) { const ds = e.created_at.split("T")[0]; if (!dm.has(ds)) dm.set(ds, {}); const entry = dm.get(ds)!; entry[e.event_name] = (entry[e.event_name] || 0) + 1; }
  const dt = Array.from(dm.entries()).map(([date, data]) => ({ date, ...data })).sort((a, b) => a.date.localeCompare(b.date));
  const sm = new Map<string, number>(); for (const e of (sources ?? [])) { const ctx = e.context as Record<string, any> | null; const source = ctx?.source_section || e.page_type || "direct"; sm.set(source, (sm.get(source) || 0) + 1); }
  const sa = Array.from(sm.entries()).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);
  const { count: ts } = await db.from("briefing_subscribers").select("*", { count: "exact", head: true });
  const { count: cs } = await db.from("briefing_subscribers").select("*", { count: "exact", head: true }).eq("status", "confirmed");
  const { count: ao } = await db.from("briefing_opt_ins").select("*", { count: "exact", head: true }).eq("status", "active");
  const { count: ti } = await db.from("briefing_issues").select("*", { count: "exact", head: true });
  const { count: si } = await db.from("briefing_issues").select("*", { count: "exact", head: true }).eq("status", "sent");
  const { count: tr } = await db.from("briefing_issue_recipients").select("*", { count: "exact", head: true });
  const { count: to } = await db.from("briefing_issue_recipients").select("*", { count: "exact", head: true }).not("opened_at", "is", null);
  const { count: tc } = await db.from("briefing_issue_recipients").select("*", { count: "exact", head: true }).not("clicked_at", "is", null);
  const { count: tb } = await db.from("briefing_issue_recipients").select("*", { count: "exact", head: true }).not("bounced_at", "is", null);
  const { data: bs } = await db.from("briefing_catalog").select("id, slug, title, is_active, is_manual, send_every_days").order("sort_order");
  const pb = await Promise.all((bs ?? []).map(async (b: any) => {
    const { count: sc } = await db.from("briefing_opt_ins").select("*", { count: "exact", head: true }).eq("briefing_id", b.id).eq("status", "active");
    const { data: bi } = await db.from("briefing_issues").select("id").eq("briefing_id", b.id); const iids = (bi ?? []).map((i: any) => i.id);
    let o = 0, c = 0, b2 = 0, t = 0;
    if (iids.length > 0) { const [{ count: rc }, { count: oc }, { count: cc }, { count: bc2 }] = await Promise.all([db.from("briefing_issue_recipients").select("*", { count: "exact", head: true }).in("issue_id", iids), db.from("briefing_issue_recipients").select("*", { count: "exact", head: true }).in("issue_id", iids).not("opened_at", "is", null), db.from("briefing_issue_recipients").select("*", { count: "exact", head: true }).in("issue_id", iids).not("clicked_at", "is", null), db.from("briefing_issue_recipients").select("*", { count: "exact", head: true }).in("issue_id", iids).not("bounced_at", "is", null)]); t = rc ?? 0; o = oc ?? 0; c = cc ?? 0; b2 = bc2 ?? 0; }
    return { slug: b.slug, title: b.title, is_active: b.is_active, is_manual: b.is_manual, send_every_days: b.send_every_days, subscribers: sc ?? 0, issues: (bi ?? []).length, recipients: t, opens: o, clicks: c, bounces: b2, open_rate: t > 0 ? Math.round((o / t) * 100) : 0, click_rate: t > 0 ? Math.round((c / t) * 100) : 0 };
  }));
  return jO({ live_counts: { total_subscribers: ts ?? 0, confirmed_subscribers: cs ?? 0, active_opt_ins: ao ?? 0, total_issues: ti ?? 0, sent_issues: si ?? 0, total_recipients: tr ?? 0, total_opens: to ?? 0, total_clicks: tc ?? 0, total_bounces: tb ?? 0 }, event_counts: counts, daily_timeline: dt, source_attribution: sa, per_briefing: pb, days }, c);
}

// ═══ WEBHOOK ═══
async function handleWebhook(req: Request): Promise<Response> {
  const c: Record<string, string> = { "Content-Type": "application/json" };
  try { if (RW) { const svixId = req.headers.get("svix-id"); const svixTimestamp = req.headers.get("svix-timestamp"); const svixSignature = req.headers.get("svix-signature"); if (!svixId || !svixTimestamp || !svixSignature) return new Response(JSON.stringify({ error: "Missing Svix headers" }), { status: 401, headers: c }); const bodyText = await req.text(); const signedContent = `${svixId}.${svixTimestamp}.${bodyText}`; const encoder = new TextEncoder(); const keyData = encoder.encode(RW.split("whsec_").pop() || RW); const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]); const signature = hexToBytes(svixSignature); const isValid = await crypto.subtle.verify("HMAC", key, signature, encoder.encode(signedContent)); if (!isValid) return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: c }); const body = JSON.parse(bodyText); return await processWebhookEvent(body, c); } const body = await req.json(); return await processWebhookEvent(body, c); } catch (err) { const m = err instanceof Error ? err.message : String(err); return new Response(JSON.stringify({ error: "internal_error", message: m }), { status: 500, headers: c }); }
}

async function processWebhookEvent(body: any, c: Record<string, string>): Promise<Response> {
  const eventType = body?.type || body?.event || ""; const payload = body?.data ?? body; const db = createClient(SU, SK); const now = is(); const messageId = payload?.email_id;
  if (!messageId) return jO({ processed: false, reason: "missing_email_id" }, c);
  const webhookEvent = { type: eventType, timestamp: now, payload };
  const { data: recipients } = await db.from("briefing_issue_recipients").select("id, webhook_events, subscriber_id, issue_id").eq("resend_message_id", messageId);
  if (!recipients || recipients.length === 0) return jO({ processed: false, reason: "recipient_not_found", message_id: messageId }, c);
  const eventMap: Record<string, string> = { "email.delivered": "briefing_email_delivered", "email.opened": "briefing_email_opened", "email.clicked": "briefing_email_clicked", "email.bounced": "briefing_email_bounced", "email.complained": "briefing_email_complained" };
  const aen = eventMap[eventType] || `briefing_email_${eventType.replace("email.", "")}`;
  for (const recipient of recipients) { const events = recipient.webhook_events ?? []; events.push(webhookEvent); const update: Record<string, any> = { webhook_events: events }; switch (eventType) { case "email.delivered": update.delivery_status = "delivered"; if (!recipient.delivered_at) update.delivered_at = now; break; case "email.opened": update.delivery_status = "opened"; update.opened_at = now; break; case "email.clicked": update.delivery_status = "clicked"; update.clicked_at = now; break; case "email.bounced": update.delivery_status = "bounced"; update.bounced_at = now; break; case "email.complained": update.delivery_status = "complained"; break; } await db.from("briefing_issue_recipients").update(update).eq("id", recipient.id); trackAnalyticsEvent(db, aen, { pageUrl: "https://wakilisha.africa", pageType: "briefing_email", entitySlug: `recipient_${recipient.id}`, entityType: "briefing_recipient", sessionId: `wk_webhook_${messageId}`, context: { message_id: messageId, recipient_id: recipient.id, subscriber_id: recipient.subscriber_id, issue_id: recipient.issue_id, event_type: eventType, email: payload?.email ?? payload?.to ?? null } }); }
  return jO({ processed: true, event_type: eventType, message_id: messageId, matched_recipients: recipients.length, analytics_event: aen }, c);
}

function hexToBytes(hex: string): Uint8Array { const bytes = new Uint8Array(hex.length / 2); for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16); return bytes; }

function getIsoWeek(d: Date): string { const tmp = new Date(d.getTime()); tmp.setHours(0, 0, 0, 0); tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7)); const week1 = new Date(tmp.getFullYear(), 0, 4); const weekNum = 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7); return `${tmp.getFullYear()}-W${String(weekNum).padStart(2, "0")}`; }

function wrapBriefingHtml(bodyHtml: string, title: string, email: string, unsubToken: string, origin: string, branding: Branding = defaultBranding): string {
  const s = eH; const unsubUrl = `${origin}/briefing/unsubscribe?token=${unsubToken}`; const prefsUrl = `${origin}/briefing/preferences?token=${unsubToken}`;
  const accent = "#5C8E25";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${s(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
*{box-sizing:border-box}
table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse}
table{max-width:100%;table-layout:fixed}
img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none;display:block;max-width:100%;height:auto}
body{margin:0!important;padding:0!important;width:100%!important;background:#F7F8F3;color:#0C0D0A;font-family:${FNT}}
a{color:${s(accent)};text-decoration:none;overflow-wrap:anywhere;word-break:break-word}
.wk-shell{width:100%!important;max-width:760px!important}
.wk-card{width:100%!important;max-width:100%!important;table-layout:fixed!important;border:1px solid rgba(12,13,10,.14);border-radius:14px;overflow:hidden;background:#FFFFFF}
.wk-card td{max-width:100%!important;min-width:0!important}
.wk-eyebrow{font-family:${FNT};font-size:10px;line-height:1;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:${s(accent)};display:flex;align-items:center;gap:8px;overflow-wrap:anywhere;word-break:break-word}
.wk-h1{font-family:${FNT};font-size:52px;line-height:.94;font-weight:900;letter-spacing:-.045em;color:#0C0D0A}
.wk-h2{font-family:${FNT};font-size:30px;line-height:1.02;font-weight:900;letter-spacing:-.038em;color:#0C0D0A}
.wk-h3{font-family:${FNT};font-size:20px;line-height:1.15;font-weight:800;letter-spacing:-.02em;color:#0C0D0A}
.wk-h1,.wk-h2,.wk-h3,h1,h2,h3,p,div,span{max-width:100%;overflow-wrap:anywhere;word-break:break-word}
.wk-body{font-family:${FNT};font-size:15px;line-height:1.55;color:#3F4138}
.wk-muted{font-family:${FNT};font-size:13px;line-height:1.5;color:#6B6E62}
.wk-faint{font-family:${FNT};font-size:12px;line-height:1.4;color:#9A9C8E}
.wk-rank{font-family:${FNT};font-size:52px;line-height:1;font-weight:900;letter-spacing:-.04em}
.wk-button{display:inline-flex;align-items:center;gap:8px;border:1px solid ${s(accent)}44;border-radius:6px;padding:11px 18px;font-family:${FNT};font-size:13px;line-height:1;font-weight:700;letter-spacing:-.005em;color:${s(accent)};background:#fff;text-decoration:none}
@media screen and (max-width:640px){
  .wk-shell{width:100%!important;max-width:100%!important}
  .wk-pad{padding-left:18px!important;padding-right:18px!important}
  .wk-topbar td{display:block!important;width:100%!important;text-align:left!important;padding-bottom:8px!important}
  .wk-stack,.wk-stack-pad,.wk-route-cell{display:block!important;width:100%!important;max-width:100%!important;padding-left:0!important;padding-right:0!important;padding-bottom:16px!important}
  .wk-card,.wk-card tbody,.wk-card tr,.wk-card td{width:100%!important;max-width:100%!important}
  .wk-card img{width:100%!important;max-width:100%!important;height:auto!important}
  .wk-h1{font-size:34px!important;line-height:.98!important}
  .wk-h2{font-size:25px!important;line-height:1.08!important}
  .wk-h3{font-size:18px!important;line-height:1.22!important}
  .wk-rank{font-size:42px!important}
  .wk-button{display:block!important;text-align:center!important}
}</style></head><body style="margin:0;padding:0;background:#F7F8F3;font-family:${FNT};"><center role="article" aria-roledescription="email" lang="en" style="width:100%;background:#F7F8F3;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8F3;"><tr><td align="center" style="padding:24px 10px;"><table role="presentation" class="wk-shell" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:760px;background:#F7F8F3;border:1px solid rgba(12,13,10,.16);border-radius:20px;overflow:hidden;">
<tr><td style="padding:24px 34px;background:#EEF1E8;border-bottom:1px solid rgba(12,13,10,.12)">${logoHtml(branding.brandLogoUrl, branding.brandName, 22)}<div style="font-family:${FNT};font-size:13px;color:#6B6E62;margin-top:4px">${s(title)}</div></td></tr>
${bodyHtml}
<tr><td style="padding:20px 34px;background:#EEF1E8;border-top:1px solid rgba(12,13,10,.12);font-family:${FNT};font-size:12px;line-height:1.6;color:#6B6E62;"><p style="margin:0 0 8px;">You received this because you subscribed to <strong>${s(title)}</strong> as ${s(email)}.</p><p style="margin:0;"><a href="${s(unsubUrl)}" style="color:${s(accent)};font-weight:700;">Unsubscribe</a> &middot; <a href="${s(prefsUrl)}" style="color:${s(accent)};font-weight:700;">Manage preferences</a></p></td></tr>
</table></td></tr></table></center></body></html>`;
}

Deno.serve(async (req) => {
  const urlPath = new URL(req.url).pathname; if (urlPath.endsWith("/webhook") && req.method === "POST") return handleWebhook(req);
  const c = cR(req, "GET, POST, OPTIONS"); if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: c });
  try { const body = await req.json() as any; const action = String(body.action ?? "").trim(); const db = createClient(SU, SK);
    if (action === "cron_generate") return handleCronGenerate(body, c);

    if (action === "list_catalog") {
      const authHeader = req.headers.get("authorization") || "";
      if (authHeader.toLowerCase().startsWith("bearer ")) {
        const auth = await vJ(req);
        if (!auth) return jE("not_authenticated", "Valid JWT required for admin actions.", c, 401);
        const hasCap = await rC(auth.id, "manage_settings");
        if (!hasCap) return jE("permission_denied", "Requires manage_settings capability.", c, 403);
        return listCatalog(c, true);
      }

      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown";
      const rl = await ckRL(db, `briefing:public:${ip}`);
      if (!rl.allowed) return new Response(JSON.stringify({ ok: false, error: { code: "rate_limited", message: "Too many requests. Try again shortly." }, meta: { requestId: ri(), servedAt: is() } }), { status: 429, headers: { ...c, "Content-Type": "application/json", "Retry-After": "60" } });
      return listCatalog(c, false);
    }

    const adminActions = ["generate_issue","generate_issue_from_content","delete_issue","preview_issue","preview_content","send_issue","send_test","list_issues","list_subscribers","list_audience_segments","update_catalog","update_issue_content","briefing_analytics","get_issue"];
    if (adminActions.includes(action)) { const auth = await vJ(req); if (!auth) return jE("not_authenticated", "Valid JWT required for admin actions.", c, 401); const hasCap = await rC(auth.id, "manage_settings"); if (!hasCap) return jE("permission_denied", "Requires manage_settings capability.", c, 403);
      switch (action) { case "update_catalog": return handleUpdateCatalog(body, c); case "generate_issue": return handleGenerateIssue(body, c, auth); case "generate_issue_from_content": return handleGenerateIssueFromContent(body, c, auth); case "delete_issue": return handleDeleteIssue(body, c, auth); case "preview_issue": return handlePreviewIssue(body, c, auth); case "preview_content": return handlePreviewContent(body, c, auth); case "send_issue": return handleSendIssue(body, c, auth); case "send_test": return handleSendTest(body, c, auth); case "list_issues": return handleListIssues(body, c); case "list_subscribers": return handleListSubscribers(body, c); case "list_audience_segments": return handleListAudienceSegments(body, c); case "briefing_analytics": return handleBriefingAnalytics(body, c); case "get_issue": return handleGetIssue(body, c); case "update_issue_content": return handleUpdateIssueContent(body, c, auth); } }
    const publicActions = ["subscribe","confirm","unsubscribe","preferences"];
    if (publicActions.includes(action)) { const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown"; const rl = await ckRL(db, `briefing:public:${ip}`); if (!rl.allowed) return new Response(JSON.stringify({ ok: false, error: { code: "rate_limited", message: "Too many requests. Try again shortly." }, meta: { requestId: ri(), servedAt: is() } }), { status: 429, headers: { ...c, "Content-Type": "application/json", "Retry-After": "60" } }); const ua = req.headers.get("user-agent") || ""; switch (action) { case "list_catalog": return listCatalog(c, false); case "subscribe": return handleSubscribe(body, c, ip, ua); case "confirm": return handleConfirm(body, c); case "unsubscribe": return handleUnsubscribe(body, c); case "preferences": return handlePreferences(body, c); } }
    return jE("unknown_action", `Unknown action: "${action}".`, c);
  } catch (err) { const m = err instanceof Error ? err.message : String(err); return jE("internal_error", m, c, 500); }
});
