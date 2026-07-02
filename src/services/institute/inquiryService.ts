import { supabase } from "@/lib/supabase";
import type {
  InquiryDraft,
  InquirySetup,
  RegistryAnchor,
  RegistryAnchorType,
} from "@/pages/admin/institute/inquiry-interface/types";

type InquiryRow = {
  id: string;
  code: string;
  raw_question: string;
  current_question: string;
  status: string;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  featured_image_credit: string | null;
  featured_image_source: string | null;
  created_at: string;
  updated_at: string;
};

type AnchorRow = {
  inquiry_id: string;
  anchor_entity_type: string;
  anchor_slug: string | null;
  anchor_label: string;
  anchor_image_url: string | null;
  anchor_metadata: Record<string, unknown> | null;
  is_primary: boolean;
  status: string;
};

type WorkbenchSetupRow = {
  inquiry_id: string;
  inquiry_type: string | null;
  output_surfaces: string[] | null;
  evidence_formats: string[] | null;
  tools: string[] | null;
  scope_edges: Record<string, unknown> | null;
  care_defaults: Record<string, unknown> | null;
  estimated_attention: Record<string, unknown> | null;
};

type QuestionVersionRow = {
  inquiry_id: string;
  version_number: number;
};

function nowIso() {
  return new Date().toISOString();
}

function mapStatus(status: string): InquiryDraft["status"] {
  return status === "draft" ? "Draft" : "Framing";
}

const registryAnchorTypes: RegistryAnchorType[] = ["artist", "track", "release", "label", "genre"];

function normalizeAnchorType(value: string): RegistryAnchorType {
  return registryAnchorTypes.includes(value as RegistryAnchorType) ? value as RegistryAnchorType : "artist";
}

function mapAnchor(row: AnchorRow | undefined): RegistryAnchor | null {
  if (!row) return null;

  return {
    type: normalizeAnchorType(row.anchor_entity_type),
    slug: row.anchor_slug ?? "",
    label: row.anchor_label,
    subtitle: typeof row.anchor_metadata?.subtitle === "string" ? row.anchor_metadata.subtitle : "Anchor",
    imageUrl: row.anchor_image_url ?? null,
    contextText: typeof row.anchor_metadata?.contextText === "string" ? row.anchor_metadata.contextText : undefined,
    href: typeof row.anchor_metadata?.href === "string" ? row.anchor_metadata.href : undefined,
    metadata: row.anchor_metadata ?? undefined,
  };
}

function setupToRow(inquiryId: string, setup: InquirySetup) {
  return {
    inquiry_id: inquiryId,
    inquiry_type: setup.inquiryType,
    output_surfaces: setup.outputs,
    evidence_formats: setup.formats,
    tools: setup.tools,
    scope_edges: {
      timeRange: setup.scopeTimeRange,
      placeRoute: setup.scopePlaceRoute,
      languageRegister: setup.scopeLanguageRegister,
      exclusion: setup.scopeExclusion,
    },
    care_defaults: {
      consentDefault: setup.consentDefault,
      reviewStandard: setup.reviewStandard,
    },
    estimated_attention: {
      draftTimer: setup.draftTimer,
      previewDepth: setup.previewDepth,
    },
    setup_source: "human",
  };
}

function setupFromRow(row: WorkbenchSetupRow | undefined, fallback: InquirySetup): InquirySetup {
  if (!row) return fallback;

  const scopeEdges = row.scope_edges ?? {};
  const careDefaults = row.care_defaults ?? {};
  const estimatedAttention = row.estimated_attention ?? {};

  return {
    inquiryType: row.inquiry_type || fallback.inquiryType,
    outputs: Array.isArray(row.output_surfaces) ? row.output_surfaces : fallback.outputs,
    formats: Array.isArray(row.evidence_formats) ? row.evidence_formats : fallback.formats,
    tools: Array.isArray(row.tools) ? row.tools : fallback.tools,
    scopeTimeRange: typeof scopeEdges.timeRange === "string" ? scopeEdges.timeRange : fallback.scopeTimeRange,
    scopePlaceRoute: typeof scopeEdges.placeRoute === "string" ? scopeEdges.placeRoute : fallback.scopePlaceRoute,
    scopeLanguageRegister: typeof scopeEdges.languageRegister === "string" ? scopeEdges.languageRegister : fallback.scopeLanguageRegister,
    scopeExclusion: typeof scopeEdges.exclusion === "string" ? scopeEdges.exclusion : fallback.scopeExclusion,
    consentDefault: typeof careDefaults.consentDefault === "string" ? careDefaults.consentDefault : fallback.consentDefault,
    reviewStandard: typeof careDefaults.reviewStandard === "string" ? careDefaults.reviewStandard : fallback.reviewStandard,
    draftTimer: typeof estimatedAttention.draftTimer === "string" ? estimatedAttention.draftTimer : fallback.draftTimer,
    previewDepth: typeof estimatedAttention.previewDepth === "string" ? estimatedAttention.previewDepth : fallback.previewDepth,
  };
}

