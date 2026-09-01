import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_BASE_URL = (Deno.env.get("SITE_BASE_URL") || "https://wakilisha.africa").replace(/\/+$/, "");
const PRO_API_URL = Deno.env.get("PRO_SITEMAPS_API_URL") || "";
const PRO_API_KEY = Deno.env.get("PRO_SITEMAPS_API_KEY") || "";
const PRO_SITE_ID = Deno.env.get("PRO_SITEMAPS_SITE_ID") || "";

const ALLOWED_ORIGINS = [
  "https://wakilisha.africa",
  "https://www.wakilisha.africa",
  "https://staging.wakilisha.africa",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:3000",
];

function cors(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".wakilisha.africa")
    ? origin
    : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(data: unknown, headers: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function xml(data: string, headers: Record<string, string>, status = 200) {
  return new Response(data, {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=900",
    },
  });
}

async function getUser(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.replace("Bearer ", "");
  const client = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

async function hasCapability(db: ReturnType<typeof createClient>, userId: string, capability: string) {
  const { data: roles } = await db
    .from("user_role_assignments")
    .select("role_key,role_definitions!inner(role_capabilities(capability_key))")
    .eq("user_id", userId)
    .eq("status", "active")
    .or("expires_at.is.null,expires_at.gt.now()");

  if (!roles?.length) return false;
  if (roles.some((role: any) => role.role_key === "administrator")) return true;

  const caps = new Set<string>();
  for (const role of roles as any[]) {
    for (const cap of role.role_definitions?.role_capabilities ?? []) {
      caps.add(String(cap.capability_key));
    }
  }
  return caps.has(capability);
}

function normalizePath(path: string) {
  const clean = String(path || "").trim();
  if (!clean) return "/";
  return clean.startsWith("/") ? clean : `/${clean}`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function makeUrl(path: string) {
  return `${SITE_BASE_URL}${normalizePath(path)}`;
}

function dateOnly(value: unknown) {
  if (!value) return undefined;
  const raw = String(value);
  return raw.includes("T") ? raw : new Date(raw).toISOString();
}

type SitemapItem = {
  loc: string;
  lastmod?: string;
  url_type: string;
  source_table?: string;
  source_id?: string;
  source_row?: Record<string, unknown>;
};

function uniqByLoc(items: SitemapItem[]) {
  const seen = new Set<string>();
  const out: SitemapItem[] = [];

  for (const item of items) {
    if (!item.loc.startsWith("https://")) continue;
    if (item.loc.includes("/admin")) continue;
    if (item.loc.includes("/preview/")) continue;
    if (item.loc.includes("/auth")) continue;
    if (item.loc.includes("/settings")) continue;
    if (seen.has(item.loc)) continue;
    seen.add(item.loc);
    out.push(item);
  }

  return out.sort((a, b) => a.loc.localeCompare(b.loc));
}

function buildXml(items: SitemapItem[]) {
  const rows = items.map((item) => {
    const lastmod = item.lastmod ? `\n    <lastmod>${escapeXml(item.lastmod)}</lastmod>` : "";
    return `  <url>\n    <loc>${escapeXml(item.loc)}</loc>${lastmod}\n  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</urlset>\n`;
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function fetchAllPages(
  label: string,
  loadPage: (
    from: number,
    to: number,
  ) => PromiseLike<any>,
) {
  const pageSize = 1000;
  const rows: any[] = [];

  for (
    let from = 0;
    ;
    from += pageSize
  ) {
    const to = from + pageSize - 1;
    const { data, error } = await loadPage(
      from,
      to,
    );

    if (error) {
      throw new Error(
        `${label} pagination failed: ${
          error.message || String(error)
        }`,
      );
    }

    const page = Array.isArray(data)
      ? data
      : [];

    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }
  }

  return { data: rows };
}

async function fetchPublishedPlaylists(
  db: ReturnType<typeof createClient>,
) {
  const rows: Record<string, unknown>[] = [];
  let beforePublishedAt = "";
  let beforeSnapshotId = "";

  for (;;) {
    const args: Record<string, unknown> = {
      p_limit: 50,
    };

    if (beforePublishedAt && beforeSnapshotId) {
      args.p_before_published_at =
        beforePublishedAt;
      args.p_before_snapshot_id =
        beforeSnapshotId;
    }

    const { data, error } =
      await db.rpc(
        "list_public_playlists",
        args,
      );

    if (error) {
      throw new Error(
        `Playlist SEO enumeration failed: ${
          error.message || String(error)
        }`,
      );
    }

    const page =
      Array.isArray(data)
        ? data as Record<string, unknown>[]
        : [];

    rows.push(...page);

    if (page.length < 50) {
      break;
    }

    const last =
      page[page.length - 1];

    const nextPublishedAt =
      String(
        last?.published_at || "",
      ).trim();

    const nextSnapshotId =
      String(
        last?.snapshot_id || "",
      ).trim();

    if (
      !nextPublishedAt ||
      !nextSnapshotId ||
      (
        nextPublishedAt ===
          beforePublishedAt &&
        nextSnapshotId ===
          beforeSnapshotId
      )
    ) {
      throw new Error(
        "Playlist SEO pagination did not advance.",
      );
    }

    beforePublishedAt =
      nextPublishedAt;

    beforeSnapshotId =
      nextSnapshotId;
  }

  return { data: rows };
}

async function fetchPublicPeople(
  db: ReturnType<typeof createClient>,
) {
  const resourceRows =
    await fetchAllPages(
      "public Person resources",
      (from, to) =>
        db
          .from("wk_resource_index")
          .select(
            "resource_id, canonical_path, updated_at",
          )
          .eq(
            "resource_kind",
            "person",
          )
          .eq(
            "visibility",
            "public",
          )
          .eq(
            "lifecycle_state",
            "active",
          )
          .not(
            "canonical_path",
            "is",
            null,
          )
          .order(
            "resource_id",
            {
              ascending: true,
            },
          )
          .range(
            from,
            to,
          ),
    );

  const rows: Record<string, unknown>[] = [];
  const resources =
    resourceRows.data ?? [];
  const concurrency = 12;

  for (
    let index = 0;
    index < resources.length;
    index += concurrency
  ) {
    const batch =
      resources.slice(
        index,
        index + concurrency,
      );

    const resolved =
      await Promise.all(
        batch.map(
          async (resource) => {
            const canonicalPath =
              String(
                resource.canonical_path ||
                  "",
              ).trim();

            const match =
              /^\/people\/([^/]+)$/.exec(
                canonicalPath,
              );

            if (!match) {
              return null;
            }

            const { data, error } =
              await db.rpc(
                "get_public_person",
                {
                  p_slug:
                    match[1],
                },
              );

            if (error) {
              throw new Error(
                `Person SEO resolution failed for ${canonicalPath}: ${
                  error.message ||
                  String(error)
                }`,
              );
            }

            if (
              !data ||
              typeof data !==
                "object" ||
              Array.isArray(data)
            ) {
              return null;
            }

            const personData =
              data as Record<
                string,
                unknown
              >;

            const personResourceId =
              String(
                personData.person_id ||
                  resource.resource_id ||
                  "",
              ).trim();

            if (!personResourceId) {
              return null;
            }

            const {
              data: workData,
              error: workError,
            } =
              await db.rpc(
                "list_public_person_work",
                {
                  p_person_resource_id:
                    personResourceId,
                },
              );

            if (workError) {
              throw new Error(
                `Person SEO work eligibility failed for ${canonicalPath}: ${
                  workError.message ||
                  String(workError)
                }`,
              );
            }

            if (
              !Array.isArray(
                workData,
              ) ||
              workData.length === 0
            ) {
              return null;
            }

            return {
              ...personData,
              resource_id:
                resource.resource_id,
              updated_at:
                resource.updated_at,
            };
          },
        ),
      );

    rows.push(
      ...resolved.filter(
        (
          row,
        ): row is Record<
          string,
          unknown
        > =>
          row !== null,
      ),
    );
  }

  return { data: rows };
}

async function fetchPublicOrganizations(
  db: ReturnType<typeof createClient>,
) {
  const {
    data: authorPathData,
    error: authorPathError,
  } =
    await db.rpc(
      "list_public_article_author_organization_paths",
      {
        p_article_slug: null,
      },
    );

  if (authorPathError) {
    throw new Error(
      `Organization SEO author-path discovery failed: ${
        authorPathError.message ||
        String(authorPathError)
      }`,
    );
  }

  if (!Array.isArray(authorPathData)) {
    return { data: [] };
  }

  const candidates =
    new Map<
      string,
      {
        organizationId: string;
        canonicalPath: string;
      }
    >();

  for (const row of authorPathData) {
    const organizationId =
      String(
        row.author_organization_id ||
          "",
      ).trim();

    const canonicalPath =
      String(
        row.author_organization_path ||
          "",
      ).trim();

    if (
      !organizationId ||
      !/^\/organizations\/[^/]+$/.test(
        canonicalPath,
      )
    ) {
      continue;
    }

    if (!candidates.has(organizationId)) {
      candidates.set(
        organizationId,
        {
          organizationId,
          canonicalPath,
        },
      );
    }
  }

  const rows: Record<
    string,
    unknown
  >[] = [];

  const organizations =
    [...candidates.values()];

  const concurrency = 12;

  for (
    let index = 0;
    index < organizations.length;
    index += concurrency
  ) {
    const batch =
      organizations.slice(
        index,
        index + concurrency,
      );

    const resolved =
      await Promise.all(
        batch.map(
          async ({
            organizationId,
            canonicalPath,
          }) => {
            const match =
              /^\/organizations\/([^/]+)$/.exec(
                canonicalPath,
              );

            if (!match) {
              return null;
            }

            const { data, error } =
              await db.rpc(
                "get_public_organization",
                {
                  p_slug:
                    match[1],
                },
              );

            if (error) {
              throw new Error(
                `Organization SEO resolution failed for ${canonicalPath}: ${
                  error.message ||
                  String(error)
                }`,
              );
            }

            if (
              !data ||
              typeof data !==
                "object" ||
              Array.isArray(data)
            ) {
              return null;
            }

            const organizationData =
              data as Record<
                string,
                unknown
              >;

            const resolvedOrganizationId =
              String(
                organizationData.organization_id ||
                  "",
              ).trim();

            if (
              !resolvedOrganizationId ||
              resolvedOrganizationId !==
                organizationId
            ) {
              throw new Error(
                `Organization SEO identity mismatch for ${canonicalPath}.`,
              );
            }

            const {
              data: workData,
              error: workError,
            } =
              await db.rpc(
                "list_public_organization_work",
                {
                  p_organization_resource_id:
                    resolvedOrganizationId,
                  p_limit: 1,
                },
              );

            if (workError) {
              throw new Error(
                `Organization SEO work eligibility failed for ${canonicalPath}: ${
                  workError.message ||
                  String(workError)
                }`,
              );
            }

            if (
              !Array.isArray(
                workData,
              ) ||
              workData.length === 0
            ) {
              return null;
            }

            return {
              ...organizationData,
              resource_id:
                resolvedOrganizationId,
              canonical_path:
                canonicalPath,
              updated_at:
                null,
            };
          },
        ),
      );

    rows.push(
      ...resolved.filter(
        (
          row,
        ): row is Record<
          string,
          unknown
        > =>
          row !== null,
      ),
    );
  }

  return { data: rows };
}

async function buildInternalItems(db: ReturnType<typeof createClient>): Promise<SitemapItem[]> {
  const items: SitemapItem[] = [
    { loc: makeUrl("/"), url_type: "static" },
    { loc: makeUrl("/magazine"), url_type: "static" },
    { loc: makeUrl("/charts"), url_type: "static" },
    { loc: makeUrl("/artists"), url_type: "static" },
    { loc: makeUrl("/releases"), url_type: "static" },
    { loc: makeUrl("/playlists"), url_type: "static" },
    { loc: makeUrl("/genres"), url_type: "static" },
    { loc: makeUrl("/labels"), url_type: "static" },
    { loc: makeUrl("/guides"), url_type: "static" },
    { loc: makeUrl("/briefings"), url_type: "static" },
    { loc: makeUrl("/api-docs"), url_type: "static" },
    { loc: makeUrl("/categories"), url_type: "static" },
    { loc: makeUrl("/tags"), url_type: "static" },
    { loc: makeUrl("/about"), url_type: "static" },
    { loc: makeUrl("/contact"), url_type: "static" },
    { loc: makeUrl("/faqs"), url_type: "static" },
    { loc: makeUrl("/privacy"), url_type: "static" },
    { loc: makeUrl("/terms"), url_type: "static" },
  ];

  const [
    articles,
    playlists,
    people,
    organizations,
    artists,
    releases,
    tracks,
    releaseTracks,
    releaseArtists,
    trackArtists,
    genres,
    labels,
    guides,
    authors,
    chartPrograms,
  ] = await Promise.all([
    db.from("wk_articles").select("id, slug, modified_at, published_at").eq("wp_status", "publish").limit(5000),
    fetchPublishedPlaylists(db),
    fetchPublicPeople(db),
    fetchPublicOrganizations(db),
    fetchAllPages(
      "registry_artists",
      (from, to) =>
        db
          .from("registry_artists")
          .select("id, slug, updated_at")
          .eq("status", "active")
          .order("id", { ascending: true })
          .range(from, to),
    ),
    fetchAllPages(
      "registry_releases",
      (from, to) =>
        db
          .from("registry_releases")
          .select("*")
          .in("status", ["active", "draft"])
          .order("id", { ascending: true })
          .range(from, to),
    ),
    fetchAllPages(
      "registry_tracks",
      (from, to) =>
        db
          .from("registry_tracks")
          .select("*")
          .eq("status", "active")
          .order("id", { ascending: true })
          .range(from, to),
    ),
    fetchAllPages(
      "registry_release_tracks",
      (from, to) =>
        db
          .from("registry_release_tracks")
          .select(
            "release_id, track_id, track_number, disc_number",
          )
          .eq("status", "active")
          .order("release_id", { ascending: true })
          .order("track_id", { ascending: true })
          .range(from, to),
    ),
    fetchAllPages(
      "registry_release_artists",
      (from, to) =>
        db
          .from("registry_release_artists")
          .select(
            "release_id, artist_slug, artist_name_text, is_primary, is_featured, credit_order, status",
          )
          .in("status", ["active", "shadow"])
          .order("release_id", { ascending: true })
          .order("credit_order", { ascending: true })
          .range(from, to),
    ),
    fetchAllPages(
      "registry_track_artists",
      (from, to) =>
        db
          .from("registry_track_artists")
          .select(
            "track_id, artist_slug, artist_name_text, is_primary, is_featured, credit_order, status",
          )
          .in("status", ["active", "shadow"])
          .order("track_id", { ascending: true })
          .order("credit_order", { ascending: true })
          .range(from, to),
    ),
    db.from("registry_genres").select("id, slug, updated_at").limit(1000),
    db.from("registry_labels").select("id, slug, updated_at").limit(1000),
    db.from("wk_guides").select("id, slug, updated_at, status").eq("status", "published").limit(2000),
    db.from("registry_authors").select("id, slug, updated_at").limit(2000),
    db.from("wk_chart_programs_v2").select("id, public_slug, market_slug, updated_at").limit(500),
  ]);

  for (const row of articles.data ?? []) {
    items.push({
      loc: makeUrl(`/magazine/${row.slug}`),
      lastmod: dateOnly(row.modified_at || row.published_at),
      url_type: "article",
      source_table: "wk_articles",
      source_id: String(row.id),
    });
  }

  for (const row of playlists.data ?? []) {
    const slug =
      String(
        row.slug || "",
      ).trim();

    const resourceId =
      String(
        row.resource_id ||
          row.playlist_id ||
          "",
      ).trim();

    if (
      !slug ||
      !resourceId
    ) {
      continue;
    }

    items.push({
      loc:
        makeUrl(
          `/playlists/${slug}`,
        ),
      lastmod:
        dateOnly(
          row.published_at ||
            row.first_published_at,
        ),
      url_type: "playlist",
      source_table:
        "public_playlist",
      source_id:
        resourceId,
      source_row: row,
    });
  }

  for (const row of people.data ?? []) {
    const canonicalPath =
      String(
        row.canonical_path || "",
      ).trim();

    const personId =
      String(
        row.person_id ||
          row.resource_id ||
          "",
      ).trim();

    if (
      !/^\/people\/[^/]+$/.test(
        canonicalPath,
      ) ||
      !personId
    ) {
      continue;
    }

    items.push({
      loc:
        makeUrl(
          canonicalPath,
        ),
      lastmod:
        dateOnly(
          row.updated_at,
        ),
      url_type: "person",
      source_table:
        "public_person",
      source_id:
        personId,
      source_row: row,
    });
  }

  for (const row of organizations.data ?? []) {
    const canonicalPath =
      String(
        row.canonical_path || "",
      ).trim();

    const organizationId =
      String(
        row.organization_id ||
          row.resource_id ||
          "",
      ).trim();

    if (
      !/^\/organizations\/[^/]+$/.test(
        canonicalPath,
      ) ||
      !organizationId
    ) {
      continue;
    }

    items.push({
      loc:
        makeUrl(
          canonicalPath,
        ),
      lastmod:
        dateOnly(
          row.updated_at,
        ),
      url_type: "organization",
      source_table:
        "public_organization",
      source_id:
        organizationId,
      source_row: row,
    });
  }

  for (const row of artists.data ?? []) {
    items.push({
      loc: makeUrl(`/artists/${row.slug}`),
      lastmod: dateOnly(row.updated_at),
      url_type: "artist",
      source_table: "registry_artists",
      source_id: String(row.id),
    });
  }

  const releaseArtistByReleaseId = new Map<string, { slug: string; name: string }>();
  for (const row of releaseArtists.data ?? []) {
    const releaseId = String(row.release_id || "").trim();
    const slug = String(row.artist_slug || "").trim();
    if (!releaseId || !slug) continue;

    const existing = releaseArtistByReleaseId.get(releaseId);
    const isPrimary = Boolean(row.is_primary);
    const creditOrder = Number(row.credit_order || 999);

    if (!existing || isPrimary || creditOrder === 1) {
      releaseArtistByReleaseId.set(releaseId, {
        slug,
        name: String(row.artist_name_text || slug).trim(),
      });
    }
  }

  const releaseById = new Map<string, Record<string, any>>();
  for (const row of releases.data ?? []) {
    releaseById.set(String(row.id), row as Record<string, any>);
  }

  const activeTrackIds = new Set(
    (tracks.data ?? [])
      .map((track: any) => String(track.id || "").trim())
      .filter(Boolean),
  );

  const releaseMembershipsByTrackId = new Map<
    string,
    Array<{
      releaseId: string;
      trackNumber: number;
      discNumber: number;
    }>
  >();
  const releaseTrackCountByReleaseId =
    new Map<string, number>();

  for (const row of releaseTracks.data ?? []) {
    const trackId = String(row.track_id || "").trim();
    const releaseId = String(row.release_id || "").trim();

    if (!trackId || !releaseId || !activeTrackIds.has(trackId)) continue;

    releaseTrackCountByReleaseId.set(
      releaseId,
      (releaseTrackCountByReleaseId.get(releaseId) || 0) + 1,
    );

    const memberships =
      releaseMembershipsByTrackId.get(trackId) || [];

    memberships.push({
      releaseId,
      trackNumber: Number(row.track_number || 0),
      discNumber: Number(row.disc_number || 0),
    });

    releaseMembershipsByTrackId.set(
      trackId,
      memberships,
    );
  }

  const trackArtistByTrackId = new Map<string, { slug: string; name: string }>();
  for (const row of trackArtists.data ?? []) {
    const trackId = String(row.track_id || "").trim();
    const slug = String(row.artist_slug || "").trim();
    if (!trackId || !slug) continue;

    const existing = trackArtistByTrackId.get(trackId);
    const isPrimary = Boolean(row.is_primary);
    const creditOrder = Number(row.credit_order || 999);

    if (!existing || isPrimary || creditOrder === 1) {
      trackArtistByTrackId.set(trackId, {
        slug,
        name: String(row.artist_name_text || slug).trim(),
      });
    }
  }

  for (const row of releases.data ?? []) {
    if (
      (releaseTrackCountByReleaseId.get(String(row.id)) || 0) <= 1
    ) {
      continue;
    }

    const meta = (row.metadata || {}) as Record<string, unknown>;
    const linkedArtist = releaseArtistByReleaseId.get(String(row.id));
    const artistSlug = String(meta.primary_artist_slug || meta.artist_slug || linkedArtist?.slug || "").trim();
    if (!artistSlug) continue;

    items.push({
      loc: makeUrl(`/releases/${artistSlug}/${row.slug}`),
      lastmod: dateOnly(row.updated_at),
      url_type: "release",
      source_table: "registry_releases",
      source_id: String(row.id),
    });
  }

  for (const row of tracks.data ?? []) {
    const meta = (row.metadata || {}) as Record<string, unknown>;
    const trackId = String(row.id);
    const linkedArtist = trackArtistByTrackId.get(trackId);
    const artistSlug = String(
      meta.primary_artist_slug ||
      meta.artist_slug ||
      linkedArtist?.slug ||
      "",
    ).trim();

    const memberships =
      releaseMembershipsByTrackId.get(trackId) || [];

    const scopedItems: Array<{
      path: string;
      artistSlug: string;
      releaseSlug: string;
      trackNumber: number;
      discNumber: number;
    }> = [];

    for (const membership of memberships) {
      if (
        (releaseTrackCountByReleaseId.get(membership.releaseId) || 0) <= 1
      ) {
        continue;
      }

      const release =
        releaseById.get(membership.releaseId);
      const releaseSlug =
        String(release?.slug || "").trim();

      if (!release || !releaseSlug) continue;

      const releaseMeta =
        (release.metadata || {}) as Record<
          string,
          unknown
        >;
      const linkedReleaseArtist =
        releaseArtistByReleaseId.get(
          membership.releaseId,
        );
      const releaseArtistSlug = String(
        releaseMeta.primary_artist_slug ||
        releaseMeta.artist_slug ||
        linkedReleaseArtist?.slug ||
        "",
      ).trim();

      if (!releaseArtistSlug) continue;

      scopedItems.push({
        path: `/releases/${releaseArtistSlug}/${releaseSlug}/${row.slug}`,
        artistSlug: releaseArtistSlug,
        releaseSlug,
        trackNumber: membership.trackNumber,
        discNumber: membership.discNumber,
      });
    }

    scopedItems.sort((left, right) => {
      const leftArtistRank =
        left.artistSlug === artistSlug ? 0 : 1;
      const rightArtistRank =
        right.artistSlug === artistSlug ? 0 : 1;

      if (leftArtistRank !== rightArtistRank) {
        return leftArtistRank - rightArtistRank;
      }

      if (left.discNumber !== right.discNumber) {
        return left.discNumber - right.discNumber;
      }

      if (left.trackNumber !== right.trackNumber) {
        return left.trackNumber - right.trackNumber;
      }

      return left.path.localeCompare(right.path);
    });

    if (scopedItems.length) {
      for (const scoped of scopedItems) {
        items.push({
          loc: makeUrl(scoped.path),
          lastmod: dateOnly(row.updated_at),
          url_type: "track",
          source_table: "registry_tracks",
          source_id: trackId,
        });
      }

      continue;
    }

    const standalonePath = artistSlug
      ? `/tracks/${artistSlug}/${row.slug}`
      : `/tracks/${row.slug}`;

    items.push({
      loc: makeUrl(standalonePath),
      lastmod: dateOnly(row.updated_at),
      url_type: "track",
      source_table: "registry_tracks",
      source_id: trackId,
    });
  }

  for (const row of genres.data ?? []) {
    items.push({
      loc: makeUrl(`/genres/${row.slug}`),
      lastmod: dateOnly(row.updated_at),
      url_type: "genre",
      source_table: "registry_genres",
      source_id: String(row.id),
    });
  }

  for (const row of labels.data ?? []) {
    items.push({
      loc: makeUrl(`/labels/${row.slug}`),
      lastmod: dateOnly(row.updated_at),
      url_type: "label",
      source_table: "registry_labels",
      source_id: String(row.id),
    });
  }

  for (const row of guides.data ?? []) {
    items.push({
      loc: makeUrl(`/guides/${row.slug}`),
      lastmod: dateOnly(row.updated_at),
      url_type: "guide",
      source_table: "wk_guides",
      source_id: String(row.id),
    });
  }


  for (const program of chartPrograms.data ?? []) {
    const programSlug = String(program.public_slug || "").trim();
    const marketSlug = String(program.market_slug || "").trim();
    if (!programSlug) continue;

    items.push({
      loc: makeUrl(`/charts/${programSlug}/latest`),
      lastmod: dateOnly(program.updated_at),
      url_type: "chart",
      source_table: "wk_chart_programs_v2",
      source_id: String(program.id),
    });
  }

  return uniqByLoc(items);
}


type SeoMetadataEntry = {
  title: string;
  description: string;
  robots: "index, follow" | "noindex, follow" | "noindex, nofollow";
  ogType: "website" | "article" | "profile" | "music.song" | "music.album" | "music.playlist";
  kind: "home" | "collection" | "article" | "artist" | "track" | "release" | "playlist" | "person" | "chart" | "guide" | "profile" | "utility" | "legal" | "notFound";
  image?: string | null;
  entityName?: string | null;
  publishedAt?: string | null;
  modifiedAt?: string | null;
  sourceTable?: string | null;
  sourceId?: string | null;
  socialTitle?: string | null;
  socialDescription?: string | null;
  seoOverrideId?: string | null;
  overrideAppliedAt?: string | null;
  curatorLabel?: string | null;
  itemCount?: number | null;
};

type SeoContentOverrideRow = {
  id: string;
  target_url: string;
  title?: string | null;
  description?: string | null;
  social_title?: string | null;
  social_description?: string | null;
  applied_at?: string | null;
  updated_at?: string | null;
  status: "active" | "archived";
};

function stripHtml(value: string) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function compactText(value: unknown, max = 158) {
  const clean = stripHtml(String(value || ""));
  if (!clean) return "";
  return clean.length > max ? `${clean.slice(0, max - 3).trim()}...` : clean;
}

function titleCase(value: string) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function rowMeta(row: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!row) return {};
  const value = row.metadata;
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function textValue(row: Record<string, unknown> | null | undefined, keys: string[], fallback = "") {
  if (!row) return fallback;
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined || typeof value === "object") continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return fallback;
}

function metaText(row: Record<string, unknown> | null | undefined, keys: string[], fallback = "") {
  const meta = rowMeta(row);
  for (const key of keys) {
    const value = meta[key];
    if (value === null || value === undefined || typeof value === "object") continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return fallback;
}

function firstText(row: Record<string, unknown> | null | undefined, rowKeys: string[], metaKeys: string[], fallback = "") {
  return textValue(row, rowKeys) || metaText(row, metaKeys) || fallback;
}

function pathFromLoc(loc: string) {
  try {
    return normalizePath(new URL(loc).pathname).replace(/\/+$/, "") || "/";
  } catch {
    return "/";
  }
}

function normalizeOverridePath(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "/";

  try {
    return normalizePath(new URL(raw).pathname).replace(/\/+$/, "") || "/";
  } catch {
    return normalizePath(raw.split("?")[0]).replace(/\/+$/, "") || "/";
  }
}

function applySeoContentOverride(entry: SeoMetadataEntry, override?: SeoContentOverrideRow | null): SeoMetadataEntry {
  if (!override) return entry;

  return {
    ...entry,
    title: String(override.title || entry.title).trim(),
    description: compactText(override.description || entry.description),
    socialTitle: override.social_title || override.title || entry.socialTitle || entry.title,
    socialDescription: compactText(override.social_description || override.description || entry.socialDescription || entry.description),
    modifiedAt: override.applied_at || override.updated_at || entry.modifiedAt,
    seoOverrideId: override.id,
    overrideAppliedAt: override.applied_at || override.updated_at || null,
  };
}

function slugFromArtistPath(pagePath: string) {
  const parts = normalizePath(pagePath).split("/").filter(Boolean);
  return parts[0] === "artists" ? String(parts[1] || "").trim() : "";
}

function absoluteImageUrl(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.startsWith("data:")) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/")) return `${SITE_BASE_URL}${raw}`;
  return null;
}

function imageCandidateFromUnknown(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === "string") {
    return absoluteImageUrl(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = imageCandidateFromUnknown(item);
      if (candidate) return candidate;
    }
    return null;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    for (const key of ["url", "secure_url", "src", "href"]) {
      const candidate = imageCandidateFromUnknown(record[key]);
      if (candidate) return candidate;
    }

    for (const key of ["images", "image", "artwork", "cover", "thumbnail", "album", "artist"]) {
      const candidate = imageCandidateFromUnknown(record[key]);
      if (candidate) return candidate;
    }
  }

  return null;
}

function imageValue(row: Record<string, unknown> | null | undefined) {
  const direct = absoluteImageUrl(firstText(
    row,
    [
      "hero_url",
      "heroUrl",
      "featured_image_url",
      "featured_image",
      "image_url",
      "public_image_url",
      "publicImageUrl",
      "public_image",
      "portrait_image",
      "profile_image_url",
      "avatar_url",
      "thumbnail_url",
      "artwork_url",
      "cover_image_url",
      "logo_url",
      "spotify_image_url",
      "spotify_artwork_url",
      "spotify_profile_image_url",
      "spotify_album_image_url"
    ],
    [
      "hero_url",
      "heroUrl",
      "featured_image_url",
      "featured_image",
      "image_url",
      "public_image_url",
      "publicImageUrl",
      "public_image",
      "portrait_image",
      "profile_image_url",
      "avatar_url",
      "thumbnail_url",
      "artwork_url",
      "cover_image_url",
      "logo_url",
      "apple_music_artwork_url",
      "spotify_image_url",
      "spotify_artwork_url",
      "spotify_profile_image_url",
      "spotify_album_image_url"
    ]
  ));

  if (direct) return direct;

  const meta = rowMeta(row);
  for (const key of [
    "spotify_images",
    "spotify_image",
    "spotify",
    "images",
    "image",
    "artwork",
    "cover",
    "album",
    "artist",
    "raw_payload",
    "provider_payload"
  ]) {
    const candidate = imageCandidateFromUnknown(meta[key]);
    if (candidate) return candidate;
  }

  return null;
}

function descriptionValue(row: Record<string, unknown> | null | undefined, fallback: string) {
  return compactText(firstText(
    row,
    ["seo_description", "meta_description", "excerpt", "dek", "summary", "description", "bio", "full_bio", "post_excerpt"],
    ["seo_description", "meta_description", "excerpt", "dek", "summary", "description", "bio", "full_bio", "post_excerpt"]
  ) || fallback);
}

function dateValue(row: Record<string, unknown> | null | undefined, keys: string[]) {
  const value = firstText(row, keys, keys);
  return value ? dateOnly(value) || null : null;
}

function fallbackParts(path: string) {
  const parts = normalizePath(path).split("/").filter(Boolean);
  return {
    parts,
    last: titleCase(parts[parts.length - 1] || "WAKILISHA"),
    artist: titleCase(parts[1] || ""),
  };
}

function buildSeoMetadataEntry(
  item: SitemapItem,
  row?: Record<string, unknown> | null,
  relationshipArtist?: { slug: string; name: string } | null,
  providerImage?: string | null,
): SeoMetadataEntry {
  const pagePath = pathFromLoc(item.loc);
  const { last, artist } = fallbackParts(pagePath);
  const sourceTable = item.source_table || null;
  const sourceId = item.source_id || null;
  const modifiedAt = dateValue(row, ["updated_at", "modified_at", "post_modified", "changed_at"]) || item.lastmod || null;
  const resolvedImage = imageValue(row) || providerImage || null;

  if (!sourceTable) {
    return {
      title: last,
      description: `${last} on WAKILISHA.`,
      robots: "index, follow",
      ogType: "website",
      kind: "collection",
      sourceTable,
      sourceId,
      modifiedAt,
    };
  }

  if (sourceTable === "wk_articles") {
    const title = firstText(row, ["title", "post_title", "wp_title", "headline", "seo_title"], ["title", "headline", "seo_title"], last);
    return {
      title,
      entityName: title,
      description: descriptionValue(row, `Read ${title} on WAKILISHA, with context from African music, charts, artists, and culture.`),
      robots: "index, follow",
      ogType: "article",
      kind: "article",
      image: resolvedImage,
      publishedAt: dateValue(row, ["published_at", "post_date", "created_at"]),
      modifiedAt,
      sourceTable,
      sourceId,
    };
  }

  if (sourceTable === "public_playlist") {
    const title =
      firstText(
        row,
        [
          "title",
        ],
        [],
        last,
      );

    const curatorLabel =
      firstText(
        row,
        [
          "curator_label",
        ],
        [],
      );

    const rawItemCount =
      row?.item_count;

    const itemCount =
      typeof rawItemCount ===
        "number" &&
      Number.isFinite(
        rawItemCount,
      )
        ? rawItemCount
        : null;

    return {
      title,
      entityName: title,
      description:
        descriptionValue(
          row,
          curatorLabel
            ? `${title}, curated by ${curatorLabel}.`
            : `Listen to ${title} on WAKILISHA.`,
        ),
      robots: "index, follow",
      ogType: "music.playlist",
      kind: "playlist",
      image:
        absoluteImageUrl(
          firstText(
            row,
            [
              "cover_url",
            ],
            [],
          ),
        ) ||
        resolvedImage,
      publishedAt:
        dateValue(
          row,
          [
            "first_published_at",
            "published_at",
          ],
        ),
      modifiedAt:
        dateValue(
          row,
          [
            "published_at",
          ],
        ) ||
        modifiedAt,
      sourceTable,
      sourceId,
      curatorLabel:
        curatorLabel ||
        null,
      itemCount,
    };
  }

  if (sourceTable === "public_person") {
    const title =
      firstText(
        row,
        [
          "display_name",
        ],
        [],
        last,
      );

    return {
      title,
      entityName: title,
      description:
        descriptionValue(
          row,
          `Read work by ${title} on WAKILISHA.`,
        ),
      robots: "index, follow",
      ogType: "profile",
      kind: "person",
      image:
        absoluteImageUrl(
          firstText(
            row,
            [
              "avatar_url",
              "cover_url",
            ],
            [],
          ),
        ) ||
        resolvedImage,
      modifiedAt,
      sourceTable,
      sourceId,
    };
  }

  if (sourceTable === "public_organization") {
    const title =
      firstText(
        row,
        [
          "display_name",
        ],
        [],
        last,
      );

    return {
      title,
      entityName: title,
      description:
        descriptionValue(
          row,
          `${title} on WAKILISHA.`,
        ),
      robots: "index, follow",
      ogType: "website",
      kind: "organization",
      image:
        absoluteImageUrl(
          firstText(
            row,
            [
              "logo_url",
              "cover_url",
            ],
            [],
          ),
        ) ||
        resolvedImage,
      modifiedAt,
      sourceTable,
      sourceId,
    };
  }

  if (sourceTable === "registry_artists") {
    const title = firstText(row, ["name", "title", "display_name", "artist_name", "normalized_name"], ["name", "display_name", "artist_name"], last);
    return {
      title,
      entityName: title,
      description: descriptionValue(row, `Explore ${title} on WAKILISHA, including music, releases, chart context, and cultural signals.`),
      robots: "index, follow",
      ogType: "profile",
      kind: "artist",
      image: resolvedImage,
      modifiedAt,
      sourceTable,
      sourceId,
    };
  }

  if (sourceTable === "registry_releases") {
    const releaseTitle = firstText(row, ["title", "name", "display_title", "normalized_title"], ["title", "name", "display_title", "normalized_title"], last);
    const artistName = firstText(row, ["artist", "artist_name", "primary_artist_name", "artists"], ["artist", "artist_name", "primary_artist_name", "artists"], relationshipArtist?.name || artist);
    const title = artistName ? `${releaseTitle} by ${artistName}` : releaseTitle;
    return {
      title,
      entityName: releaseTitle,
      description: descriptionValue(row, `Explore ${title} on WAKILISHA, including release context, tracks, credits, and music metadata.`),
      robots: "index, follow",
      ogType: "music.album",
      kind: "release",
      image: resolvedImage,
      publishedAt: dateValue(row, ["release_date", "date", "published_at", "created_at"]),
      modifiedAt,
      sourceTable,
      sourceId,
    };
  }

  if (sourceTable === "registry_tracks") {
    const trackTitle = firstText(row, ["title", "name", "display_title", "normalized_title"], ["title", "name", "display_title", "normalized_title"], last);
    const artistName = firstText(row, ["artist", "artist_name", "primary_artist_name", "artists"], ["artist", "artist_name", "primary_artist_name", "artists"], relationshipArtist?.name || artist);
    const title = artistName ? `${trackTitle} by ${artistName}` : trackTitle;
    return {
      title,
      entityName: trackTitle,
      description: descriptionValue(row, `Explore ${title} on WAKILISHA, including chart context, credits, and music metadata.`),
      robots: "index, follow",
      ogType: "music.song",
      kind: "track",
      image: resolvedImage,
      publishedAt: dateValue(row, ["release_date", "date", "published_at", "created_at"]),
      modifiedAt,
      sourceTable,
      sourceId,
    };
  }

  if (sourceTable === "registry_genres") {
    const title = firstText(row, ["name", "title", "display_name"], ["name", "display_name"], last);
    return {
      title,
      entityName: title,
      description: descriptionValue(row, `Explore ${title} on WAKILISHA, with related artists, releases, tracks, and cultural context.`),
      robots: "index, follow",
      ogType: "website",
      kind: "collection",
      image: resolvedImage,
      modifiedAt,
      sourceTable,
      sourceId,
    };
  }

  if (sourceTable === "registry_labels") {
    const title = firstText(row, ["name", "title", "display_name", "label_name"], ["name", "display_name", "label_name"], last);
    return {
      title,
      entityName: title,
      description: descriptionValue(row, `Explore ${title} on WAKILISHA, with related artists, releases, tracks, and cultural context.`),
      robots: "index, follow",
      ogType: "website",
      kind: "collection",
      image: resolvedImage,
      modifiedAt,
      sourceTable,
      sourceId,
    };
  }

  if (sourceTable === "wk_guides") {
    const title = firstText(row, ["title", "name", "display_title"], ["title", "display_title"], last);
    return {
      title,
      entityName: title,
      description: descriptionValue(row, `Read the ${title} guide on WAKILISHA.`),
      robots: "index, follow",
      ogType: "article",
      kind: "guide",
      image: resolvedImage,
      publishedAt: dateValue(row, ["published_at", "created_at"]),
      modifiedAt,
      sourceTable,
      sourceId,
    };
  }

  if (sourceTable === "registry_authors") {
    const title = firstText(row, ["name", "title", "display_name"], ["name", "display_name"], last);
    return {
      title,
      entityName: title,
      description: descriptionValue(row, `Read work by ${title} on WAKILISHA.`),
      robots: "index, follow",
      ogType: "profile",
      kind: "profile",
      image: resolvedImage,
      modifiedAt,
      sourceTable,
      sourceId,
    };
  }

  if (sourceTable === "wk_chart_programs_v2") {
    const title = firstText(row, ["title", "name", "display_name", "public_slug"], ["title", "display_name"], last);
    const chartTitle = title.toLowerCase().includes("chart") ? title : `${title} chart`;
    return {
      title: chartTitle,
      description: descriptionValue(row, `Explore the ${chartTitle} on WAKILISHA, including ranked tracks, artists, movement, and cultural context.`),
      robots: "index, follow",
      ogType: "website",
      kind: "chart",
      image: resolvedImage,
      modifiedAt,
      sourceTable,
      sourceId,
    };
  }

  return {
    title: last,
    description: `${last} on WAKILISHA, mapping African music culture through data, stories, artists, charts, and releases.`,
    robots: "index, follow",
    ogType: "website",
    kind: "collection",
    image: resolvedImage,
    modifiedAt,
    sourceTable,
    sourceId,
  };
}

async function buildRelationshipArtistMaps(db: ReturnType<typeof createClient>, releaseIds: string[], trackIds: string[]) {
  const releaseArtistByReleaseId = new Map<string, { slug: string; name: string }>();
  const trackArtistByTrackId = new Map<string, { slug: string; name: string }>();

  if (releaseIds.length) {
    const { data } = await db
      .from("registry_release_artists")
      .select("release_id, artist_slug, artist_name_text, is_primary, credit_order, status")
      .in("release_id", Array.from(new Set(releaseIds)))
      .in("status", ["active", "shadow"])
      .limit(20000);

    for (const row of data ?? []) {
      const releaseId = String(row.release_id || "").trim();
      const slug = String(row.artist_slug || "").trim();
      if (!releaseId || !slug) continue;

      const existing = releaseArtistByReleaseId.get(releaseId);
      const isPrimary = Boolean(row.is_primary);
      const creditOrder = Number(row.credit_order || 999);

      if (!existing || isPrimary || creditOrder === 1) {
        releaseArtistByReleaseId.set(releaseId, {
          slug,
          name: String(row.artist_name_text || slug).trim(),
        });
      }
    }
  }

  if (trackIds.length) {
    const { data } = await db
      .from("registry_track_artists")
      .select("track_id, artist_slug, artist_name_text, is_primary, credit_order, status")
      .in("track_id", Array.from(new Set(trackIds)))
      .in("status", ["active", "shadow"])
      .limit(20000);

    for (const row of data ?? []) {
      const trackId = String(row.track_id || "").trim();
      const slug = String(row.artist_slug || "").trim();
      if (!trackId || !slug) continue;

      const existing = trackArtistByTrackId.get(trackId);
      const isPrimary = Boolean(row.is_primary);
      const creditOrder = Number(row.credit_order || 999);

      if (!existing || isPrimary || creditOrder === 1) {
        trackArtistByTrackId.set(trackId, {
          slug,
          name: String(row.artist_name_text || slug).trim(),
        });
      }
    }
  }

  return { releaseArtistByReleaseId, trackArtistByTrackId };
}

async function buildProviderImageMap(db: ReturnType<typeof createClient>, entityIds: string[]) {
  const uniqueIds = Array.from(new Set(entityIds.filter(Boolean)));
  const imageByEntityId = new Map<string, string>();
  const chunkSize = 250;

  for (let index = 0; index < uniqueIds.length; index += chunkSize) {
    const chunk = uniqueIds.slice(index, index + chunkSize);

    const { data, error } = await db
      .from("registry_provider_sources")
      .select("entity_id, provider, raw_payload, metadata, status")
      .in("entity_id", chunk)
      .eq("status", "active")
      .limit(10000);

    if (error) {
      console.warn(`SEO provider image lookup failed: ${error.message}`);
      continue;
    }

    for (const row of data ?? []) {
      const entityId = String(row.entity_id || "").trim();
      if (!entityId || imageByEntityId.has(entityId)) continue;

      const rawCandidate = imageCandidateFromUnknown(row.raw_payload);
      const metadataCandidate = imageCandidateFromUnknown(row.metadata);
      const candidate = rawCandidate || metadataCandidate;

      if (candidate) imageByEntityId.set(entityId, candidate);
    }
  }

  return imageByEntityId;
}

async function fetchRowsById(db: ReturnType<typeof createClient>, table: string, ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (!uniqueIds.length) return new Map<string, Record<string, unknown>>();

  const { data, error } = await db.from(table).select("*").in("id", uniqueIds).limit(5000);
  if (error) {
    console.warn(`SEO metadata lookup failed for ${table}: ${error.message}`);
    return new Map<string, Record<string, unknown>>();
  }

  return new Map((data || []).map((row: any) => [String(row.id), row as Record<string, unknown>]));
}

async function fetchRowsBySlug(db: ReturnType<typeof createClient>, table: string, slugs: string[]) {
  const uniqueSlugs = Array.from(new Set(slugs.filter(Boolean)));
  if (!uniqueSlugs.length) return new Map<string, Record<string, unknown>>();

  const { data, error } = await db.from(table).select("*").in("slug", uniqueSlugs).limit(5000);
  if (error) {
    console.warn(`SEO metadata slug lookup failed for ${table}: ${error.message}`);
    return new Map<string, Record<string, unknown>>();
  }

  return new Map((data || []).map((row: any) => [String(row.slug), row as Record<string, unknown>]));
}

async function fetchSeoContentOverrideMap(db: ReturnType<typeof createClient>) {
  const { data, error } = await db
    .from("seo_content_overrides")
    .select("id, target_url, title, description, social_title, social_description, applied_at, updated_at, status")
    .eq("status", "active")
    .limit(10000);

  if (error) {
    console.warn(`SEO content override lookup failed: ${error.message}`);
    return new Map<string, SeoContentOverrideRow>();
  }

  return new Map(
    (data || []).map((row: SeoContentOverrideRow) => [
      normalizeOverridePath(row.target_url),
      row,
    ]),
  );
}

async function buildSeoMetadataManifest(db: ReturnType<typeof createClient>) {
  const items = await buildInternalItems(db);
  const sourceIdsByTable = new Map<string, string[]>();

  for (const item of items) {
    if (
      !item.source_table ||
      !item.source_id ||
      item.source_row
    ) {
      continue;
    }

    const list = sourceIdsByTable.get(item.source_table) || [];
    list.push(item.source_id);
    sourceIdsByTable.set(item.source_table, list);
  }

  const rowMaps = new Map<string, Map<string, Record<string, unknown>>>();
  for (const [table, ids] of sourceIdsByTable) {
    rowMaps.set(table, await fetchRowsById(db, table, ids));
  }

  const artistSlugs = items
    .map((item) => pathFromLoc(item.loc))
    .map(slugFromArtistPath)
    .filter(Boolean);
  const artistRowsBySlug = await fetchRowsBySlug(db, "registry_artists", artistSlugs);

  const relationshipMaps = await buildRelationshipArtistMaps(
    db,
    sourceIdsByTable.get("registry_releases") || [],
    sourceIdsByTable.get("registry_tracks") || [],
  );

  const allSourceIds = Array.from(
    new Set(Array.from(sourceIdsByTable.values()).flat().filter(Boolean))
  );
  const providerImageByEntityId = await buildProviderImageMap(db, allSourceIds);
  const overrideByPath = await fetchSeoContentOverrideMap(db);

  const manifest: Record<string, SeoMetadataEntry> = {};

  for (const item of items) {
    const pagePath = pathFromLoc(item.loc);
    const artistSlug = slugFromArtistPath(pagePath);
    const rowFromId = item.source_table && item.source_id
      ? rowMaps.get(item.source_table)?.get(item.source_id) || null
      : null;
    const rowFromSlug = item.source_table === "registry_artists" && artistSlug
      ? artistRowsBySlug.get(artistSlug) || null
      : null;
    const row =
      item.source_row ||
      rowFromId ||
      rowFromSlug ||
      null;

    const relationshipArtist = item.source_table === "registry_releases" && item.source_id
      ? relationshipMaps.releaseArtistByReleaseId.get(item.source_id) || null
      : item.source_table === "registry_tracks" && item.source_id
        ? relationshipMaps.trackArtistByTrackId.get(item.source_id) || null
        : null;

    const providerImage = item.source_id
      ? providerImageByEntityId.get(item.source_id) || null
      : null;
    const artistSlugImage = rowFromSlug ? imageValue(rowFromSlug) : null;
    const fallbackImage = item.source_table === "registry_artists"
      ? artistSlugImage || providerImage
      : providerImage;

    const baseEntry = buildSeoMetadataEntry(item, row, relationshipArtist, fallbackImage);
    manifest[pagePath] = applySeoContentOverride(baseEntry, overrideByPath.get(pagePath));
  }

  return manifest;
}

async function triggerProSitemaps(method: string) {
  if (!PRO_API_URL || !PRO_API_KEY || !PRO_SITE_ID) {
    return { configured: false, message: "Pro-Sitemaps secrets are not fully configured." };
  }

  const body = new URLSearchParams();
  body.set("method", method);
  body.set("api_key", PRO_API_KEY);
  body.set("site_id", PRO_SITE_ID);

  const response = await fetch(PRO_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const text = await response.text();

  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // keep raw text
  }

  return {
    configured: true,
    ok: response.ok,
    status: response.status,
    method,
    result: parsed,
  };
}

async function latestSnapshot(db: ReturnType<typeof createClient>) {
  const { data, error } = await db
    .from("seo_sitemap_snapshots")
    .select("*")
    .in("status", ["published", "generated"])
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

Deno.serve(async (req) => {
  const headers = cors(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "";

  if (
    req.method === "GET" &&
    action === "xml_live"
  ) {
    const items = await buildInternalItems(db);
    return xml(buildXml(items), headers);
  }

  if (req.method === "GET" && action === "metadata") {
    const metadata = await buildSeoMetadataManifest(db);
    return json({
      ok: true,
      data: {
        generatedAt: new Date().toISOString(),
        count: Object.keys(metadata).length,
        metadata,
      },
    }, headers);
  }

  if (req.method === "GET" && action === "xml") {
    const snapshot = await latestSnapshot(db);
    if (!snapshot?.xml_content) {
      const items = await buildInternalItems(db);
      return xml(buildXml(items), headers);
    }
    return xml(String(snapshot.xml_content), headers);
  }

  const user = await getUser(req);
  if (!user) return json({ ok: false, error: "Unauthorized" }, headers, 401);

  const allowed = await hasCapability(db, user.id, "manage_settings");
  if (!allowed) return json({ ok: false, error: "Insufficient privilege" }, headers, 403);

  if (req.method === "GET") {
    const snapshot = await latestSnapshot(db);
    return json({ ok: true, data: { snapshot } }, headers);
  }

  const body = await req.json().catch(() => ({}));
  const requestedAction = String(body.action || "generate");

  if (requestedAction === "pro_update") {
    const result = await triggerProSitemaps("update_sitemap");
    return json({ ok: true, data: result }, headers);
  }

  const items = await buildInternalItems(db);
  const xmlContent = buildXml(items);
  const hash = await sha256(xmlContent);
  const proResult = requestedAction === "generate_and_pro_update"
    ? await triggerProSitemaps("update_sitemap")
    : {};

  const { data: snapshot, error } = await db
    .from("seo_sitemap_snapshots")
    .insert({
      status: "generated",
      source: requestedAction === "generate_and_pro_update" ? "mixed" : "internal",
      base_url: SITE_BASE_URL,
      url_count: items.length,
      xml_content: xmlContent,
      xml_sha256: hash,
      pro_sitemaps_site_id: PRO_SITE_ID || null,
      pro_sitemaps_result_json: proResult,
      generated_by: user.id,
    })
    .select("*")
    .single();

  if (error) return json({ ok: false, error: error.message }, headers, 500);

  const rows = items.map((item) => ({
    snapshot_id: snapshot.id,
    loc: item.loc,
    lastmod: item.lastmod ?? null,
    url_type: item.url_type,
    source_table: item.source_table ?? null,
    source_id: item.source_id ?? null,
    included: true,
  }));

  if (rows.length > 0) {
    await db.from("seo_sitemap_url_items").insert(rows);
  }

  return json({
    ok: true,
    data: {
      snapshot,
      urlCount: items.length,
      proResult,
    },
  }, headers);
});
