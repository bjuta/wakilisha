import { useMemo, useState } from 'react';
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
  { label: 'Copy', icon: 'Link' },
  { label: 'X', icon: 'Twitter' },
  { label: 'WhatsApp', icon: 'MessageCircle' },
  { label: 'Facebook', icon: 'Facebook' },
  { label: 'Native', icon: 'Share2' },
] as const;

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
  const url = useMemo(() => item.url || (typeof window !== 'undefined' ? window.location.href : ''), [item.url]);
  if (!open) return null;

  const copy = async () => {
    const finalUrl = timestamp ? `${url}${url.includes('?') ? '&' : '?'}t=${encodeURIComponent(timestamp)}` : url;
    try { await navigator.clipboard.writeText(finalUrl); } catch { /* no-op */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const nativeShare = async () => {
    if ('share' in navigator) {
      try { await navigator.share({ title: item.title, text: item.description || item.subtitle, url }); } catch { /* user cancelled */ }
    } else {
      await copy();
    }
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="share-sheet w-full">
        <div className="share-handle" />
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <div className="share-title">Share this {item.type ?? 'page'}</div>
            <div className="share-sub">Create a link, social share, or OG preview from the exact WAKILISHA object.</div>
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
            <button key={dest.label} className="share-dest" onClick={dest.label === 'Copy' ? copy : dest.label === 'Native' ? nativeShare : copy}>
              <span className="share-dest-icon"><WkIcon name={dest.icon as any} size={18} /></span>
              <span className="share-dest-label">{dest.label}</span>
            </button>
          ))}
        </div>
        <div className="share-link-row">
          <input className="share-link-input" readOnly value={url} />
          <button className="btn btn-sm btn-primary" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
        <OGPreviewCard item={{ ...item, url }} />
      </div>
    </div>
  );
}

export function ShareButton({ item, timestamp }: { item: ShareObject; timestamp?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-md btn-ghost" onClick={() => setOpen(true)}><WkIcon name="Share2" size={16} /> Share</button>
      <ShareSheet item={item} timestamp={timestamp} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