type AnchorContextItem = {
  title: string;
  body: string;
  source?: string;
};

function isUsefulValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

function formatMetadataValue(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(", ");
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return String(value);
}

function metadataKnowns(anchor: RegistryAnchor): AnchorContextItem[] {
  const metadata = anchor.metadata ?? {};

  return Object.entries(metadata)
    .filter(([, value]) => isUsefulValue(value))
    .slice(0, 8)
    .map(([key, value]) => ({
      title: `Anchor metadata: ${key}`,
      body: formatMetadataValue(value),
      source: "registry_anchor_metadata",
    }));
}

function buildAnchorContextSnapshot(anchor: RegistryAnchor) {
  const knowns: AnchorContextItem[] = [
    {
      title: "Anchor type",
      body: anchor.type,
      source: "selected_registry_anchor",
    },
    {
      title: "Anchor label",
      body: anchor.label,
      source: "selected_registry_anchor",
    },
    {
      title: "Anchor context",
      body: anchor.contextText || anchor.subtitle || "No context text was available for this anchor.",
      source: anchor.contextText ? "registry_search_context" : "registry_anchor_subtitle",
    },
    ...metadataKnowns(anchor),
  ];

  const unknowns: AnchorContextItem[] = [
    {
      title: "Evidence has not been reviewed yet",
      body: "This snapshot only captures registry context. Human evidence still needs to be added and reviewed.",
      source: "institute_snapshot_rule",
    },
    {
      title: "Claims are not settled",
      body: "The selected anchor can frame the Inquiry, but it does not prove the Inquiry question on its own.",
      source: "institute_snapshot_rule",
    },
  ];

  const evidenceGaps: AnchorContextItem[] = [
    {
      title: "Primary sources",
      body: "Add interviews, articles, archive links, media, or direct references that support or challenge the Inquiry.",
      source: "institute_snapshot_rule",
    },
    {
      title: "Relationship evidence",
      body: "Add evidence that explains how this anchor connects to people, sounds, places, moments, or claims in the Inquiry.",
      source: "institute_snapshot_rule",
    },
  ];

  const relationshipLeads: AnchorContextItem[] = [
    {
      title: `${anchor.label} as a starting point`,
      body: `Investigate what people, records, genres, labels, scenes, or places are connected to ${anchor.label}.`,
      source: "selected_registry_anchor",
    },
  ];

  const thinDataNotes: AnchorContextItem[] = [];
  if (!anchor.contextText) {
    thinDataNotes.push({
      title: "Missing context text",
      body: "This anchor did not provide a search context paragraph.",
      source: "registry_search_context",
    });
  }
  if (!anchor.imageUrl) {
    thinDataNotes.push({
      title: "Missing image",
      body: "This anchor did not provide an image URL.",
      source: "registry_anchor_image",
    });
  }

  return {
    source_context: {
      anchorType: anchor.type,
      slug: anchor.slug,
      label: anchor.label,
      subtitle: anchor.subtitle,
      imageUrl: anchor.imageUrl,
      contextText: anchor.contextText,
      href: anchor.href,
      metadata: anchor.metadata ?? {},
      capturedBy: "institute_inquiry_service",
    },
    knowns,
    unknowns,
    relationship_leads: relationshipLeads,
    evidence_gaps: evidenceGaps,
    related_entities: [],
    thin_data_notes: thinDataNotes,
    source_references: anchor.href
      ? [
          {
            type: "registry_url",
            label: anchor.label,
            url: anchor.href,
          },
        ]
      : [],
  };
}

async function createAnchorContextSnapshot(
  inquiryId: string,
  inquiryAnchorId: string,
  anchor: RegistryAnchor,
) {
  const snapshot = buildAnchorContextSnapshot(anchor);

  const { error } = await supabase
    .from("institute_anchor_context_snapshots")
    .insert({
      inquiry_id: inquiryId,
      inquiry_anchor_id: inquiryAnchorId,
      snapshot_version: 1,
      anchor_entity_type: anchor.type,
      anchor_slug: anchor.slug,
      anchor_label: anchor.label,
      ...snapshot,
    });

  if (error) throw error;
}

