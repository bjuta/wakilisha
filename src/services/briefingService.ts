import { supabase } from "@/lib/supabase";
import { getSiteIdentitySettings } from "@/services/adminSettings/settingsStore";

const SU = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const BH = `${SU}/functions/v1/briefing-handler`;

export interface BriefingCatalogItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  cadence: string;
  send_day: string | null;
  send_time: string | null;
  send_every_days: number | null;
  is_manual: boolean;
  is_active: boolean;
  visual_config: Record<string, unknown> | null;
  sort_order: number;
}

export interface BriefingSectionItem {
  slug?: string;
  title?: string;
  name?: string;
  track_title?: string;
  artist_name?: string;
  artist?: string;
  display_name?: string;
  excerpt?: string;
  bio_excerpt?: string;
  contextText?: string;
  description?: string;
  image_url?: string;
  artwork_url?: string;
  imageUrl?: string;
  hero_url?: string;
  heroUrl?: string;
  coverUrl?: string;
  rank?: number;
  movement?: string;
  movementAmount?: number;
  type?: string;
  release_type?: string;
  author?: string;
  published_at?: string;
  url?: string;
  link?: string;
  genre?: string;
  label?: string;
  duration?: string;
  edition_slug?: string;
  chart_name?: string;
  readingTime?: number;
  date?: string;
  section?: string;
  country?: string;
  artistCount?: number;
  trackCount?: number;
  accentVar?: string;
}

export interface BriefingContentSection {
  title: string;
  type: string;
  items: BriefingSectionItem[];
  layout?: string;
}

export interface BriefingCuratedContent {
  sections: BriefingContentSection[];
  intro?: string;
  outro?: string;
  subject?: string;
}

export interface BriefingSubscriber {
  email: string;
  status: "pending" | "confirmed" | "unsubscribed";
  briefings: BriefingCatalogItem[];
}

export interface SubscribeResult {
  subscriber_id: string;
  email: string;
  briefings: string[];
  status: "pending_confirmation" | "already_confirmed";
  message: string;
}

export interface ConfirmResult {
  confirmed: boolean;
  email: string;
  message: string;
}

export interface UnsubscribeResult {
  unsubscribed: boolean;
  all?: boolean;
  briefing?: string;
  message: string;
}

export interface PreferencesResult {
  email: string;
  status: string;
  briefings: Array<BriefingCatalogItem & { subscribed: boolean }>;
}

interface ApiError {
  code: string;
  message: string;
  detail?: string;
}

/** Get brand identity from identity settings to inject into email templates */
function getBrandingPayload(): Record<string, string> {
  try {
    const identity = getSiteIdentitySettings();
    return {
      brand_name: identity.siteName || "WAKILISHA",
      brand_logo_url: identity.lightLogoUrl || identity.logoUrl || "",
      brand_favicon_url: identity.faviconUrl || ""
    };
  } catch {
    return { brand_name: "WAKILISHA", brand_logo_url: "", brand_favicon_url: "" };
  }
}

async function post(action: string, body: Record<string, unknown>) {
  const res = await fetch(BH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    const err = (data.error ?? { code: "unknown", message: "Something went wrong." }) as ApiError;
    throw new Error(err.message);
  }
  return data.data;
}

async function adminPost(action: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated — please log in to the admin panel.");

  const res = await fetch(BH, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    const err = (data.error ?? { code: "unknown", message: "Something went wrong." }) as ApiError;
    throw new Error(err.message);
  }
  return data.data;
}

