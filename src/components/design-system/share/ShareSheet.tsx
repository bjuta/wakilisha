import { useEffect, useMemo, useState } from 'react';
import { WkIcon } from '@/components/design-system/Icon';

type ShareObject = {
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string | null;
  url?: string;
  type?: 'track' | 'album' | 'article' | 'chart' | 'artist' | 'playlist' | 'page';
};

type ShareSheetProps = {
  item: ShareObject;
  open: boolean;
  onClose: () => void;
  timestamp?: string;
};

const destinations = [
  { label: 'Copy', icon: 'Link', kind: 'copy' },
  { label: 'X', icon: 'Twitter', kind: 'x' },
  { label: 'WhatsApp', icon: 'MessageCircle', kind: 'whatsapp' },
  { label: 'Facebook', icon: 'Facebook', kind: 'facebook' },
  { label: 'Email', icon: 'Mail', kind: 'email' },
  { label: 'Native', icon: 'Share2', kind: 'native' },
] as const;

const objectTypeLabel: Record<NonNullable<ShareObject['type']>, string> = {
  track: 'track',
  album: 'album',
  article: 'article',
  chart: 'chart edition',
  artist: 'artist page',
  playlist: 'playlist',
  page: 'page',
};

function getFinalUrl(baseUrl: string, timestamp?: string) {
  if (!timestamp) return baseUrl;
  return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}t=${encodeURIComponent(timestamp)}`;
}

function openPopup(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer,width=720,height=640');
}

export function OGPreviewCard({ item }: { item: ShareObject }) {
  const url = item.url || (typeof window !== 'undefined' ? window.location.href : 'wakilisha.africa');
  return (
    <div className="share-og-card">
      <div className="share-og-img">
        {item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}
      </div>
      <div className="share-og-body">
        <div className="share-og-url">{url.replace(/^https?:\/\//, '').slice(0, 48)}</div>
        <div className="share-og-title">{item.title}</div>
        {item.description && <div className="share-og-desc">{item.description}</div>}
      </div>
    </div>
  );
}

export function ShareSheet({ item, open, onClose, timestamp }: ShareSheetProps) {
  const [copied, setCopied] = useState(false);
  const baseUrl = useMemo(() => item.url || (typeof window !== 'undefined' ? window.location.href : ''), [item.url]);
  const finalUrl = useMemo(() => getFinalUrl(baseUrl, timestamp), [baseUrl, timestamp]);
  const shareText = item.description || item.subtitle || item.title;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const copy = async () => {
    try { await navigator.clipboard.writeText(finalUrl); } catch { /* no-op */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const nativeShare = async () => {
    if ('share' in navigator) {
      try { await navigator.share({ title: item.title, text: shareText, url: finalUrl }); } catch { /* user cancelled */ }
    } else {
      await copy();
    }
  };

  const handleDestination = async (kind: typeof destinations[number]['kind']) => {
    const encodedUrl = encodeURIComponent(finalUrl);
    const encodedText = encodeURIComponent(`${item.title}${item.subtitle ? ` — ${item.subtitle}` : ''}`);
    if (kind === 'copy') return copy();
    if (kind === 'native') return nativeShare();
    if (kind === 'x') return openPopup(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`);
    if (kind === 'whatsapp') return openPopup(`https://wa.me/?text=${encodedText}%20${encodedUrl}`);
    if (kind === 'facebook') return openPopup(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`);
    if (kind === 'email') return window.location.href = `mailto:?subject=${encodedText}&body=${encodeURIComponent(`${shareText}\n\n${finalUrl}`)}`;
  };

  return (
    <div className="share-sheet-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="share-sheet w-full" onClick={(event) => event.stopPropagation()}>
        <div className="share-handle" />
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <div className="share-title">Share this {objectTypeLabel[item.type ?? 'page']}</div>
            <div className="share-sub">Send the live link, copy a timestamped URL, or preview how the WAKILISHA card will travel.</div>
          </div>
          <button className="chart-btn" onClick={onClose} aria-label="Close share sheet"><WkIcon name="X" size={16} /></button>
        </div>
        <div className="share-preview">
          <div className="share-preview-art">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}</div>
          <div>
            <div className="share-preview-title">{item.title}</div>
            {item.subtitle && <div className="share-preview-sub">{item.subtitle}</div>}
          </div>
        </div>
        {timestamp && (
          <div className="share-timestamp">
            <div className="share-timestamp-label">Share from timestamp</div>
            <div className="share-timestamp-toggle"><WkIcon name="Clock3" size={14} /> {timestamp}</div>
          </div>
        )}
        <div className="share-destinations">
          {destinations.map((dest) => (
            <button key={dest.label} className="share-dest" onClick={() => handleDestination(dest.kind)}>
              <span className="share-dest-icon"><WkIcon name={dest.icon as any} size={18} /></span>
              <span className="share-dest-label">{dest.label}</span>
            </button>
          ))}
        </div>
        <div className="share-link-row">
          <input className="share-link-input" readOnly value={finalUrl} />
          <button className="btn btn-sm btn-primary" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
        <OGPreviewCard item={{ ...item, url: finalUrl }} />
        <div className="wk-lucide-note mt-4"><WkIcon name="PenTool" size={13} /> Lucide outline icons · 2px stroke · filled states only when active</div>
      </div>
    </div>
  );
}

export function ShareButton({ item, timestamp, label = 'Share' }: { item: ShareObject; timestamp?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-md btn-ghost" onClick={() => setOpen(true)}><WkIcon name="Share2" size={16} /> {label}</button>
      <ShareSheet item={item} timestamp={timestamp} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
