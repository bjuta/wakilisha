import { useEffect, useMemo, useState } from 'react';
import type { MagazineVisualBrief } from './magazineVisualSchemas';

export type MagazineVisualAssetStatus = 'draft' | 'generated' | 'approved' | 'rejected' | 'locked';

export type MagazineVisualAsset = {
  id: string;
  issue_id: string;
  issue_slug?: string | null;
  spread_id: string;
  article_id?: string | null;
  visual_family: string;
  visual_type: string;
  editorial_intent: string;
  treatment: string;
  palette: string;
  contrast_mode: string;
  visual_brief_json: MagazineVisualBrief;
  status: MagazineVisualAssetStatus;
  notes?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  approved_at?: string | null;
  approved_by?: string | null;
  locked_at?: string | null;
  locked_by?: string | null;
  rejected_at?: string | null;
  rejected_by?: string | null;
};

const STORAGE_KEY = 'wakilisha.magazine.visual_assets.v1.fallback';
const EVENT_NAME = 'wakilisha:magazine-visual-assets-updated';
const DEFAULT_USER = 'Muiruri Beautah';
const API_BASE = String(import.meta.env.VITE_WAKILISHA_PUBLIC_API_BASE ?? '/api/v1').replace(/\/$/, '');
const API_PATH = `${API_BASE}/magazine/visual-assets`;