function normalizeInquiry(
  row: InquiryRow,
  anchorByInquiryId: Map<string, AnchorRow>,
  setupByInquiryId: Map<string, WorkbenchSetupRow>,
  versionCountByInquiryId: Map<string, number>,
  defaultSetup: InquirySetup,
): InquiryDraft {
  const anchor = mapAnchor(anchorByInquiryId.get(row.id));

  return {
    id: row.id,
    code: row.code,
    rawQuestion: row.raw_question,
    workingQuestion: row.current_question,
    anchor,
    featuredImageUrl: row.featured_image_url ?? "",
    featuredImageAlt: row.featured_image_alt ?? "",
    featuredImageCredit: row.featured_image_credit ?? "",
    featuredImageSource: row.featured_image_source ?? "Not set",
    status: mapStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    versionCount: versionCountByInquiryId.get(row.id) ?? 1,
    setup: setupFromRow(setupByInquiryId.get(row.id), defaultSetup),
    evidence: [],
  };
}

export async function listInstituteInquiries(defaultSetup: InquirySetup): Promise<InquiryDraft[]> {
  const { data: inquiryRows, error } = await supabase
    .from("institute_inquiries")
    .select("id, code, raw_question, current_question, status, featured_image_url, featured_image_alt, featured_image_credit, featured_image_source, created_at, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  const inquiries = (inquiryRows ?? []) as InquiryRow[];
  const inquiryIds = inquiries.map((inquiry) => inquiry.id);

  if (!inquiryIds.length) return [];

  const [{ data: anchorRows }, { data: setupRows }, { data: versionRows }] = await Promise.all([
    supabase
      .from("institute_inquiry_anchors")
      .select("inquiry_id, anchor_entity_type, anchor_slug, anchor_label, anchor_image_url, anchor_metadata, is_primary, status")
      .in("inquiry_id", inquiryIds)
      .eq("status", "active")
      .order("is_primary", { ascending: false }),
    supabase
      .from("institute_workbench_setup")
      .select("inquiry_id, inquiry_type, output_surfaces, evidence_formats, tools, scope_edges, care_defaults, estimated_attention")
      .in("inquiry_id", inquiryIds),
    supabase
      .from("institute_question_versions")
      .select("inquiry_id, version_number")
      .in("inquiry_id", inquiryIds),
  ]);

  const anchorByInquiryId = new Map<string, AnchorRow>();
  ((anchorRows ?? []) as AnchorRow[]).forEach((anchor) => {
    if (!anchorByInquiryId.has(anchor.inquiry_id)) anchorByInquiryId.set(anchor.inquiry_id, anchor);
  });

  const setupByInquiryId = new Map<string, WorkbenchSetupRow>();
  ((setupRows ?? []) as WorkbenchSetupRow[]).forEach((setup) => {
    setupByInquiryId.set(setup.inquiry_id, setup);
  });

  const versionCountByInquiryId = new Map<string, number>();
  ((versionRows ?? []) as QuestionVersionRow[]).forEach((version) => {
    versionCountByInquiryId.set(version.inquiry_id, Math.max(versionCountByInquiryId.get(version.inquiry_id) ?? 0, version.version_number));
  });

  return inquiries.map((row) =>
    normalizeInquiry(row, anchorByInquiryId, setupByInquiryId, versionCountByInquiryId, defaultSetup),
  );
}

export async function createInstituteInquiry(
  question: string,
  anchor: RegistryAnchor | null,
  defaultSetup: InquirySetup,
): Promise<InquiryDraft> {
  const cleanQuestion = question.trim();
  if (cleanQuestion.length < 8) throw new Error("Inquiry question is too short.");

  const { data: inquiry, error: inquiryError } = await supabase
    .from("institute_inquiries")
    .insert({
      raw_question: cleanQuestion,
      current_question: cleanQuestion,
      status: "framing",
      maturity: "framing",
      featured_image_url: anchor?.imageUrl ?? null,
      featured_image_alt: anchor?.imageUrl ? `${anchor.label} registry ${anchor.type} image` : null,
      featured_image_credit: anchor?.imageUrl ? "WAKILISHA registry" : null,
      featured_image_source: anchor?.imageUrl ? "Registry anchor" : "Not set",
    })
    .select("id, code, raw_question, current_question, status, featured_image_url, featured_image_alt, featured_image_credit, featured_image_source, created_at, updated_at")
    .single();

  if (inquiryError) throw inquiryError;

  const inquiryRow = inquiry as InquiryRow;

  const { data: questionVersion, error: questionError } = await supabase
    .from("institute_question_versions")
    .insert({
      inquiry_id: inquiryRow.id,
      version_number: 1,
      question_text: cleanQuestion,
      version_type: "raw",
      reason: "Initial Inquiry question",
    })
    .select("id")
    .single();

  if (questionError) throw questionError;

  await supabase
    .from("institute_inquiries")
    .update({ current_question_version_id: questionVersion.id })
    .eq("id", inquiryRow.id);

  if (anchor) {
    const { data: anchorRow, error: anchorError } = await supabase
      .from("institute_inquiry_anchors")
      .insert({
        inquiry_id: inquiryRow.id,
        source_system: "registry",
        anchor_entity_type: anchor.type,
        anchor_slug: anchor.slug,
        anchor_label: anchor.label,
        anchor_url: anchor.href,
        anchor_image_url: anchor.imageUrl,
        anchor_metadata: {
          ...(anchor.metadata ?? {}),
          subtitle: anchor.subtitle,
          contextText: anchor.contextText,
          href: anchor.href,
        },
        is_primary: true,
        status: "active",
      })
      .select("id")
      .single();

    if (anchorError) throw anchorError;

    if (anchorRow?.id) {
      await createAnchorContextSnapshot(inquiryRow.id, anchorRow.id, anchor);
    }
  }

  await supabase
    .from("institute_workbench_setup")
    .upsert(setupToRow(inquiryRow.id, defaultSetup), { onConflict: "inquiry_id" });

  const anchorByInquiryId = new Map<string, AnchorRow>();
  if (anchor) {
    anchorByInquiryId.set(inquiryRow.id, {
      inquiry_id: inquiryRow.id,
      anchor_entity_type: anchor.type,
      anchor_slug: anchor.slug,
      anchor_label: anchor.label,
      anchor_image_url: anchor.imageUrl,
      anchor_metadata: {
        ...(anchor.metadata ?? {}),
        subtitle: anchor.subtitle,
        contextText: anchor.contextText,
        href: anchor.href,
      },
      is_primary: true,
      status: "active",
    });
  }

  const setupByInquiryId = new Map<string, WorkbenchSetupRow>();
  const versionCountByInquiryId = new Map<string, number>([[inquiryRow.id, 1]]);

  return normalizeInquiry(inquiryRow, anchorByInquiryId, setupByInquiryId, versionCountByInquiryId, defaultSetup);
}

export async function updateInstituteInquiry(
  inquiryId: string,
  patch: Partial<InquiryDraft>,
  current: InquiryDraft | null,
): Promise<void> {
  const inquiryPatch: Record<string, unknown> = {};

  if (typeof patch.workingQuestion === "string") {
    const cleanQuestion = patch.workingQuestion.trim();
    if (cleanQuestion.length >= 8 && cleanQuestion !== current?.workingQuestion) {
      const nextVersion = (current?.versionCount ?? 1) + 1;

      const { data: version, error: versionError } = await supabase
        .from("institute_question_versions")
        .insert({
          inquiry_id: inquiryId,
          version_number: nextVersion,
          question_text: cleanQuestion,
          version_type: "working",
          reason: "Workbench question edit",
        })
        .select("id")
        .single();

      if (versionError) throw versionError;

      inquiryPatch.current_question = cleanQuestion;
      inquiryPatch.current_question_version_id = version.id;
    }
  }

  if ("featuredImageUrl" in patch) inquiryPatch.featured_image_url = patch.featuredImageUrl || null;
  if ("featuredImageAlt" in patch) inquiryPatch.featured_image_alt = patch.featuredImageAlt || null;
  if ("featuredImageCredit" in patch) inquiryPatch.featured_image_credit = patch.featuredImageCredit || null;
  if ("featuredImageSource" in patch) inquiryPatch.featured_image_source = patch.featuredImageSource || "Not set";

  if (Object.keys(inquiryPatch).length) {
    const { error } = await supabase
      .from("institute_inquiries")
      .update(inquiryPatch)
      .eq("id", inquiryId);

    if (error) throw error;
  }

  if (patch.setup) {
    const { error } = await supabase
      .from("institute_workbench_setup")
      .upsert(setupToRow(inquiryId, patch.setup), { onConflict: "inquiry_id" });

    if (error) throw error;
  }
}
