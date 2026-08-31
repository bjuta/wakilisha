import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  REGISTRY_STEWARD_RULE_VERSION,
  proposeTrackStewardRepair,
  type TrackFeaturedCredit,
  type TrackStewardProposal,
} from "../_shared/registry-steward.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const ALLOWED_ORIGINS = new Set([
  "https://wakilisha.africa",
  "https://www.wakilisha.africa",
  "https://staging.wakilisha.africa",
]);

type Db = ReturnType<typeof createClient>;

type TrackRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
};

type CreditRow = {
  track_id: string;
  artist_slug: string | null;
  artist_name_text: string | null;
  is_primary: boolean | null;
  is_featured: boolean | null;
  status: string;
};

type AuditCandidate = {
  trackId: string;
  title: string;
  slug: string;
  primaryArtistSlugs: string[];
  featuredCredits: TrackFeaturedCredit[];
  proposal: TrackStewardProposal;
  effectiveProposal: TrackStewardProposal;
  automatic: boolean;
  blockedReason: string | null;
  routeDeferredReason: string | null;
  redirectConflict: string | null;
};

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://wakilisha.africa";

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}

function json(
  req: Request,
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(req),
  });
}

function boundedLimit(
  raw: unknown,
  fallback: number,
  max: number,
): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(Math.floor(value), max));
}

async function canRunSteward(
  req: Request,
  db: Db,
): Promise<{
  allowed: boolean;
  actor: string;
}> {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    return { allowed: false, actor: "" };
  }

  if (SERVICE_KEY && token === SERVICE_KEY) {
    return {
      allowed: true,
      actor: "service:service_role",
    };
  }

  const userClient = createClient(
    SUPABASE_URL,
    SERVICE_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
      },
    },
  );

  const {
    data: { user },
    error,
  } = await userClient.auth.getUser(token);

  if (error || !user) {
    return { allowed: false, actor: "" };
  }

  const { data: assignments } = await db
    .from("user_role_assignments")
    .select("role_key")
    .eq("user_id", user.id)
    .eq("status", "active");

  const roleKeys = (assignments ?? [])
    .map((row: { role_key: string }) => row.role_key)
    .filter(Boolean);

  if (roleKeys.includes("administrator")) {
    return {
      allowed: true,
      actor: `user:${user.id}`,
    };
  }

  if (roleKeys.length === 0) {
    return { allowed: false, actor: "" };
  }

  const { data: capabilities } = await db
    .from("role_capabilities")
    .select("capability_key")
    .in("role_key", roleKeys)
    .eq("capability_key", "manage_registry");

  return {
    allowed: (capabilities ?? []).length > 0,
    actor: `user:${user.id}`,
  };
}

function creditGroups(
  credits: CreditRow[],
): {
  primaryByTrack: Map<string, string[]>;
  featuredByTrack: Map<string, TrackFeaturedCredit[]>;
} {
  const primaryByTrack = new Map<string, string[]>();
  const featuredByTrack =
    new Map<string, TrackFeaturedCredit[]>();

  for (const credit of credits) {
    if (credit.status !== "active") continue;
    const trackId = String(credit.track_id || "");
    if (!trackId) continue;

    if (credit.is_primary && credit.artist_slug) {
      const current = primaryByTrack.get(trackId) ?? [];
      if (!current.includes(credit.artist_slug)) {
        current.push(credit.artist_slug);
      }
      primaryByTrack.set(trackId, current);
    }

    if (credit.is_featured) {
      const current = featuredByTrack.get(trackId) ?? [];
      current.push({
        name: credit.artist_name_text,
        slug: credit.artist_slug,
      });
      featuredByTrack.set(trackId, current);
    }
  }

  return {
    primaryByTrack,
    featuredByTrack,
  };
}