export const briefingService = {
  listCatalog(): Promise<BriefingCatalogItem[]> {
    return post("list_catalog", {});
  },

  subscribe(email: string, briefingSlugs: string[], origin?: string): Promise<SubscribeResult> {
    return post("subscribe", { email, briefing_slugs: briefingSlugs, origin, ...getBrandingPayload() });
  },

  confirm(token: string): Promise<ConfirmResult> {
    return post("confirm", { token });
  },

  unsubscribe(token?: string, email?: string, briefingSlug?: string, all?: boolean): Promise<UnsubscribeResult> {
    return post("unsubscribe", { token, email, briefing_slug: briefingSlug, all });
  },

  preferences(token: string): Promise<PreferencesResult> {
    return post("preferences", { token });
  },

  // ── Admin ──

  admin: {
    listAllCatalog(): Promise<BriefingCatalogItem[]> {
      return adminPost("list_catalog", {});
    },

    listSubscribers(opts?: { status?: string; briefingSlug?: string; limit?: number }): Promise<any[]> {
      return adminPost("list_subscribers", {
        status: opts?.status ?? "",
        briefing_slug: opts?.briefingSlug ?? "",
        limit: opts?.limit ?? 100,
      });
    },

    listIssues(opts?: { briefingSlug?: string; status?: string; limit?: number }): Promise<any[]> {
      return adminPost("list_issues", {
        briefing_slug: opts?.briefingSlug ?? "",
        status: opts?.status ?? "",
        limit: opts?.limit ?? 50,
      });
    },

    getIssue(issueId: string): Promise<any> {
      return adminPost("get_issue", { issue_id: issueId });
    },

    generateIssue(briefingSlug: string): Promise<{ issue: any; briefing: any; content_stats: any }> {
      return adminPost("generate_issue", {
        briefing_slug: briefingSlug,
        ...getBrandingPayload(),
      });
    },

    generateIssueFromContent(briefingSlug: string, curatedContent: BriefingCuratedContent): Promise<{ issue: any; briefing: any; content_stats: any }> {
      return adminPost("generate_issue_from_content", {
        briefing_slug: briefingSlug,
        curated_content: curatedContent,
        ...getBrandingPayload(),
      });
    },

    updateIssueContent(issueId: string, curatedContent: BriefingCuratedContent): Promise<{ updated: boolean; issue: any; content_stats: any }> {
      return adminPost("update_issue_content", {
        issue_id: issueId,
        curated_content: curatedContent,
        ...getBrandingPayload(),
      });
    },

    deleteIssue(issueId: string): Promise<{ deleted: boolean; issue_id: string; message: string }> {
      return adminPost("delete_issue", { issue_id: issueId });
    },

    sendIssue(issueId: string): Promise<{ sent: boolean; sent_count: number; failed_count: number; total_subscribers: number; message: string }> {
      return adminPost("send_issue", {
        issue_id: issueId,
        ...getBrandingPayload(),
      });
    },

    sendTest(email: string, briefingSlug?: string): Promise<{ sent: boolean; email: string; subject: string; message: string }> {
      return adminPost("send_test", {
        email,
        briefing_slug: briefingSlug ?? "",
        ...getBrandingPayload(),
      });
    },

    updateCatalog(briefingId: string, updates: {
      is_active?: boolean;
      send_day?: string | null;
      send_time?: string | null;
      cadence?: string;
      send_every_days?: number | null;
      is_manual?: boolean;
    }): Promise<any> {
      return adminPost("update_catalog", { briefing_id: briefingId, ...updates });
    },

    previewIssue(briefingSlug: string): Promise<{
      preview: boolean;
      title: string;
      briefing: { slug: string; title: string };
      iso_week: string;
      html_body: string;
      plain_text: string;
      content_stats: { articles: number; chart_highlights: number; new_releases: number; featured_artists: number };
    }> {
      return adminPost("preview_issue", {
        briefing_slug: briefingSlug,
        ...getBrandingPayload(),
      });
    },

    previewContent(briefingSlug: string, curatedContent: BriefingCuratedContent): Promise<{
      preview: boolean;
      title: string;
      briefing: { slug: string; title: string };
      iso_week: string;
      html_body: string;
      plain_text: string;
      content_stats: { section_count: number; total_items: number };
    }> {
      return adminPost("preview_content", {
        briefing_slug: briefingSlug,
        curated_content: curatedContent,
        ...getBrandingPayload(),
      });
    },

    getBriefingAnalytics(days?: number): Promise<{
      live_counts: {
        total_subscribers: number; confirmed_subscribers: number; active_opt_ins: number;
        total_issues: number; sent_issues: number; total_recipients: number;
        total_opens: number; total_clicks: number; total_bounces: number;
      };
      event_counts: Record<string, number>;
      daily_timeline: Array<Record<string, number | string>>;
      source_attribution: Array<{ source: string; count: number }>;
      per_briefing: Array<{
        slug: string; title: string; is_active: boolean;
        subscribers: number; issues: number; recipients: number;
        opens: number; clicks: number; bounces: number;
        open_rate: number; click_rate: number;
      }>;
      days: number;
    }> {
      return adminPost("briefing_analytics", { days: days ?? 30 });
    },
  },
};