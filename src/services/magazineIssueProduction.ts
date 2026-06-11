import { supabase } from "@/lib/supabase";

// ── Types ──

export type IssueStatus = "draft" | "generated" | "approved" | "published" | "locked" | "archived" | "failed_generation";
export type SectionStatus = "draft" | "generated" | "approved" | "rejected" | "locked";
export type EntityType = "article" | "artist" | "track" | "release" | "label" | "genre" | "chart" | "chart_entry" | "media_asset" | "guide";
export type SelectionState = "selected" | "pinned" | "excluded";
export type CandidateGroup = EntityType;

export type MagazineIssue = {
  id: string;
  slug: string;
  title: string;
  dek: string | null;
  status: IssueStatus;
  timeframe_start: string | null;
  timeframe_end: string | null;
  brief_id: string | null;
  issue_type: string;
  visual_family: string | null;
  treatment: string | null;
  palette: string | null;
  contrast_mode: string | null;
  created_by: string;
  generated_by: string | null;
  approved_by: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
  generated_at: string | null;
  approved_at: string | null;
  published_at: string | null;
  locked_at: string | null;
};

export type MagazineIssueSection = {
  id: string;
  issue_id: string;
  spread_id: string;
  section_type: string;
  title: string;
  deck: string | null;
  body: string | null;
  layout: string;
  sort_order: number;
  status: SectionStatus;
  visual_asset_id: string | null;
  created_at: string;
  updated_at: string;
};

