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

export interface AudienceInterestInput {
  entity_type: "artist" | "track" | "release" | "guide" | "chart" | "genre" | "label" | "article" | "briefing";
  entity_slug: string;
  entity_name?: string;
  entity_id?: string;
  interest_kind?: "follow" | "subscribe" | "download" | "save" | "click" | "read" | "manual";
  source_form?: string;
  source_page?: string;
  source_context?: Record<string, unknown>;
  interest_strength?: number;
}

export interface SubscribeOptions {
  interests?: AudienceInterestInput[];
  source_form?: string;
  page_url?: string;
  page_type?: string;
  session_id?: string;
  referrer?: string;
}


export interface SubscribeResult {
  subscriber_id: string;
  email: string;
  briefings: string[];
  audience_interests?: Array<{
    entity_type: string;
    entity_slug: string;
    entity_name?: string;
    interest_kind: string;
    source_form: string;
    interest_strength: number;
  }>;
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

export interface AudienceSegmentRow {
  id: string;
  subscriber_id: string;
  email: string;
  subscriber_status: string;
  confirmed_at: string | null;
  entity_type: string;
  entity_slug: string;
  entity_name: string | null;
  interest_kind: string;
  source_form: string;
  source_page: string | null;
  interest_strength: number;
  status: string;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  briefings: Array<{ slug: string; title: string }>;
}

export interface AudienceSegmentSummary {
  total_interests: number;
  distinct_subscribers: number;
  confirmed_subscribers: number;
  active_interests: number;
  top_entities: Array<{ entity_type: string; entity_slug: string; entity_name: string | null; count: number }>;
  source_forms: Array<{ source_form: string; count: number }>;
  per_briefing: Array<{ slug: string; title: string; count: number }>;
}

export interface AudienceSegmentsResult {
  rows: AudienceSegmentRow[];
  summary: AudienceSegmentSummary;
  filters: Record<string, string | number | null>;
}

export interface AudienceSegmentSendFilters {
  subscriberStatus?: string;
  interestStatus?: string;
  briefingSlug?: string;
  entityType?: string;
  entitySlug?: string;
  sourceForm?: string;
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

  subscribe(email: string, briefingSlugs: string[], origin?: string, options: SubscribeOptions = {}): Promise<SubscribeResult> {
    return post("subscribe", {
      email,
      briefing_slugs: briefingSlugs,
      origin,
      ...options,
      ...getBrandingPayload(),
    });
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

    listAudienceSegments(opts?: {
      subscriberStatus?: string;
      interestStatus?: string;
      briefingSlug?: string;
      entityType?: string;
      entitySlug?: string;
      sourceForm?: string;
      limit?: number;
    }): Promise<AudienceSegmentsResult> {
      return adminPost("list_audience_segments", {
        subscriber_status: opts?.subscriberStatus ?? "",
        interest_status: opts?.interestStatus ?? "",
        briefing_slug: opts?.briefingSlug ?? "",
        entity_type: opts?.entityType ?? "",
        entity_slug: opts?.entitySlug ?? "",
        source_form: opts?.sourceForm ?? "",
        limit: opts?.limit ?? 250,
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

    sendIssue(issueId: string, segmentFilters?: AudienceSegmentSendFilters): Promise<{
      sent: boolean;
      sent_count: number;
      failed_count: number;
      total_subscribers: number;
      segment_send?: boolean;
      segment_filters?: Record<string, string | null>;
      message: string;
    }> {
      return adminPost("send_issue", {
        issue_id: issueId,
        ...(segmentFilters ? {
          segment_filters: {
            subscriber_status: segmentFilters.subscriberStatus ?? "",
            interest_status: segmentFilters.interestStatus ?? "",
            briefing_slug: segmentFilters.briefingSlug ?? "",
            entity_type: segmentFilters.entityType ?? "",
            entity_slug: segmentFilters.entitySlug ?? "",
            source_form: segmentFilters.sourceForm ?? "",
          },
        } : {}),
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