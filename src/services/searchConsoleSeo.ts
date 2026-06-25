import { supabase } from "@/lib/supabase";

const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

export type SearchConsoleRun = {
  id: string;
  status: "pending" | "running" | "succeeded" | "failed";
  site_url: string;
  start_date: string;
  end_date: string;
  row_count: number;
  total_clicks: number;
  total_impressions: number;
  average_ctr: number;
  average_position: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
};

export type SearchConsoleRow = {
  id?: string;
  run_id?: string;
  query: string | null;
  page_url: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SearchConsolePayload = {
  run: SearchConsoleRun | null;
  rows: SearchConsoleRow[];
};

function unwrap(payload: unknown): SearchConsolePayload {
  const root = payload as { data?: SearchConsolePayload };
  return {
    run: root?.data?.run ?? null,
    rows: root?.data?.rows ?? [],
  };
}

async function invokeSearchConsole(method: "GET" | "POST", body?: unknown): Promise<SearchConsolePayload> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error("You must be signed in to sync Search Console.");
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/search-console-sync`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.error ||
      payload?.message ||
      payload?.data?.error ||
      `Search Console function failed with HTTP ${response.status}.`;

    throw new Error(message);
  }

  return unwrap(payload);
}

export async function fetchSearchConsoleSeo(): Promise<SearchConsolePayload> {
  return invokeSearchConsole("GET");
}

export async function syncSearchConsoleSeo(input?: {
  startDate?: string;
  endDate?: string;
  siteUrl?: string;
}): Promise<SearchConsolePayload> {
  return invokeSearchConsole("POST", input ?? {});
}

export function formatCtr(value: number) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

export function formatPosition(value: number) {
  return Number(value || 0).toFixed(1);
}