export type MagazineIssueEntity = {
  id: string;
  issue_id: string;
  section_id: string | null;
  entity_type: EntityType;
  entity_id: string;
  role: string;
  selection_state: SelectionState;
  sort_order: number;
  source_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type IssueCandidate = {
  id: string;
  entityType: EntityType;
  entityId: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  source: string;
  date: string | null;
};

export type IssueWithDetails = MagazineIssue & {
  sections: MagazineIssueSection[];
  entities: MagazineIssueEntity[];
};

export type VisualDirection = {
  visual_family: string;
  treatment: string;
  palette: string;
  contrast_mode: string;
};

// ── Controlled Options ──

export const VISUAL_FAMILIES = [
  "Scene / Atmosphere",
  "Cover Story",
  "Release Radar",
  "Artist Profile",
  "Chart Pulse",
  "Editorial Essay",
  "Visual Index",
];

export const TREATMENTS = [
  "annotated-photo",
  "editorial-collage",
  "clean-magazine",
  "brutalist-index",
  "cinematic-portrait",
  "data-led",
];

export const PALETTES = [
  "neutral",
  "high_contrast",
  "warm_archive",
  "night_green",
  "monochrome",
  "issue_custom",
];

export const CONTRAST_MODES = ["dark", "light", "mixed"];

export const ISSUE_TYPES = ["standard", "special", "annual", "themed"];

export const SPREAD_TYPES = [
  "cover",
  "editors-note",
  "contents",
  "feature",
  "signal",
  "section-opener",
  "guide",
  "review",
  "partner",
  "back-matter",
  "article-list",
  "full-bleed-image",
  "quote-only",
  "color-interlude",
];

// ── Service ──

export const magazineIssueProduction = {
  // ── Issues CRUD ──

  async listIssues(): Promise<MagazineIssue[]> {
    const { data, error } = await supabase
      .from("wk_magazine_issues")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  async getIssue(id: string): Promise<IssueWithDetails | null> {
    const { data: issue, error } = await supabase
      .from("wk_magazine_issues")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!issue) return null;

    const [{ data: sections }, { data: entities }] = await Promise.all([
      supabase.from("wk_magazine_issue_sections").select("*").eq("issue_id", id).order("sort_order", { ascending: true }),
      supabase.from("wk_magazine_issue_entities").select("*").eq("issue_id", id).order("sort_order", { ascending: true }),
    ]);

    return { ...issue, sections: sections ?? [], entities: entities ?? [] };
  },

  async getIssueBySlug(slug: string): Promise<IssueWithDetails | null> {
    const { data: issue, error } = await supabase
      .from("wk_magazine_issues")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw error;
    if (!issue) return null;

    return magazineIssueProduction.getIssue(String(issue.id));
  },

  async createIssue(params: {
    title: string;
    slug: string;
    dek?: string;
    timeframe_start?: string;
    timeframe_end?: string;
    issue_type?: string;
    brief_id?: string;
  }): Promise<MagazineIssue> {
    const id = `issue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const { data, error } = await supabase
      .rpc("create_magazine_issue", {
        p_id: id,
        p_slug: params.slug,
        p_title: params.title,
        p_dek: params.dek ?? null,
        p_timeframe_start: params.timeframe_start ?? "",
        p_timeframe_end: params.timeframe_end ?? "",
        p_issue_type: params.issue_type ?? "standard",
        p_brief_id: params.brief_id ?? "",
      });

    if (error) throw error;
    return data as unknown as MagazineIssue;
  },

  async updateIssue(id: string, updates: Partial<MagazineIssue>): Promise<MagazineIssue> {
    const { data, error } = await supabase
      .from("wk_magazine_issues")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteIssue(id: string): Promise<void> {
    const { error } = await supabase
      .from("wk_magazine_issues")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  // ── Candidate Discovery (Repaired Graph Sources) ──

  async discoverCandidates(timeframeStart?: string, timeframeEnd?: string): Promise<Record<CandidateGroup, IssueCandidate[]>> {
    const result: Record<CandidateGroup, IssueCandidate[]> = {
      article: [],
      artist: [],
      track: [],
      release: [],
      label: [],
      genre: [],
      chart: [],
      chart_entry: [],
      media_asset: [],
      guide: [],
    };

    try {
      // Articles from wk_articles (repaired content)
      const articleQuery = supabase
        .from("wk_articles")
        .select("id, slug, title, excerpt, published_at, hero_image_url, categories")
        .eq("wp_status", "publish")
        .order("published_at", { ascending: false })
        .limit(30);

      if (timeframeStart) articleQuery.gte("published_at", timeframeStart);
      if (timeframeEnd) articleQuery.lte("published_at", timeframeEnd);

      const { data: articles } = await articleQuery;
      result.article = (articles ?? []).map((a: any) => {
        const cats = Array.isArray(a.categories) ? a.categories.map((c: any) => (typeof c === "string" ? c : c?.name ?? "")).filter(Boolean) : [];
        return {
          id: String(a.id),
          entityType: "article" as const,
          entityId: String(a.slug),
          title: String(a.title),
          subtitle: a.excerpt || cats.slice(0, 2).join(" / ") || "",
          imageUrl: a.hero_image_url || null,
          source: "wk_articles",
          date: a.published_at || null,
        };
      });

      // Artists from registry (repaired graph)
      const { data: artists } = await supabase
        .from("registry_artists")
        .select("id, slug, display_name, public_image_url, metadata")
        .eq("status", "active")
        .order("display_name", { ascending: true })
        .limit(30);

      result.artist = (artists ?? []).map((a: any) => {
        const meta = (a.metadata || {}) as Record<string, unknown>;
        const genresArr = meta.genres;
        const genreNames: string[] = Array.isArray(genresArr) ? genresArr.map(String) : [];
        return {
          id: String(a.id),
          entityType: "artist" as const,
          entityId: String(a.slug),
          title: String(a.display_name),
          subtitle: genreNames.slice(0, 3).join(" / ") || "Artist",
          imageUrl: a.public_image_url || null,
          source: "registry_artists",
          date: null,
        };
      });

      // Releases from registry
      const { data: releases } = await supabase
        .from("registry_releases")
        .select("id, slug, title, release_date, release_type, artwork_url")
        .in("status", ["active", "draft"])
        .order("release_date", { ascending: false })
        .limit(20);

      result.release = (releases ?? []).map((r: any) => ({
        id: String(r.id),
        entityType: "release" as const,
        entityId: String(r.slug),
        title: String(r.title),
        subtitle: String(r.release_type || "Release") + (r.release_date ? ` · ${String(r.release_date).split("-")[0]}` : ""),
        imageUrl: r.artwork_url || null,
        source: "registry_releases",
        date: r.release_date || null,
      }));

      // Tracks from registry
      const { data: tracks } = await supabase
        .from("registry_tracks")
        .select("id, slug, title, artwork_url, isrc")
        .order("title", { ascending: true })
        .limit(30);

      result.track = (tracks ?? []).map((t: any) => ({
        id: String(t.id),
        entityType: "track" as const,
        entityId: String(t.slug || t.id),
        title: String(t.title),
        subtitle: t.isrc ? `ISRC: ${t.isrc}` : "Track",
        imageUrl: t.artwork_url || null,
        source: "registry_tracks",
        date: null,
      }));

      // Labels from registry
      const { data: labels } = await supabase
        .from("registry_labels")
        .select("id, slug, name, country_code")
        .eq("status", "active")
        .order("name", { ascending: true })
        .limit(20);

      result.label = (labels ?? []).map((l: any) => ({
        id: String(l.id),
        entityType: "label" as const,
        entityId: String(l.slug),
        title: String(l.name),
        subtitle: l.country_code || "Label",
        imageUrl: null,
        source: "registry_labels",
        date: null,
      }));

      // Genres from registry
      const { data: genres } = await supabase
        .from("registry_genres")
        .select("id, slug, name, description")
        .eq("status", "active")
        .order("name", { ascending: true });

      result.genre = (genres ?? []).map((g: any) => ({
        id: String(g.id),
        entityType: "genre" as const,
        entityId: String(g.slug),
        title: String(g.name),
        subtitle: g.description || "Genre",
        imageUrl: null,
        source: "registry_genres",
        date: null,
      }));

      // Charts from chart_programs
      const { data: charts } = await supabase
        .from("chart_programs")
        .select("id, public_slug, label")
        .eq("status", "active")
        .order("label", { ascending: true })
        .limit(15);

      result.chart = (charts ?? []).map((c: any) => ({
        id: String(c.id),
        entityType: "chart" as const,
        entityId: String(c.public_slug),
        title: String(c.label),
        subtitle: "Chart Program",
        imageUrl: null,
        source: "chart_programs",
        date: null,
      }));

      // Guides from wk_guides
      const { data: guides } = await supabase
        .from("guides")
        .select("id, slug, title, excerpt")
        .order("title", { ascending: true })
        .limit(15);

      result.guide = (guides ?? []).map((g: any) => ({
        id: String(g.id),
        entityType: "guide" as const,
        entityId: String(g.slug || g.id),
        title: String(g.title),
        subtitle: g.excerpt || "Guide",
        imageUrl: null,
        source: "guides",
        date: null,
      }));

      return result;
    } catch (err) {
      console.error("Candidate discovery error:", err);
      return result;
    }
  },

  // ── Generation ──

  async generateIssue(
    issueId: string,
    selectedEntities: { entityType: EntityType; entityId: string; role: string; selectionState: SelectionState; sectionId?: string }[],
    visualDirection: VisualDirection,
  ): Promise<IssueWithDetails> {
    const now = new Date().toISOString();
    const actor = "Admin";

    // 1. Update the issue with visual direction
    await supabase
      .from("wk_magazine_issues")
      .update({
        visual_family: visualDirection.visual_family,
        treatment: visualDirection.treatment,
        palette: visualDirection.palette,
        contrast_mode: visualDirection.contrast_mode,
        status: "generated",
        generated_at: now,
        generated_by: actor,
      })
      .eq("id", issueId);

    // 2. Create standard spreads/sections
    const spreadDefs = [
      { id: `${issueId}-cover`, type: "cover", title: "Cover", layout: "cover", order: 0 },
      { id: `${issueId}-editors-note`, type: "editors-note", title: "Editor's Note", layout: "editorial", order: 1 },
      { id: `${issueId}-contents`, type: "contents", title: "Contents", layout: "index", order: 2 },
      { id: `${issueId}-feature`, type: "feature", title: "Feature", layout: "feature", order: 3 },
      { id: `${issueId}-signal`, type: "signal", title: "The Signal", layout: "signal", order: 4 },
    ];

    const sectionInserts = spreadDefs.map((def) => ({
      id: def.id,
      issue_id: issueId,
      spread_id: def.id,
      section_type: def.type,
      title: def.title,
      deck: null,
      body: null,
      layout: def.layout,
      sort_order: def.order,
      status: "generated" as SectionStatus,
      visual_asset_id: null,
    }));

    await supabase.from("wk_magazine_issue_sections").upsert(sectionInserts, { onConflict: "id" });

    // 3. Create entity selections
    const entityInserts = selectedEntities.map((e, idx) => ({
      id: `${issueId}-entity-${idx}`,
      issue_id: issueId,
      section_id: e.sectionId ?? null,
      entity_type: e.entityType,
      entity_id: e.entityId,
      role: e.role,
      selection_state: e.selectionState,
      sort_order: idx,
      source_reason: "admin-selected",
    }));

    if (entityInserts.length > 0) {
      // Delete existing entities first to avoid duplicates
      await supabase.from("wk_magazine_issue_entities").delete().eq("issue_id", issueId);
      await supabase.from("wk_magazine_issue_entities").insert(entityInserts);
    }

    return (await magazineIssueProduction.getIssue(issueId))!;
  },

  // ── Status Transitions ──

  async approveIssue(issueId: string): Promise<MagazineIssue> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("wk_magazine_issues")
      .update({
        status: "approved",
        approved_at: now,
        approved_by: "Admin",
      })
      .eq("id", issueId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async publishIssue(issueId: string): Promise<MagazineIssue> {
    const now = new Date().toISOString();

    // Validate publish readiness
    const issue = await magazineIssueProduction.getIssue(issueId);
    if (!issue) throw new Error("Issue not found");

    const approvedSections = issue.sections.filter((s) => s.status === "approved" || s.status === "locked");
    const approvedEntities = issue.entities.filter((e) => e.selection_state !== "excluded");

    if (approvedSections.length === 0) throw new Error("Issue needs at least one approved section before publishing.");
    if (approvedEntities.length === 0) throw new Error("Issue needs at least one selected entity before publishing.");

    const { data, error } = await supabase
      .from("wk_magazine_issues")
      .update({
        status: "published",
        published_at: now,
        published_by: "Admin",
      })
      .eq("id", issueId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async lockIssue(issueId: string): Promise<MagazineIssue> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("wk_magazine_issues")
      .update({
        status: "locked",
        locked_at: now,
      })
      .eq("id", issueId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async archiveIssue(issueId: string): Promise<MagazineIssue> {
    const { data, error } = await supabase
      .from("wk_magazine_issues")
      .update({ status: "archived" })
      .eq("id", issueId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ── Sections ──

  async addSection(issueId: string, section: Partial<MagazineIssueSection> & { spread_id: string; section_type: string; title: string }): Promise<MagazineIssueSection> {
    const id = section.id || `section-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: existing } = await supabase
      .from("wk_magazine_issue_sections")
      .select("sort_order")
      .eq("issue_id", issueId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextOrder = ((existing ?? [])[0]?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
      .from("wk_magazine_issue_sections")
      .insert({
        id,
        issue_id: issueId,
        spread_id: section.spread_id,
        section_type: section.section_type,
        title: section.title,
        deck: section.deck ?? null,
        body: section.body ?? null,
        layout: section.layout ?? "standard",
        sort_order: section.sort_order ?? nextOrder,
        status: section.status ?? "draft",
        visual_asset_id: section.visual_asset_id ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateSection(sectionId: string, updates: Partial<MagazineIssueSection>): Promise<MagazineIssueSection> {
    const { data, error } = await supabase
      .from("wk_magazine_issue_sections")
      .update(updates)
      .eq("id", sectionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteSection(sectionId: string): Promise<void> {
    const { error } = await supabase
      .from("wk_magazine_issue_sections")
      .delete()
      .eq("id", sectionId);

    if (error) throw error;
  },

  // ── Entities ──

  async addEntity(issueId: string, entity: Partial<MagazineIssueEntity> & { entity_type: EntityType; entity_id: string }): Promise<MagazineIssueEntity> {
    const id = `entity-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase
      .from("wk_magazine_issue_entities")
      .insert({
        id,
        issue_id: issueId,
        section_id: entity.section_id ?? null,
        entity_type: entity.entity_type,
        entity_id: entity.entity_id,
        role: entity.role ?? "supporting",
        selection_state: entity.selection_state ?? "selected",
        sort_order: entity.sort_order ?? 0,
        source_reason: entity.source_reason ?? "admin-added",
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateEntity(entityId: string, updates: Partial<MagazineIssueEntity>): Promise<MagazineIssueEntity> {
    const { data, error } = await supabase
      .from("wk_magazine_issue_entities")
      .update(updates)
      .eq("id", entityId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteEntity(entityId: string): Promise<void> {
    const { error } = await supabase
      .from("wk_magazine_issue_entities")
      .delete()
      .eq("id", entityId);

    if (error) throw error;
  },

  // ── Publish Validation ──

  async validatePublishReadiness(issueId: string): Promise<{ ready: boolean; issues: string[] }> {
    const issue = await magazineIssueProduction.getIssue(issueId);
    if (!issue) return { ready: false, issues: ["Issue not found."] };

    const problems: string[] = [];

    const approvedSections = issue.sections.filter((s) => s.status === "approved" || s.status === "locked");
    if (approvedSections.length === 0) problems.push("No approved or locked sections.");

    const selectedEntities = issue.entities.filter((e) => e.selection_state !== "excluded");
    if (selectedEntities.length === 0) problems.push("No selected entities.");

    if (!issue.slug) problems.push("Missing slug.");
    if (!issue.title) problems.push("Missing title.");

    // Check slug uniqueness among published issues
    const { data: slugCheck } = await supabase
      .from("wk_magazine_issues")
      .select("id")
      .eq("slug", issue.slug)
      .eq("status", "published")
      .neq("id", issueId);

    if (slugCheck && slugCheck.length > 0) problems.push("Slug conflict with another published issue.");

    return { ready: problems.length === 0, issues: problems };
  },
};