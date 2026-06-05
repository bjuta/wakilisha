import type { MagazineIssue, MagazineIssueArticle, MagazineSpread } from '@/services/magazineIssues';
import type { MagazineEditorialSystem } from '@/services/magazineNlg';
import { buildMagazineVisualBrief } from '@/services/magazineVisualDirector';
import { MAGAZINE_VISUAL_PALETTES } from '@/services/magazineVisualTaxonomy';
import type { MagazineVisualBrief } from '@/services/magazineVisualSchemas';
import './visualRenderer.css';

type VisualProps = {
  issue: MagazineIssue;
  spread: MagazineSpread;
  article?: MagazineIssueArticle;
  editorialSystem?: MagazineEditorialSystem;
  inline?: boolean;
  className?: string;
};

export function MagazineGeneratedVisual({ issue, spread, article, editorialSystem, inline = false, className = '' }: VisualProps) {
  const brief = buildMagazineVisualBrief({ issue, spread, article, editorialSystem });
  return <VisualAssetFrame brief={brief} inline={inline} className={className}><VisualByRenderer brief={brief} /></VisualAssetFrame>;
}

function VisualAssetFrame({ brief, inline, className, children }: { brief: MagazineVisualBrief; inline?: boolean; className?: string; children: React.ReactNode }) {
  const palette = MAGAZINE_VISUAL_PALETTES[brief.palette];
  return (
    <div
      className={`wk-mag-visual ${inline ? 'inline' : ''} ${className ?? ''}`}
      data-visual-type={brief.visual_type}
      data-renderer={brief.renderer_hint.renderer_family}
      style={{
        ['--visual-bg' as string]: String(brief.required_data.safe_background ?? palette.background),
        ['--visual-fg' as string]: String(brief.required_data.safe_foreground ?? palette.foreground),
        ['--visual-accent' as string]: String(brief.required_data.safe_accent ?? palette.accent),
      }}
    >
      {children}
    </div>
  );
}

function VisualByRenderer({ brief }: { brief: MagazineVisualBrief }) {
  switch (brief.renderer_hint.renderer_family) {
    case 'RouteVisual': return <RouteVisual brief={brief} />;
    case 'EvidenceBoardVisual': return <EvidenceBoardVisual brief={brief} />;
    case 'SignalVisual': return <SignalVisual brief={brief} />;
    case 'ArchiveVisual': return <ArchiveVisual brief={brief} />;
    case 'PosterVisual': return <PosterVisual brief={brief} />;
    case 'FieldGuideVisual': return <RouteVisual brief={brief} />;
    case 'ObjectVisual': return <ObjectVisual brief={brief} />;
    case 'PatronageVisual': return <PatronageVisual brief={brief} />;
    case 'ConstellationVisual': return <ConstellationVisual brief={brief} />;
    case 'AtmosphereVisual':
    default: return <AtmosphereVisual brief={brief} />;
  }
}

function datum(brief: MagazineVisualBrief, key: string, fallback = ''): string {
  const value = brief.required_data[key];
  if (Array.isArray(value)) return value.join(' · ');
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return value || fallback;
}