async function auditTrackPage(
  db: Db,
  input: {
    afterId?: string | null;
    limit: number;
  },
): Promise<{
  scanned: number;
  nextCursor: string | null;
  candidates: AuditCandidate[];
  counts: {
    autoApply: number;
    noop: number;
    deferred: number;
    collisionBlocked: number;
    redirectBlocked: number;
    routeDeferred: number;
    missingPrimaryArtist: number;
  };
}> {
  let query = db
    .from("registry_tracks")
    .select("id, title, slug, status")
    .eq("status", "active")
    .order("id", { ascending: true })
    .limit(input.limit);

  if (input.afterId) {
    query = query.gt("id", input.afterId);
  }

  const { data: tracks, error: trackError } = await query;
  if (trackError) {
    throw new Error(
      `Registry Steward Track audit failed: ${trackError.message}`,
    );
  }

  const trackRows = (tracks ?? []) as TrackRow[];
  const trackIds = trackRows.map((track) => track.id);

  if (trackIds.length === 0) {
    return {
      scanned: 0,
      nextCursor: null,
      candidates: [],
      counts: {
        autoApply: 0,
        noop: 0,
        deferred: 0,
        collisionBlocked: 0,
        redirectBlocked: 0,
        routeDeferred: 0,
        missingPrimaryArtist: 0,
      },
    };
  }

  const { data: creditData, error: creditError } = await db
    .from("registry_track_artists")
    .select(
      "track_id, artist_slug, artist_name_text, is_primary, is_featured, status",
    )
    .in("track_id", trackIds)
    .eq("status", "active");

  if (creditError) {
    throw new Error(
      `Registry Steward credit audit failed: ${creditError.message}`,
    );
  }

  const credits = (creditData ?? []) as CreditRow[];
  const {
    primaryByTrack,
    featuredByTrack,
  } = creditGroups(credits);

  const provisional = trackRows.map((track) => ({
    track,
    primaryArtistSlugs:
      primaryByTrack.get(track.id) ?? [],
    featuredCredits:
      featuredByTrack.get(track.id) ?? [],
    proposal: proposeTrackStewardRepair({
      title: track.title,
      slug: track.slug,
      featuredCredits:
        featuredByTrack.get(track.id) ?? [],
    }),
  }));

  const proposedSlugs = [
    ...new Set(
      provisional
        .filter(
          (item) =>
            item.proposal.decision === "auto_apply" &&
            item.proposal.proposedSlug,
        )
        .map((item) => item.proposal.proposedSlug),
    ),
  ];

  const competingTracks = new Map<
    string,
    Array<{
      id: string;
      slug: string;
    }>
  >();
  const competingPrimaryByTrack =
    new Map<string, string[]>();

  if (proposedSlugs.length > 0) {
    const { data: competitorData, error: competitorError } =
      await db
        .from("registry_tracks")
        .select("id, slug")
        .in("slug", proposedSlugs)
        .in("status", ["active", "draft", "needs_review"]);

    if (competitorError) {
      throw new Error(
        `Registry Steward collision audit failed: ${competitorError.message}`,
      );
    }

    const competitors = (competitorData ?? []) as Array<{
      id: string;
      slug: string;
    }>;

    for (const competitor of competitors) {
      const group = competingTracks.get(competitor.slug) ?? [];
      group.push(competitor);
      competingTracks.set(competitor.slug, group);
    }

    const competitorIds = competitors.map((row) => row.id);
    if (competitorIds.length > 0) {
      const { data: competitorCreditData, error } = await db
        .from("registry_track_artists")
        .select(
          "track_id, artist_slug, artist_name_text, is_primary, is_featured, status",
        )
        .in("track_id", competitorIds)
        .eq("status", "active")
        .eq("is_primary", true);

      if (error) {
        throw new Error(
          `Registry Steward collision credit audit failed: ${error.message}`,
        );
      }

      const grouped = creditGroups(
        (competitorCreditData ?? []) as CreditRow[],
      );
      for (
        const [trackId, slugs]
        of grouped.primaryByTrack.entries()
      ) {
        competingPrimaryByTrack.set(trackId, slugs);
      }
    }
  }

  const oldPaths: string[] = [];
  for (const item of provisional) {
    if (
      item.proposal.decision !== "auto_apply" ||
      item.track.slug === item.proposal.proposedSlug
    ) {
      continue;
    }

    for (const artistSlug of item.primaryArtistSlugs) {
      oldPaths.push(
        `/tracks/${artistSlug}/${item.track.slug}`,
      );
    }
  }

  const redirectsByPath = new Map<
    string,
    {
      new_path: string | null;
    }
  >();

  if (oldPaths.length > 0) {
    const { data: redirects, error } = await db
      .from("wk_slug_redirects")
      .select("old_path, new_path")
      .in("old_path", [...new Set(oldPaths)]);

    if (error) {
      throw new Error(
        `Registry Steward redirect audit failed: ${error.message}`,
      );
    }

    for (
      const redirect of (redirects ?? []) as Array<{
        old_path: string | null;
        new_path: string | null;
      }>
    ) {
      if (redirect.old_path) {
        redirectsByPath.set(
          redirect.old_path,
          { new_path: redirect.new_path },
        );
      }
    }
  }

  const counts = {
    autoApply: 0,
    noop: 0,
    deferred: 0,
    collisionBlocked: 0,
    redirectBlocked: 0,
    routeDeferred: 0,
    missingPrimaryArtist: 0,
  };

  const candidates: AuditCandidate[] = provisional.map(
    (item) => {
      let automatic =
        item.proposal.decision === "auto_apply";
      let effectiveProposal = item.proposal;
      let blockedReason: string | null = null;
      let routeDeferredReason: string | null = null;
      let redirectConflict: string | null = null;

      if (item.proposal.decision === "noop") {
        counts.noop += 1;
        automatic = false;
      } else if (item.proposal.decision === "defer") {
        counts.deferred += 1;
        automatic = false;
        blockedReason = item.proposal.ruleKey;
      }

      if (
        item.proposal.decision === "auto_apply" &&
        item.primaryArtistSlugs.length === 0
      ) {
        automatic = false;
        blockedReason = "missing_primary_artist";
        counts.missingPrimaryArtist += 1;
      }

      if (automatic) {
        const competitors =
          competingTracks.get(
            item.proposal.proposedSlug,
          ) ?? [];

        const collision = competitors.some((competitor) => {
          if (competitor.id === item.track.id) return false;
          const otherPrimary =
            competingPrimaryByTrack.get(competitor.id) ?? [];
          return otherPrimary.some((artistSlug) =>
            item.primaryArtistSlugs.includes(artistSlug)
          );
        });

        if (collision) {
          if (item.proposal.evidence.titleChanged) {
            effectiveProposal = {
              ...item.proposal,
              proposedSlug: item.track.slug,
              evidence: {
                ...item.proposal.evidence,
                currentSlugMatchesCanonical: false,
                slugChanged: false,
              },
            };
            routeDeferredReason =
              "same_artist_slug_collision";
            counts.routeDeferred += 1;
          } else {
            automatic = false;
            blockedReason =
              "same_artist_slug_collision";
            counts.collisionBlocked += 1;
          }
        }
      }

      if (
        automatic &&
        item.track.slug !== effectiveProposal.proposedSlug
      ) {
        for (const artistSlug of item.primaryArtistSlugs) {
          const oldPath =
            `/tracks/${artistSlug}/${item.track.slug}`;
          const expectedNewPath =
            `/tracks/${artistSlug}/${effectiveProposal.proposedSlug}`;
          const existing = redirectsByPath.get(oldPath);

          if (
            existing?.new_path &&
            existing.new_path !== expectedNewPath
          ) {
            redirectConflict = oldPath;

            if (item.proposal.evidence.titleChanged) {
              effectiveProposal = {
                ...item.proposal,
                proposedSlug: item.track.slug,
                evidence: {
                  ...item.proposal.evidence,
                  currentSlugMatchesCanonical: false,
                  slugChanged: false,
                },
              };
              routeDeferredReason =
                "redirect_conflict";
              counts.routeDeferred += 1;
            } else {
              automatic = false;
              blockedReason = "redirect_conflict";
              counts.redirectBlocked += 1;
            }

            break;
          }
        }
      }

      if (automatic) counts.autoApply += 1;

      return {
        trackId: item.track.id,
        title: item.track.title,
        slug: item.track.slug,
        primaryArtistSlugs: item.primaryArtistSlugs,
        featuredCredits: item.featuredCredits,
        proposal: item.proposal,
        effectiveProposal,
        automatic,
        blockedReason,
        routeDeferredReason,
        redirectConflict,
      };
    },
  );

  return {
    scanned: trackRows.length,
    nextCursor:
      trackRows.length === input.limit
        ? trackRows[trackRows.length - 1].id
        : null,
    candidates,
    counts,
  };
}

