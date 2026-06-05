import { useEffect, useMemo, useState } from 'react';
import type { MagazineVisualBrief } from './magazineVisualSchemas';

export type MagazineVisualAssetStatus = 'draft' | 'generated' | 'approved' | 'rejected' | 'locked';

export type MagazineVisualAsset = {
  id: string;
  issue_id: string;
  issue_slug?: string;
  spread_id: string;
  article_id?: string;
  visual_family: string;
  visual_type: string;
  editorial_intent: string;
  treatment: string;
  palette: string;
  contrast_mode: string;
  visual_brief_json: MagazineVisualBrief;
  status: MagazineVisualAssetStatus;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  approved_at?: string;
  approved_by?: string;
  locked_at?: string;
  locked_by?: string;
  rejected_at?: string;
  rejected_by?: string;
};

const STORAGE_KEY = 'wakilisha.magazine.visual_assets.v1';
const EVENT_NAME = 'wakilisha:magazine-visual-assets-updated';
const DEFAULT_USER = 'Muiruri Beautah';

function now() {
  return new Date().toISOString();
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function emitChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

function readAll(): MagazineVisualAsset[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('[magazineVisualAssets] Failed to read local visual assets', error);
    return [];
  }
}

function writeAll(assets: MagazineVisualAsset[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
  emitChange();
}

export function visualAssetIdFromBrief(brief: MagazineVisualBrief) {
  return brief.id;
}

export function createVisualAssetFromBrief(brief: MagazineVisualBrief, status: MagazineVisualAssetStatus = 'generated'): MagazineVisualAsset {
  const timestamp = now();
  return {
    id: visualAssetIdFromBrief(brief),
    issue_id: brief.issue_id,
    spread_id: brief.spread_id,
    article_id: brief.article_id,
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

export const magazineVisualAssetStore = {
  list(): MagazineVisualAsset[] {
    return readAll().sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  },

  get(id: string): MagazineVisualAsset | null {
    return readAll().find((asset) => asset.id === id) ?? null;
  },

  getActiveForPublic(id: string): MagazineVisualAsset | null {
    const asset = this.get(id);
    if (!asset) return null;
    return asset.status === 'approved' || asset.status === 'locked' ? asset : null;
  },

  upsertFromBrief(brief: MagazineVisualBrief, status: MagazineVisualAssetStatus = 'generated'): MagazineVisualAsset {
    const assets = readAll();
    const id = visualAssetIdFromBrief(brief);
    const existing = assets.find((asset) => asset.id === id);
    let next: MagazineVisualAsset;
    if (existing) {
      next = {
        ...existing,
        issue_id: brief.issue_id,
        spread_id: brief.spread_id,
        article_id: brief.article_id,
        visual_family: brief.visual_family,
        visual_type: brief.visual_type,
        editorial_intent: brief.editorial_intent,
        treatment: brief.treatment,
        palette: brief.palette,
        contrast_mode: brief.contrast_mode,
        visual_brief_json: brief,
        status: existing.status === 'locked' ? 'locked' : status,
        updated_at: now(),
      };
    } else {
      next = createVisualAssetFromBrief(brief, status);
    }
    writeAll([next, ...assets.filter((asset) => asset.id !== id)]);
    return next;
  },

  setStatus(id: string, status: MagazineVisualAssetStatus, actor = DEFAULT_USER): MagazineVisualAsset | null {
    const assets = readAll();
    const existing = assets.find((asset) => asset.id === id);
    if (!existing) return null;
    const timestamp = now();
    const next: MagazineVisualAsset = {
      ...existing,
      status: existing.status === 'locked' && status !== 'locked' ? 'locked' : status,
      updated_at: timestamp,
      approved_at: status === 'approved' || status === 'locked' ? existing.approved_at ?? timestamp : existing.approved_at,
      approved_by: status === 'approved' || status === 'locked' ? existing.approved_by ?? actor : existing.approved_by,
      locked_at: status === 'locked' ? existing.locked_at ?? timestamp : existing.locked_at,
      locked_by: status === 'locked' ? existing.locked_by ?? actor : existing.locked_by,
      rejected_at: status === 'rejected' ? timestamp : existing.rejected_at,
      rejected_by: status === 'rejected' ? actor : existing.rejected_by,
    };
    writeAll([next, ...assets.filter((asset) => asset.id !== id)]);
    return next;
  },

  remove(id: string) {
    writeAll(readAll().filter((asset) => asset.id !== id));
  },

  clearUnlocked() {
    writeAll(readAll().filter((asset) => asset.status === 'locked'));
  },
};

export function useMagazineVisualAssets() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const handler = () => setVersion((value) => value + 1);
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);
  return useMemo(() => magazineVisualAssetStore.list(), [version]);
}

export function useMagazineVisualAsset(id: string, publicOnly = false) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const handler = () => setVersion((value) => value + 1);
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);
  return useMemo(() => publicOnly ? magazineVisualAssetStore.getActiveForPublic(id) : magazineVisualAssetStore.get(id), [id, publicOnly, version]);
}
