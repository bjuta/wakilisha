import type { CommunityEntity } from "./types";

export type PendingCommunityActionType = "save" | "follow";

export interface PendingCommunityAction {
  action: PendingCommunityActionType;
  entity: CommunityEntity;
  returnTo: string;
  createdAt: number;
}

const STORAGE_KEY = "wk_pending_community_action";
const MAX_AGE_MS = 60 * 60 * 1000;

function currentPath(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}` || "/";
}

export function getSafeReturnTo(raw?: string | null): string {
  if (!raw) return currentPath();

  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const url = new URL(raw);
      if (typeof window !== "undefined" && url.origin !== window.location.origin) return "/";
      return `${url.pathname}${url.search}${url.hash}` || "/";
    }

    if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
    if (raw.startsWith("/auth")) return "/";
    return raw;
  } catch {
    return "/";
  }
}

export function buildCommunityAuthUrl(returnTo = currentPath()): string {
  if (typeof window === "undefined") return "/auth";
  const url = new URL("/auth", window.location.origin);
  url.searchParams.set("returnTo", getSafeReturnTo(returnTo));
  return `${url.pathname}${url.search}`;
}

export function stashPendingCommunityAction(input: {
  action: PendingCommunityActionType;
  entity: CommunityEntity;
  returnTo?: string;
}): void {
  if (typeof window === "undefined") return;

  const payload: PendingCommunityAction = {
    action: input.action,
    entity: input.entity,
    returnTo: getSafeReturnTo(input.returnTo || currentPath()),
    createdAt: Date.now(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // no-op: storage can be disabled in privacy modes
  }
}

export function consumePendingCommunityAction(): PendingCommunityAction | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    localStorage.removeItem(STORAGE_KEY);

    const parsed = JSON.parse(raw) as PendingCommunityAction;
    if (!parsed?.action || !parsed?.entity || !parsed?.createdAt) return null;
    if (Date.now() - parsed.createdAt > MAX_AGE_MS) return null;

    return parsed;
  } catch {
    return null;
  }
}