async function applyTrackCandidates(
  db: Db,
  candidates: AuditCandidate[],
): Promise<{
  applied: number;
  failed: number;
  failures: Array<{
    trackId: string;
    error: string;
  }>;
}> {
  const automatic = candidates.filter(
    (candidate) => candidate.automatic,
  );
  const failures: Array<{
    trackId: string;
    error: string;
  }> = [];
  let applied = 0;

  for (const candidate of automatic) {
    const { error } = await db.rpc(
      "registry_steward_apply_track_identity_repair",
      {
        p_track_id: candidate.trackId,
        p_expected_slug: candidate.slug,
        p_expected_title: candidate.title,
        p_new_slug:
          candidate.effectiveProposal.proposedSlug,
        p_new_title:
          candidate.effectiveProposal.proposedTitle,
        p_new_normalized_title:
          candidate.effectiveProposal.proposedNormalizedTitle,
        p_rule_key:
          candidate.effectiveProposal.ruleKey,
        p_rule_version:
          candidate.effectiveProposal.ruleVersion,
        p_evidence: {
          structural_featured_names:
            candidate.proposal.structuralFeaturedNames,
          featured_credits:
            candidate.featuredCredits,
          primary_artist_slugs:
            candidate.primaryArtistSlugs,
          canonical_proposed_slug:
            candidate.proposal.proposedSlug,
          route_deferred_reason:
            candidate.routeDeferredReason,
          decision_source:
            "registry-steward-v1",
        },
      },
    );

    if (error) {
      failures.push({
        trackId: candidate.trackId,
        error: error.message,
      });
      continue;
    }

    applied += 1;
  }

  return {
    applied,
    failed: failures.length,
    failures,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(req),
    });
  }

  if (req.method !== "POST") {
    return json(
      req,
      { ok: false, error: "Method not allowed." },
      405,
    );
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json(
      req,
      { ok: false, error: "Server configuration is incomplete." },
      500,
    );
  }

  const db = createClient(
    SUPABASE_URL,
    SERVICE_KEY,
    {
      auth: {
        persistSession: false,
      },
    },
  );

  const auth = await canRunSteward(req, db);
  if (!auth.allowed) {
    return json(
      req,
      { ok: false, error: "Registry Steward access denied." },
      403,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(
      req,
      { ok: false, error: "Invalid JSON body." },
      400,
    );
  }

  const action = String(body.action ?? "audit_tracks");

  try {
    if (
      action === "audit_tracks" ||
      action === "apply_tracks"
    ) {
      const limit = boundedLimit(
        body.limit,
        action === "apply_tracks" ? 50 : 250,
        action === "apply_tracks" ? 100 : 500,
      );
      const afterId =
        String(body.afterId ?? "").trim() || null;

      const audit = await auditTrackPage(db, {
        afterId,
        limit,
      });

      if (action === "audit_tracks") {
        return json(req, {
          ok: true,
          action,
          actor: auth.actor,
          ruleVersion: REGISTRY_STEWARD_RULE_VERSION,
          ...audit,
        });
      }

      const applied = await applyTrackCandidates(
        db,
        audit.candidates,
      );

      return json(req, {
        ok: applied.failed === 0,
        action,
        actor: auth.actor,
        ruleVersion: REGISTRY_STEWARD_RULE_VERSION,
        scanned: audit.scanned,
        nextCursor: audit.nextCursor,
        counts: audit.counts,
        applied,
      });
    }

    if (action === "sync_charts") {
      const limit = boundedLimit(body.limit, 1000, 5000);
      const afterId =
        String(body.afterId ?? "").trim() || null;

      const { data, error } = await db.rpc(
        "registry_steward_sync_chart_batch",
        {
          p_after_id: afterId,
          p_limit: limit,
        },
      );

      if (error) {
        throw new Error(error.message);
      }

      return json(req, {
        ok: true,
        action,
        actor: auth.actor,
        result: data,
      });
    }

    return json(
      req,
      {
        ok: false,
        error:
          "Unknown Registry Steward action.",
      },
      400,
    );
  } catch (error) {
    return json(
      req,
      {
        ok: false,
        action,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      500,
    );
  }
});
