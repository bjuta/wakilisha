import {
  briefingService,
  type AudienceInterestInput,
  type SubscribeResult,
} from "@/services/briefingService";

export const BRIEFING_SLUGS = {
  cultureDispatch: ["culture-dispatch"],
  artistSignals: ["artist-signals"],
  fieldGuides: ["field-guides"],
  weeklyEditorial: ["weekly-editorial"],
} as const;

type SubscribeContext = {
  sourceForm: string;
  pageType: string;
  pageUrl?: string;
  sessionId?: string;
  referrer?: string;
  sourceContext?: Record<string, unknown>;
  interests?: AudienceInterestInput[];
};

function runtimeOrigin() {
  return typeof window !== "undefined" ? window.location.origin : "https://wakilisha.africa";
}

function runtimePageUrl(fallback?: string) {
  if (fallback) return fallback;
  return typeof window !== "undefined" ? window.location.href : "https://wakilisha.africa";
}

function runtimeReferrer(fallback?: string) {
  if (fallback !== undefined) return fallback;
  return typeof document !== "undefined" ? document.referrer || undefined : undefined;
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

export async function subscribeToBriefings(
  email: string,
  briefingSlugs: readonly string[],
  context: SubscribeContext,
): Promise<SubscribeResult> {
  return briefingService.subscribe(
    normalizeEmail(email),
    [...briefingSlugs],
    runtimeOrigin(),
    {
      source_form: context.sourceForm,
      page_url: runtimePageUrl(context.pageUrl),
      page_type: context.pageType,
      session_id: context.sessionId,
      referrer: runtimeReferrer(context.referrer),
      interests: context.interests ?? [],
    },
  );
}

export function artistInterest(input: {
  slug: string;
  name: string;
  sourceForm: string;
  sourceContext?: Record<string, unknown>;
  strength?: number;
}): AudienceInterestInput {
  return {
    entity_type: "artist",
    entity_slug: input.slug,
    entity_name: input.name,
    interest_kind: "follow",
    source_form: input.sourceForm,
    interest_strength: input.strength ?? 80,
    source_context: input.sourceContext,
  };
}

export function guideInterest(input: {
  slug: string;
  title: string;
  sourceForm: string;
  sourceContext?: Record<string, unknown>;
  strength?: number;
  kind?: "follow" | "download" | "read" | "subscribe";
}): AudienceInterestInput {
  return {
    entity_type: "guide",
    entity_slug: input.slug,
    entity_name: input.title,
    interest_kind: input.kind ?? "download",
    source_form: input.sourceForm,
    interest_strength: input.strength ?? 70,
    source_context: input.sourceContext,
  };
}

export function briefingInterest(input: {
  slug: string;
  title: string;
  sourceForm: string;
  sourceContext?: Record<string, unknown>;
  strength?: number;
}): AudienceInterestInput {
  return {
    entity_type: "briefing",
    entity_slug: input.slug,
    entity_name: input.title,
    interest_kind: "subscribe",
    source_form: input.sourceForm,
    interest_strength: input.strength ?? 50,
    source_context: input.sourceContext,
  };
}