function dataList(brief: MagazineVisualBrief, key: string): string[] {
  const value = brief.required_data[key];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value) return value.split(/[,·]/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function RouteVisual({ brief }: { brief: MagazineVisualBrief }) {
  const origin = datum(brief, 'origin', 'Origin');
  const destination = datum(brief, 'destination', 'Destination');
  const cities = dataList(brief, 'cities').slice(0, 5);
  const years = dataList(brief, 'years').slice(0, 5);
  return (
    <>
      <svg viewBox="0 0 1000 720" preserveAspectRatio="none" aria-hidden="true">
        {Array.from({ length: 8 }).map((_, idx) => <line key={`h-${idx}`} className="wk-mag-visual-gridline" x1="0" x2="1000" y1={idx * 100 + 20} y2={idx * 100 + 20} />)}
        {Array.from({ length: 9 }).map((_, idx) => <line key={`v-${idx}`} className="wk-mag-visual-gridline" y1="0" y2="720" x1={idx * 120 + 20} x2={idx * 120 + 20} />)}
        <path className="wk-mag-visual-route" d="M185,545 C310,410 430,380 520,285 C640,160 720,180 812,130" />
        <circle className="wk-mag-visual-node-muted" cx="185" cy="545" r="8" />
        <circle className="wk-mag-visual-node" cx="812" cy="130" r="11" />
        <circle className="wk-mag-visual-node-muted" cx="385" cy="380" r="5" />
        <circle className="wk-mag-visual-node-muted" cx="610" cy="220" r="5" />
      </svg>
      <div className="wk-route-meta wk-mag-visual-panel">
        <p>Visual brief</p>
        <span>{brief.visual_type}</span>
        <p>Route</p>
        <span>{origin} → {destination}</span>
        {cities.length > 0 && <><p>Nodes</p><span>{cities.join(' / ')}</span></>}
        {years.length > 0 && <><p>Years</p><span>{years.join(' / ')}</span></>}
      </div>
      <div className="wk-route-copy">
        <div className="wk-mag-visual-label">{brief.editorial_intent}</div>
        <h2 className="wk-mag-visual-title">{origin}<br />to <em>{destination}</em></h2>
        <p className="wk-mag-visual-copy">{brief.rationale}</p>
      </div>
    </>
  );
}

function EvidenceBoardVisual({ brief }: { brief: MagazineVisualBrief }) {
  const keywords = dataList(brief, 'keywords').slice(0, 6);
  const years = dataList(brief, 'years').slice(0, 4);
  return (
    <div className="wk-evidence">
      <div>
        <div className="wk-mag-visual-label">Evidence / dossier</div>
        <h2 className="wk-mag-visual-title">The file beneath the culture.</h2>
        <p className="wk-mag-visual-copy">{brief.rationale}</p>
      </div>
      <div className="wk-evidence-board">
        {[...keywords, ...years].slice(0, 7).map((item, idx) => (
          <div className="wk-evidence-card" style={{ ['--r' as string]: `${idx % 2 === 0 ? -1.5 : 1.2}deg` }} key={`${item}-${idx}`}>
            <b>{idx < keywords.length ? 'claim' : 'date'}</b>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SignalVisual({ brief }: { brief: MagazineVisualBrief }) {
  const keywords = dataList(brief, 'keywords').slice(0, 8);
  return (
    <div className="wk-signal">
      <div>
        <div className="wk-mag-visual-label">Signal intelligence</div>
        <h2 className="wk-mag-visual-title">What the issue is quietly showing.</h2>
        <p className="wk-mag-visual-copy">{brief.rationale}</p>
      </div>
      <div className="wk-signal-bars">
        {keywords.map((keyword, idx) => (
          <div key={keyword}>
            <div className="wk-mag-visual-label" style={{ marginBottom: 5 }}>{String(idx + 1).padStart(2, '0')} · {keyword}</div>
            <div className="wk-signal-bar"><span style={{ ['--w' as string]: `${95 - idx * 8}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArchiveVisual({ brief }: { brief: MagazineVisualBrief }) {
  const years = dataList(brief, 'years');
  return (
    <div className="wk-archive">
      <div className="wk-archive-card">
        <div>
          <div className="wk-mag-visual-label">Archive file</div>
          <h2 className="wk-mag-visual-title">{datum(brief, 'article_title', 'Filed for memory')}</h2>
        </div>
        <div>
          <p className="wk-mag-visual-copy" style={{ color: '#2b2d27' }}>{brief.rationale}</p>
          <div className="wk-mag-visual-label" style={{ color: '#4e7a1e', marginTop: 22 }}>{years.length ? years.join(' / ') : brief.visual_type}</div>
        </div>
      </div>
    </div>
  );
}

function PosterVisual({ brief }: { brief: MagazineVisualBrief }) {
  const quote = datum(brief, 'quote', datum(brief, 'article_title', 'The record remains open.'));
  return <div className="wk-poster"><div><div className="wk-mag-visual-label">{brief.visual_type}</div><blockquote>“{quote}”</blockquote></div></div>;
}

function ObjectVisual({ brief }: { brief: MagazineVisualBrief }) {
  const keywords = dataList(brief, 'keywords').slice(0, 6);
  return (
    <div className="wk-object">
      <div className="wk-object-board"><span>{brief.visual_type.split('_')[0]}</span></div>
      <div>
        <div className="wk-mag-visual-label">Object / material board</div>
        <h2 className="wk-mag-visual-title">{datum(brief, 'article_title', 'Object study')}</h2>
        <p className="wk-mag-visual-copy">{brief.rationale}</p>
        <p className="wk-mag-visual-copy">{keywords.join(' · ')}</p>
      </div>
    </div>
  );
}

function AtmosphereVisual({ brief }: { brief: MagazineVisualBrief }) {
  return <div className="wk-atmosphere"><div><div className="wk-mag-visual-label">Atmosphere</div><h2 className="wk-mag-visual-title">{datum(brief, 'article_title', brief.visual_type)}</h2><p className="wk-mag-visual-copy">{brief.rationale}</p></div></div>;
}

function PatronageVisual({ brief }: { brief: MagazineVisualBrief }) {
  return <div className="wk-patronage"><div><div className="wk-patronage-seal"><span>✦</span></div><div className="wk-mag-visual-label">Cultural partner</div><h2 className="wk-mag-visual-title">Patronage, not interruption.</h2><p className="wk-mag-visual-copy">{brief.rationale}</p></div></div>;
}

function ConstellationVisual({ brief }: { brief: MagazineVisualBrief }) {
  const entities = dataList(brief, 'entities').slice(0, 9);
  return (
    <>
      <svg viewBox="0 0 1000 720" preserveAspectRatio="none" aria-hidden="true">
        {entities.map((_, idx) => {
          const x = 160 + ((idx * 173) % 690);
          const y = 120 + ((idx * 97) % 470);
          return <circle key={idx} className={idx === 0 ? 'wk-mag-visual-node' : 'wk-mag-visual-node-muted'} cx={x} cy={y} r={idx === 0 ? 9 : 5} />;
        })}
      </svg>
      <div className="wk-route-copy"><div className="wk-mag-visual-label">Network / constellation</div><h2 className="wk-mag-visual-title">People, places, pressure.</h2><p className="wk-mag-visual-copy">{entities.join(' · ') || brief.rationale}</p></div>
    </>
  );
}