function now() { return new Date().toISOString(); }
function canUseStorage() { return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'; }
function emitChange() { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT_NAME)); }
function readLocal(): MagazineVisualAsset[] { if (!canUseStorage()) return []; try { const raw = window.localStorage.getItem(STORAGE_KEY); if (!raw) return []; const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function writeLocal(assets: MagazineVisualAsset[]) { if (!canUseStorage()) return; window.localStorage.setItem(STORAGE_KEY, JSON.stringify(assets)); }
function sortAssets(assets: MagazineVisualAsset[]) { return [...assets].sort((a, b) => b.updated_at.localeCompare(a.updated_at)); }
async function request<T>(url: string, init?: Record<string, unknown>): Promise<T> { const response = await fetch(url, { ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...((init?.headers as Record<string, string>) ?? {}) } }); if (!response.ok) throw new Error(`Visual assets API ${response.status}`); return response.json() as Promise<T>; }

type Envelope<T> = { data?: T };

export function visualAssetIdFromBrief(brief: MagazineVisualBrief) { return brief.id; }

export function createVisualAssetFromBrief(brief: MagazineVisualBrief, status: MagazineVisualAssetStatus = 'generated'): MagazineVisualAsset {
  const timestamp = now();
  return {
    id: visualAssetIdFromBrief(brief),
    issue_id: brief.issue_id,
    spread_id: brief.spread_id,
    article_id: brief.article_id ?? null,
    visual_family: brief.visual_family,
    visual_type: brief.visual_type,
    editorial_intent: brief.editorial_intent,
    treatment: brief.treatment,
    palette: brief.palette,
    contrast_mode: brief.contrast_mode,
    visual_brief_json: brief,
    status,
    created_by: DEFAULT_USER,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function upsertLocalFromBrief(brief: MagazineVisualBrief, status: MagazineVisualAssetStatus = 'generated'): MagazineVisualAsset {
  const assets = readLocal();
  const existing = assets.find((asset) => asset.id === brief.id);
  const timestamp = now();
  const next: MagazineVisualAsset = existing ? {
    ...existing,
    issue_id: brief.issue_id,
    spread_id: brief.spread_id,
    article_id: brief.article_id ?? null,
    visual_family: brief.visual_family,
    visual_type: brief.visual_type,
    editorial_intent: brief.editorial_intent,
    treatment: brief.treatment,
    palette: brief.palette,
    contrast_mode: brief.contrast_mode,
    visual_brief_json: brief,
    status: existing.status === 'locked' ? 'locked' : status,
    updated_at: timestamp,
  } : createVisualAssetFromBrief(brief, status);
  writeLocal([next, ...assets.filter((asset) => asset.id !== next.id)]);
  emitChange();
  return next;
}

function setLocalStatus(id: string, status: MagazineVisualAssetStatus, actor = DEFAULT_USER): MagazineVisualAsset | null {
  const assets = readLocal();
  const existing = assets.find((asset) => asset.id === id);
  if (!existing) return null;
  const timestamp = now();
  const nextStatus = existing.status === 'locked' && status !== 'locked' ? 'locked' : status;
  const next: MagazineVisualAsset = {
    ...existing,
    status: nextStatus,
    updated_at: timestamp,
    approved_at: nextStatus === 'approved' || nextStatus === 'locked' ? existing.approved_at ?? timestamp : existing.approved_at,
    approved_by: nextStatus === 'approved' || nextStatus === 'locked' ? existing.approved_by ?? actor : existing.approved_by,
    locked_at: nextStatus === 'locked' ? existing.locked_at ?? timestamp : existing.locked_at,
    locked_by: nextStatus === 'locked' ? existing.locked_by ?? actor : existing.locked_by,
    rejected_at: nextStatus === 'rejected' ? timestamp : existing.rejected_at,
    rejected_by: nextStatus === 'rejected' ? actor : existing.rejected_by,
  };
  writeLocal([next, ...assets.filter((asset) => asset.id !== id)]);
  emitChange();
  return next;
}

export const magazineVisualAssetStore = {
  async list(): Promise<MagazineVisualAsset[]> {
    try {
      const result = await request<Envelope<{ assets: MagazineVisualAsset[] }>>(API_PATH);
      return sortAssets(result.data?.assets ?? []);
    } catch (error) {
      console.warn('[magazineVisualAssets] API unavailable, using local fallback list.', error);
      return sortAssets(readLocal());
    }
  },

  async get(id: string): Promise<MagazineVisualAsset | null> {
    try {
      const result = await request<Envelope<{ asset: MagazineVisualAsset }>>(`${API_PATH}/${encodeURIComponent(id)}`);
      return result.data?.asset ?? null;
    } catch {
      return readLocal().find((asset) => asset.id === id) ?? null;
    }
  },

  async getActiveForPublic(id: string): Promise<MagazineVisualAsset | null> {
    const asset = await this.get(id);
    if (!asset) return null;
    return asset.status === 'approved' || asset.status === 'locked' ? asset : null;
  },

  async upsertFromBrief(brief: MagazineVisualBrief, status: MagazineVisualAssetStatus = 'generated'): Promise<MagazineVisualAsset> {
    const fallback = upsertLocalFromBrief(brief, status);
    try {
      const result = await request<Envelope<{ asset: MagazineVisualAsset }>>(API_PATH, { method: 'POST', body: JSON.stringify({ ...fallback, status }) });
      const asset = result.data?.asset ?? fallback;
      writeLocal([asset, ...readLocal().filter((item) => item.id !== asset.id)]);
      emitChange();
      return asset;
    } catch (error) {
      console.warn('[magazineVisualAssets] API upsert failed; local fallback saved.', error);
      return fallback;
    }
  },

  async setStatus(id: string, status: MagazineVisualAssetStatus, actor = DEFAULT_USER): Promise<MagazineVisualAsset | null> {
    const fallback = setLocalStatus(id, status, actor);
    try {
      const result = await request<Envelope<{ asset: MagazineVisualAsset }>>(`${API_PATH}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status, actor }) });
      const asset = result.data?.asset ?? fallback;
      if (asset) writeLocal([asset, ...readLocal().filter((item) => item.id !== asset.id)]);
      emitChange();
      return asset;
    } catch (error) {
      console.warn('[magazineVisualAssets] API status update failed; local fallback used.', error);
      return fallback;
    }
  },

  async remove(id: string) {
    writeLocal(readLocal().filter((asset) => asset.id !== id));
    emitChange();
    try { await request(`${API_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE' }); } catch (error) { console.warn('[magazineVisualAssets] API delete failed; local fallback removed.', error); }
  },

  async clearUnlocked() {
    writeLocal(readLocal().filter((asset) => asset.status === 'locked'));
    emitChange();
    try { await request(`${API_PATH}/clear-unlocked`, { method: 'DELETE' }); } catch (error) { console.warn('[magazineVisualAssets] API clear failed; local fallback cleared.', error); }
  }
};

export function useMagazineVisualAssets() {
  const [assets, setAssets] = useState<MagazineVisualAsset[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    magazineVisualAssetStore.list().then((items) => { if (mounted) { setAssets(items); setLoading(false); } });
    const handler = () => magazineVisualAssetStore.list().then((items) => mounted && setAssets(items));
    window.addEventListener(EVENT_NAME, handler);
    return () => { mounted = false; window.removeEventListener(EVENT_NAME, handler); };
  }, []);
  return useMemo(() => ({ assets, loading }), [assets, loading]);
}
