import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { WkIcon } from "@/components/design-system/Icon";

type ProviderKey = "apple_music" | "spotify";

interface ArtistCredit {
  credit_order: number;
  credit_role: "primary" | "featured" | "unresolved";
  resolution_mode: string;
  registry_artist_id: string | null;
  observed_name: string;
  display_name: string;
}

interface RegistryArtistHit {
  id: string;
  display_name: string;
  slug: string | null;
  public_image_url: string | null;
  status: string;
}

interface IntakeRow {
  suggestion_id: string;
  status: string;
  intake_origin: "playlist_editor" | "public_contribution";
  source_contribution_id: string | null;
  contribution_status: string | null;
  contribution_payload: Record<string, unknown>;
  submitted_track_title: string | null;
  playlist_id: string;
  playlist_title: string | null;
  playlist_item_id: string | null;
  playlist_position: number | null;
  playlist_note: string | null;
  provider_key: string | null;
  provider_object_id: string | null;
  provider_url: string | null;
  provider_title: string | null;
  provider_release_title: string | null;
  provider_artist_names: string[];
  playback_kind: "audio" | "video" | null;
  artwork_url: string | null;
  preview_url: string | null;
  requested_by: string | null;
  requested_by_name: string | null;
  created_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  canonical_track_id: string | null;
  canonical_track_title: string | null;
  canonicalized_track_id: string | null;
  canonicalized_track_title: string | null;
  artist_credits: ArtistCredit[];
}

interface QueueEnvelope {
  status: string;
  total: number;
  limit: number;
  offset: number;
  rows: IntakeRow[];
}

interface RegistryTrackHit {
  id: string;
  title: string | null;
  slug: string | null;
  status: string;
  artwork_url: string | null;
  isrc?: string | null;
  duration_ms?: number | null;
  artist_names: string[];
}

interface ProviderSearchHit {
  provider: ProviderKey;
  providerEntityId: string;
  title: string;
  artistDisplayName: string | null;
  artworkUrl: string | null;
  confidenceScore: number;
}

interface ProviderObservation {
  id: string;
  field_name: string;
  field_value: string;
  provider: string;
  confidence_score: number | null;
  source_path: string | null;
  created_at: string;
}

interface EnrichmentEnvelope {
  suggestion_id: string;
  observations: ProviderObservation[];
  accepted: Record<string, string>;
  provider_links: Array<{
    provider: string;
    provider_entity_id: string;
    provider_url: string | null;
    confidence_score: number | null;
  }>;
}

interface ProviderInspection {
  provider: ProviderKey;
  providerEntityId: string;
  title: string | null;
  artistDisplayName: string | null;
  artworkUrl: string | null;
  confidenceScore: number;
  providerUrl: string | null;
  enrichment: Record<string, unknown>;
  source: {
    storefrontOrMarket?: string | null;
    fetchedAt?: string | null;
  };
}

const TRACK_INTAKE_PAGE_SIZE = 10;

const enrichmentFieldOrder = [
  "title",
  "isrc",
  "duration_ms",
  "track_artwork_url",
  "preview_url",
  "release_title",
  "release_date",
  "release_date_precision",
  "release_artwork_url",
  "label_name",
  "imprint_name",
  "genre",
  "track_number",
  "disc_number",
  "explicit",
  "upc",
  "copyright_text",
] as const;

function humanize(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDuration(value: unknown) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return String(value ?? "Not set");
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function fieldDisplay(field: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "Not set";
  if (field === "duration_ms") return formatDuration(value);
  if (field === "explicit") {
    return value === true || String(value) === "true" ? "Explicit" : "Not explicit";
  }
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function acceptedFieldsEqual(
  current: Record<string, unknown>,
  persisted: Record<string, string>,
) {
  const currentKeys = Object.keys(current).sort();
  const persistedKeys = Object.keys(persisted).sort();

  if (currentKeys.length !== persistedKeys.length) return false;

  return currentKeys.every(
    (key, index) =>
      key === persistedKeys[index] &&
      String(current[key] ?? "") === String(persisted[key] ?? ""),
  );
}

function escapeLike(value: string) {
  return value.replace(/[%_]/g, (match) => `\\${match}`);
}

async function untypedRpc(
  name: string,
  args: Record<string, unknown>,
) {
  const { data, error } = await (supabase.rpc as any)(name, args);
  if (error) throw error;
  return data;
}

export default function TrackIntakePage() {
  const [searchParams] = useSearchParams();
  const deepSuggestion = searchParams.get("suggestion");
  const deepPlaylistItem = searchParams.get("playlistItem");

  const [status, setStatus] = useState("needs_review");
  const [queue, setQueue] = useState<QueueEnvelope>({
    status: "needs_review",
    total: 0,
    limit: 100,
    offset: 0,
    rows: [],
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const [trackQuery, setTrackQuery] =
    useState<Record<string, string>>({});
  const [trackHits, setTrackHits] =
    useState<Record<string, RegistryTrackHit[]>>({});
  const [trackSearching, setTrackSearching] =
    useState<Record<string, boolean>>({});
  const [trackSearchAttempted, setTrackSearchAttempted] =
    useState<Record<string, boolean>>({});
  const trackSearchSequence = useRef<Record<string, number>>({});
  const [selectedTrack, setSelectedTrack] =
    useState<Record<string, RegistryTrackHit | null>>({});
  const [newCanonicalTitle, setNewCanonicalTitle] =
    useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] =
    useState<Record<string, string>>({});

  const [artistQuery, setArtistQuery] =
    useState<Record<string, string>>({});
  const [artistHits, setArtistHits] =
    useState<Record<string, RegistryArtistHit[]>>({});
  const [artistSearching, setArtistSearching] =
    useState<Record<string, boolean>>({});
  const [artistSearchAttempted, setArtistSearchAttempted] =
    useState<Record<string, boolean>>({});
  const [selectedArtist, setSelectedArtist] =
    useState<Record<string, RegistryArtistHit | null>>({});
  const [artistRole, setArtistRole] =
    useState<Record<string, "primary" | "featured" | "">>({});
  const artistSearchSequence =
    useRef<Record<string, number>>({});

  const [providerChoice, setProviderChoice] =
    useState<Record<string, ProviderKey>>({});
  const [providerQuery, setProviderQuery] =
    useState<Record<string, string>>({});
  const [providerHits, setProviderHits] =
    useState<Record<string, ProviderSearchHit[]>>({});
  const [providerInspection, setProviderInspection] =
    useState<Record<string, ProviderInspection | null>>({});
  const [enrichment, setEnrichment] =
    useState<Record<string, EnrichmentEnvelope | null>>({});
  const [acceptedFields, setAcceptedFields] =
    useState<Record<string, Record<string, unknown>>>({});
  const [allowOverwrite, setAllowOverwrite] =
    useState<Record<string, boolean>>({});
  const [saveFeedback, setSaveFeedback] =
    useState<Record<string, boolean>>({});

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await untypedRpc(
        "admin_get_registry_track_intake_queue",
        {
          p_status:
            deepSuggestion || deepPlaylistItem ? "all" : status,
          p_limit: 100,
          p_offset: 0,
          p_suggestion_id: deepSuggestion || null,
          p_playlist_item_id: deepPlaylistItem || null,
        },
      );

      const envelope = (data ?? {}) as QueueEnvelope;
      setQueue({
        status: envelope.status ?? status,
        total: Number(envelope.total ?? 0),
        limit: Number(envelope.limit ?? 100),
        offset: Number(envelope.offset ?? 0),
        rows: Array.isArray(envelope.rows) ? envelope.rows : [],
      });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Track Intake could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [status, deepSuggestion, deepPlaylistItem]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return queue.rows;

    return queue.rows.filter((row) => {
      const haystack = [
        row.submitted_track_title,
        row.provider_title,
        row.provider_release_title,
        row.provider_key,
        row.playlist_title,
        ...(row.provider_artist_names ?? []),
        ...(row.artist_credits ?? []).map(
          (credit) => credit.display_name,
        ),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [queue.rows, query]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filtered.length /
        TRACK_INTAKE_PAGE_SIZE,
    ),
  );

  const safePage = Math.min(
    page,
    totalPages - 1,
  );

  const visible = useMemo(() => {
    if (
      deepSuggestion ||
      deepPlaylistItem
    ) {
      return filtered;
    }

    const start =
      safePage *
      TRACK_INTAKE_PAGE_SIZE;

    return filtered.slice(
      start,
      start +
        TRACK_INTAKE_PAGE_SIZE,
    );
  }, [
    deepSuggestion,
    deepPlaylistItem,
    filtered,
    safePage,
  ]);

  const visibleStart =
    filtered.length === 0
      ? 0
      : safePage *
          TRACK_INTAKE_PAGE_SIZE +
        1;

  const visibleEnd = Math.min(
    filtered.length,
    (safePage + 1) *
      TRACK_INTAKE_PAGE_SIZE,
  );

  useEffect(() => {
    setPage(0);
  }, [
    query,
    status,
  ]);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [
    page,
    safePage,
  ]);

  async function loadEnrichment(suggestionId: string) {
    const data = await untypedRpc(
      "admin_get_registry_track_intake_enrichment",
      { p_suggestion_id: suggestionId },
    );
    const envelope = data as EnrichmentEnvelope;
    setEnrichment((current) => ({
      ...current,
      [suggestionId]: envelope,
    }));

    if (envelope?.accepted) {
      setAcceptedFields((current) => ({
        ...current,
        [suggestionId]: {
          ...envelope.accepted,
          ...(current[suggestionId] ?? {}),
        },
      }));
    }
  }

  useEffect(() => {
    if (!deepSuggestion && !deepPlaylistItem) return;

    const row = queue.rows[0];
    if (!row) return;

    void loadEnrichment(row.suggestion_id).catch((reason) => {
      setError(
        reason instanceof Error
          ? reason.message
          : "Saved enrichment decisions could not be loaded.",
      );
    });
  }, [deepSuggestion, deepPlaylistItem, queue.rows]);

  async function searchTracks(suggestionId: string, value: string) {
    setTrackQuery((current) => ({
      ...current,
      [suggestionId]: value,
    }));
    setSelectedTrack((current) => ({
      ...current,
      [suggestionId]: null,
    }));

    const requestId =
      (trackSearchSequence.current[suggestionId] ?? 0) + 1;
    trackSearchSequence.current[suggestionId] = requestId;

    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setTrackHits((current) => ({
        ...current,
        [suggestionId]: [],
      }));
      setTrackSearching((current) => ({
        ...current,
        [suggestionId]: false,
      }));
      setTrackSearchAttempted((current) => ({
        ...current,
        [suggestionId]: false,
      }));
      return;
    }

    setTrackSearching((current) => ({
      ...current,
      [suggestionId]: true,
    }));
    setTrackSearchAttempted((current) => ({
      ...current,
      [suggestionId]: false,
    }));
    setError(null);

    try {
      const pattern = `%${escapeLike(trimmed)}%`;
      const [titleResponse, isrcResponse, artistResponse] =
        await Promise.all([
          supabase
            .from("registry_tracks")
            .select("id")
            .eq("status", "active")
            .ilike("title", pattern)
            .limit(20),
          supabase
            .from("registry_tracks")
            .select("id")
            .eq("status", "active")
            .ilike("isrc", pattern)
            .limit(20),
          supabase
            .from("registry_track_artists")
            .select("track_id")
            .eq("status", "active")
            .ilike("artist_name_text", pattern)
            .limit(30),
        ]);

      if (titleResponse.error) throw titleResponse.error;
      if (isrcResponse.error) throw isrcResponse.error;
      if (artistResponse.error) throw artistResponse.error;

      const ids = Array.from(
        new Set([
          ...(titleResponse.data ?? []).map((row) => row.id),
          ...(isrcResponse.data ?? []).map((row) => row.id),
          ...(artistResponse.data ?? []).map((row) => row.track_id),
        ].filter(Boolean)),
      ).slice(0, 20) as string[];

      let hits: RegistryTrackHit[] = [];
      if (ids.length > 0) {
        const [trackResponse, creditResponse] = await Promise.all([
          supabase
            .from("registry_tracks")
            .select(
              "id,title,slug,status,artwork_url,isrc,duration_ms",
            )
            .in("id", ids)
            .eq("status", "active"),
          supabase
            .from("registry_track_artists")
            .select("track_id,artist_name_text,is_primary")
            .in("track_id", ids)
            .eq("status", "active"),
        ]);

        if (trackResponse.error) throw trackResponse.error;
        if (creditResponse.error) throw creditResponse.error;

        const artistNames = new Map<string, string[]>();
        (creditResponse.data ?? []).forEach((credit) => {
          const name = String(credit.artist_name_text ?? "").trim();
          if (!name) return;
          const names = artistNames.get(credit.track_id) ?? [];
          if (!names.includes(name)) names.push(name);
          artistNames.set(credit.track_id, names);
        });

        hits = (trackResponse.data ?? [])
          .map((track) => ({
            ...track,
            artist_names: artistNames.get(track.id) ?? [],
          }))
          .sort((left, right) =>
            String(left.title ?? "").localeCompare(
              String(right.title ?? ""),
            ),
          );
      }

      if (trackSearchSequence.current[suggestionId] !== requestId) {
        return;
      }

      setTrackHits((current) => ({
        ...current,
        [suggestionId]: hits,
      }));
      setTrackSearchAttempted((current) => ({
        ...current,
        [suggestionId]: true,
      }));
    } catch (reason) {
      if (trackSearchSequence.current[suggestionId] !== requestId) {
        return;
      }
      setError(
        reason instanceof Error
          ? reason.message
          : "Music Registry search failed.",
      );
      setTrackHits((current) => ({
        ...current,
        [suggestionId]: [],
      }));
      setTrackSearchAttempted((current) => ({
        ...current,
        [suggestionId]: true,
      }));
    } finally {
      if (trackSearchSequence.current[suggestionId] === requestId) {
        setTrackSearching((current) => ({
          ...current,
          [suggestionId]: false,
        }));
      }
    }
  }

  function artistCreditKey(
    suggestionId: string,
    creditOrder: number,
  ) {
    return `${suggestionId}:${creditOrder}`;
  }

  function effectiveArtistRole(
    credit: ArtistCredit,
  ): "primary" | "featured" | "" {
    if (
      credit.credit_role ===
        "primary" ||
      credit.credit_role ===
        "featured"
    ) {
      return credit.credit_role;
    }

    return "";
  }

  async function searchRegistryArtists(
    suggestionId: string,
    creditOrder: number,
    value: string,
  ) {
    const key =
      artistCreditKey(
        suggestionId,
        creditOrder,
      );

    const requestId =
      (artistSearchSequence.current[key] ?? 0) + 1;

    artistSearchSequence.current[key] =
      requestId;

    const trimmed =
      value.trim();

    setArtistQuery((current) => ({
      ...current,
      [key]:
        value,
    }));

    setSelectedArtist((current) => ({
      ...current,
      [key]:
        null,
    }));

    if (
      trimmed.length < 2
    ) {
      setArtistHits((current) => ({
        ...current,
        [key]:
          [],
      }));

      setArtistSearchAttempted((current) => ({
        ...current,
        [key]:
          false,
      }));

      return;
    }

    setArtistSearching((current) => ({
      ...current,
      [key]:
        true,
    }));

    setArtistSearchAttempted((current) => ({
      ...current,
      [key]:
        false,
    }));

    setError(
      null,
    );

    try {
      const pattern =
        `%${escapeLike(trimmed)}%`;

      const {
        data,
        error:
          searchError,
      } =
        await supabase
          .from("registry_artists")
          .select(
            "id,display_name,slug,public_image_url,status",
          )
          .eq(
            "status",
            "active",
          )
          .ilike(
            "display_name",
            pattern,
          )
          .order(
            "display_name",
          )
          .limit(
            15,
          );

      if (
        searchError
      ) {
        throw searchError;
      }

      if (
        artistSearchSequence.current[key] !==
        requestId
      ) {
        return;
      }

      setArtistHits((current) => ({
        ...current,
        [key]:
          (data ?? []) as RegistryArtistHit[],
      }));

      setArtistSearchAttempted((current) => ({
        ...current,
        [key]:
          true,
      }));
    } catch (reason) {
      if (
        artistSearchSequence.current[key] !==
        requestId
      ) {
        return;
      }

      setArtistHits((current) => ({
        ...current,
        [key]:
          [],
      }));

      setArtistSearchAttempted((current) => ({
        ...current,
        [key]:
          true,
      }));

      setError(
        reason instanceof Error
          ? reason.message
          : "Artist search failed.",
      );
    } finally {
      if (
        artistSearchSequence.current[key] ===
        requestId
      ) {
        setArtistSearching((current) => ({
          ...current,
          [key]:
            false,
        }));
      }
    }
  }

  async function saveArtistResolution(
    row: IntakeRow,
    credit: ArtistCredit,
    mode: "existing_artist" | "new_artist",
  ) {
    const key =
      artistCreditKey(
        row.suggestion_id,
        credit.credit_order,
      );

    const role =
      artistRole[key] ??
      effectiveArtistRole(
        credit,
      );

    const artist =
      selectedArtist[key] ??
      null;

    if (
      !role
    ) {
      setError(
        "Choose whether this artist is Primary or Featured.",
      );
      return;
    }

    if (
      mode ===
        "existing_artist" &&
      !artist
    ) {
      setError(
        "Select the matching Registry artist first.",
      );
      return;
    }

    setBusy(
      `artist-resolution:${key}`,
    );

    setError(
      null,
    );

    try {
      await untypedRpc(
        "admin_update_registry_track_intake_artist_credit",
        {
          p_suggestion_id:
            row.suggestion_id,
          p_credit_order:
            credit.credit_order,
          p_credit_role:
            role,
          p_resolution_mode:
            mode,
          p_registry_artist_id:
            mode ===
              "existing_artist"
              ? artist?.id ??
                null
              : null,
          p_observed_name:
            credit.observed_name ||
            credit.display_name,
        },
      );

      setSelectedArtist((current) => ({
        ...current,
        [key]:
          null,
      }));

      setArtistHits((current) => ({
        ...current,
        [key]:
          [],
      }));

      setArtistSearchAttempted((current) => ({
        ...current,
        [key]:
          false,
      }));

      await loadQueue();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Artist identity could not be saved.",
      );
    } finally {
      setBusy(
        null,
      );
    }
  }

  async function searchProvider(row: IntakeRow) {
    const suggestionId = row.suggestion_id;
    const provider =
      providerChoice[suggestionId] ?? "apple_music";
    const searchText =
      (
        providerQuery[suggestionId] ??
        [
          row.submitted_track_title,
          row.provider_title,
          ...(row.artist_credits ?? []).map(
            (credit) => credit.display_name,
          ),
        ]
          .filter(Boolean)
          .join(" ")
      ).trim();

    if (searchText.length < 2) {
      setError("Enter at least two characters to search a provider.");
      return;
    }

    setBusy(`provider-search:${suggestionId}`);
    setError(null);

    try {
      const { data, error: invokeError } =
        await supabase.functions.invoke(
          "provider-intake-api",
          {
            body: {
              route: "search",
              provider,
              entityType: "track",
              query: searchText,
              limit: 15,
              storefront: "ke",
            },
          },
        );

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(String(data.error));

      const hits = Array.isArray(data?.groups?.tracks)
        ? data.groups.tracks
        : [];

      setProviderHits((current) => ({
        ...current,
        [suggestionId]: hits,
      }));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Provider enrichment search failed.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function inspectProvider(
    row: IntakeRow,
    hit: ProviderSearchHit,
  ) {
    const suggestionId = row.suggestion_id;

    setBusy(`provider-inspect:${suggestionId}`);
    setError(null);

    try {
      const { data, error: invokeError } =
        await supabase.functions.invoke(
          "provider-intake-api",
          {
            body: {
              route: "inspect",
              provider: hit.provider,
              providerEntityType: "track",
              providerEntityId: hit.providerEntityId,
              storefront: "ke",
            },
          },
        );

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(String(data.error));

      const inspection =
        (data?.result ?? null) as ProviderInspection | null;

      if (!inspection) {
        throw new Error("Provider returned no track evidence.");
      }

      const inspectionFields = {
        ...(inspection.enrichment ?? {}),
        ...(inspection.title?.trim()
          ? { title: inspection.title.trim() }
          : {}),
      };

      await untypedRpc(
        "admin_record_registry_track_intake_provider_evidence",
        {
          p_suggestion_id: suggestionId,
          p_provider: inspection.provider,
          p_provider_entity_id:
            inspection.providerEntityId,
          p_provider_url:
            inspection.providerUrl ?? null,
          p_fields: inspectionFields,
          p_raw_payload: data?.raw ?? {},
          p_confidence:
            Number(inspection.confidenceScore ?? 0.95),
        },
      );

      setProviderInspection((current) => ({
        ...current,
        [suggestionId]: inspection,
      }));

      const usefulFields = Object.fromEntries(
        Object.entries(inspectionFields)
          .filter(([field, value]) =>
            enrichmentFieldOrder.includes(
              field as (typeof enrichmentFieldOrder)[number],
            ) &&
            value !== null &&
            value !== undefined &&
            value !== "",
          ),
      );

      setAcceptedFields((current) => ({
        ...current,
        [suggestionId]: {
          ...(current[suggestionId] ?? {}),
          ...usefulFields,
        },
      }));

      await loadEnrichment(suggestionId);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Provider inspection failed.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function saveEnrichment(row: IntakeRow) {
    const suggestionId = row.suggestion_id;
    const fields = acceptedFields[suggestionId] ?? {};

    setBusy(`enrichment-save:${suggestionId}`);
    setError(null);

    try {
      await untypedRpc(
        "admin_save_registry_track_intake_enrichment",
        {
          p_suggestion_id: suggestionId,
          p_fields: fields,
          p_reason:
            reviewNotes[suggestionId] ||
            "Accepted during Track Intake review.",
        },
      );
      await loadEnrichment(suggestionId);
      setSaveFeedback((current) => ({
        ...current,
        [suggestionId]: true,
      }));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Accepted enrichment could not be saved.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function createCanonicalTrack(row: IntakeRow) {
    const suggestionId = row.suggestion_id;
    const observedTitle =
      preferredObservedTrackTitle(
        suggestionId,
      ) ??
      row.submitted_track_title ??
      row.provider_title;
    const title =
      (
        newCanonicalTitle[suggestionId] ??
        observedTitle ??
        ""
      ).trim();

    if (!title) {
      setError("Confirm the canonical track title first.");
      return;
    }

    if (
      (row.artist_credits ?? []).length === 0 ||
      (row.artist_credits ?? []).some(
        (credit) =>
          credit.resolution_mode !== "existing_artist" ||
          !credit.registry_artist_id,
      )
    ) {
      setError(
        "Resolve every artist credit to an existing Registry artist before creating the canonical track.",
      );
      return;
    }

    setBusy(`canonical-create:${suggestionId}`);
    setError(null);

    try {
      await untypedRpc(
        "admin_create_registry_track_from_intake_enriched",
        {
          p_suggestion_id: suggestionId,
          p_title: title,
          p_review_note:
            reviewNotes[suggestionId] || null,
        },
      );

      await loadQueue();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Canonical Registry track could not be created.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function resolve(row: IntakeRow) {
    const registryTrackId =
      row.canonical_track_id ??
      selectedTrack[row.suggestion_id]?.id ??
      null;

    if (!registryTrackId) return;

    setBusy(row.suggestion_id);
    setError(null);

    try {
      await untypedRpc(
        "admin_resolve_registry_track_intake_enriched",
        {
          p_suggestion_id: row.suggestion_id,
          p_registry_track_id: registryTrackId,
          p_review_note:
            reviewNotes[row.suggestion_id] || null,
          p_allow_overwrite:
            allowOverwrite[row.suggestion_id] === true,
        },
      );

      await loadQueue();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Track Intake resolution failed.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function reject(row: IntakeRow) {
    const note =
      (reviewNotes[row.suggestion_id] ?? "").trim();

    if (!note) {
      setError("Add a rejection reason first.");
      return;
    }

    setBusy(row.suggestion_id);
    setError(null);

    try {
      await untypedRpc(
        "admin_reject_registry_track_intake",
        {
          p_suggestion_id: row.suggestion_id,
          p_review_note: note,
        },
      );

      await loadQueue();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Track Intake rejection failed.",
      );
    } finally {
      setBusy(null);
    }
  }

  function preferredObservedTrackTitle(
    suggestionId: string,
  ) {
    const observations =
      enrichment[suggestionId]?.observations
        ?.filter(
          (entry) =>
            entry.field_name === "title" &&
            entry.field_value.trim().length > 0,
        )
        .sort((left, right) => {
          const providerPriority = (provider: string) =>
            provider === "apple_music"
              ? 0
              : provider === "spotify"
                ? 1
                : 2;

          const providerDifference =
            providerPriority(left.provider) -
            providerPriority(right.provider);

          if (providerDifference !== 0) {
            return providerDifference;
          }

          return (
            new Date(right.created_at).getTime() -
            new Date(left.created_at).getTime()
          );
        }) ?? [];

    return observations[0]?.field_value ?? null;
  }

  function latestObservation(
    suggestionId: string,
    field: string,
  ) {
    return (
      enrichment[suggestionId]?.observations
        ?.filter((entry) => entry.field_name === field)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime(),
        )[0] ?? null
    );
  }

  return (
    <div className="min-h-screen bg-wk-bg px-5 py-6 text-wk-text">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-wk-brand">
              Music Registry
            </p>
            <h1 className="text-3xl font-black tracking-tight">
              Track Intake
            </h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-wk-text-muted">
              Resolve identity and enrich the Registry record before
              canonicalization. Provider evidence can contribute ISRC,
              duration, artwork, release date, label, imprint, genre,
              preview and other metadata. Nothing becomes canonical
              simply because a provider returned it.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="/admin/registry/tracks"
              className="wk-button wk-button-ghost"
            >
              <WkIcon name="Music" size={15} />
              Registry tracks
            </a>
            <button
              onClick={() => void loadQueue()}
              className="wk-button wk-button-ghost"
            >
              <WkIcon name="RefreshCcw" size={15} />
              Refresh
            </button>
          </div>
        </header>

        {error ? (
          <div className="mb-4 rounded-xl border border-wk-danger/20 bg-wk-danger-soft p-4 text-sm font-semibold text-wk-danger">
            {error}
          </div>
        ) : null}

        {!deepSuggestion && !deepPlaylistItem ? (
          <section className="mb-5 grid gap-3 lg:grid-cols-[1fr_220px]">
            <div className="flex items-center gap-2 rounded-xl border border-wk-border bg-wk-surface px-3">
              <WkIcon
                name="Search"
                size={15}
                className="text-wk-text-faint"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, artist, provider or Playlist"
                className="h-11 w-full bg-transparent text-sm outline-none"
              />
            </div>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-11 rounded-xl border border-wk-border bg-wk-surface px-3 text-sm outline-none"
            >
              <option value="needs_review">Needs review</option>
              <option value="rejected">Rejected</option>
              <option value="canonicalized">Canonicalized</option>
              <option value="all">All</option>
            </select>
          </section>
        ) : (
          <div className="mb-5 flex items-center justify-between rounded-xl border border-wk-brand/20 bg-wk-brand-soft p-3 text-sm">
            <span>Opened from a specific Playlist track.</span>
            <a
              href="/admin/registry/tracks/intake"
              className="font-bold text-wk-brand"
            >
              View full queue
            </a>
          </div>
        )}

        <div className="mb-4 flex items-center justify-between text-sm text-wk-text-muted">
          <span>
            {queue.total} intake item
            {queue.total === 1 ? "" : "s"}
          </span>
          <span>
            {deepSuggestion || deepPlaylistItem
              ? `${filtered.length} shown`
              : `Showing ${visibleStart}-${visibleEnd} of ${filtered.length}`}
          </span>
        </div>

        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-wk-border bg-wk-surface">
            <WkIcon
              name="Loader2"
              size={28}
              className="animate-spin text-wk-brand"
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-wk-border bg-wk-surface px-6 py-16 text-center">
            <WkIcon
              name="Inbox"
              size={28}
              className="mx-auto text-wk-text-faint"
            />
            <h2 className="mt-3 text-lg font-black">
              Nothing waiting here
            </h2>
            <p className="mt-1 text-sm text-wk-text-muted">
              Track Intake items appear when Playlist editors or
              Community suggestions send music to the Registry for review.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {visible.map((row) => {
              const suggestionId = row.suggestion_id;
              const chosenProvider =
                providerChoice[suggestionId] ?? "apple_music";
              const inspection =
                providerInspection[suggestionId] ?? null;
              const accepted =
                acceptedFields[suggestionId] ?? {};
              const persistedAccepted =
                enrichment[suggestionId]?.accepted ?? {};
              const persistedCount =
                Object.keys(persistedAccepted).length;
              const hasUnsavedEnrichment =
                !acceptedFieldsEqual(
                  accepted,
                  persistedAccepted,
                );
              const savingEnrichment =
                busy ===
                `enrichment-save:${suggestionId}`;
              const allArtistCreditsResolved =
                (row.artist_credits ?? []).length > 0 &&
                (row.artist_credits ?? []).every(
                  (credit) =>
                    credit.resolution_mode ===
                      "existing_artist" &&
                    Boolean(credit.registry_artist_id),
                );
              const observedCanonicalTitle =
                preferredObservedTrackTitle(
                  suggestionId,
                ) ??
                row.submitted_track_title ??
                row.provider_title;
              const canonicalTitle =
                newCanonicalTitle[suggestionId] ??
                observedCanonicalTitle ??
                "";

              const isPublicContribution =
                row.intake_origin ===
                "public_contribution";

              const contributionDetails =
                typeof row.contribution_payload?.details ===
                  "string"
                  ? row.contribution_payload.details.trim()
                  : "";

              const displayTrackTitle =
                row.submitted_track_title ??
                row.provider_title ??
                "Untitled track";

              return (
                <article
                  key={suggestionId}
                  className="rounded-2xl border border-wk-border bg-wk-surface p-5"
                >
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px]">
                    <div className="min-w-0 space-y-5">
                      <div className="flex items-start gap-4">
                        {row.artwork_url ? (
                          <img
                            src={row.artwork_url}
                            alt=""
                            className="h-20 w-20 shrink-0 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-wk-surface-raised">
                            <WkIcon
                              name="Music"
                              size={24}
                              className="text-wk-text-faint"
                            />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-wk-warning-soft px-2 py-1 text-[9px] font-black uppercase text-wk-warning">
                              {humanize(row.status)}
                            </span>
                            {isPublicContribution ? (
                              <span className="rounded-full bg-wk-brand-soft px-2 py-1 text-[9px] font-black uppercase text-wk-brand">
                                Community suggestion
                              </span>
                            ) : null}

                            {row.provider_key ? (
                              <span className="rounded-full bg-wk-surface-raised px-2 py-1 text-[9px] font-bold uppercase text-wk-text-muted">
                                {humanize(row.provider_key)}
                              </span>
                            ) : null}

                            {row.playback_kind ? (
                              <span className="rounded-full bg-wk-surface-raised px-2 py-1 text-[9px] font-bold uppercase text-wk-text-muted">
                                {row.playback_kind}
                              </span>
                            ) : null}
                          </div>

                          <h2 className="mt-2 text-xl font-black">
                            {displayTrackTitle}
                          </h2>

                          {isPublicContribution &&
                          row.provider_title &&
                          row.provider_title !==
                            row.submitted_track_title ? (
                            <p className="mt-1 text-xs text-wk-text-muted">
                              Provider observed: {row.provider_title}
                            </p>
                          ) : null}

                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-wk-text-muted">
                            {(row.artist_credits ?? []).map(
                              (credit) => (
                                <span
                                  key={`${suggestionId}:${credit.credit_order}`}
                                >
                                  <strong className="text-wk-text">
                                    {credit.display_name}
                                  </strong>{" "}
                                  {humanize(credit.credit_role)}
                                </span>
                              ),
                            )}
                          </div>

                          {row.provider_release_title ? (
                            <p className="mt-2 text-sm text-wk-text-muted">
                              {row.provider_release_title}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {isPublicContribution ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl bg-wk-surface-raised p-3">
                            <div className="text-[10px] font-black uppercase tracking-wide text-wk-text-faint">
                              Suggested for Playlist
                            </div>

                            <a
                              href={`/admin/content/playlists/${row.playlist_id}`}
                              className="mt-1 block font-bold text-wk-brand"
                            >
                              {row.playlist_title || "Open Playlist"}
                            </a>

                            <div className="mt-2 text-xs text-wk-text-muted">
                              Submitted by{" "}
                              <strong className="text-wk-text">
                                {row.requested_by_name ||
                                  "WAKILISHA contributor"}
                              </strong>
                            </div>

                            <div className="mt-1 text-[10px] text-wk-text-faint">
                              {new Date(row.created_at).toLocaleString()}
                            </div>
                          </div>

                          <div className="rounded-xl bg-wk-surface-raised p-3">
                            <div className="text-[10px] font-black uppercase tracking-wide text-wk-text-faint">
                              Contributor context
                            </div>

                            <div className="mt-1 text-sm leading-6 text-wk-text">
                              {contributionDetails ||
                                "No additional context supplied."}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl bg-wk-surface-raised p-3">
                            <div className="text-[10px] font-black uppercase tracking-wide text-wk-text-faint">
                              Originating Playlist
                            </div>
                            <a
                              href={`/admin/content/playlists/${row.playlist_id}`}
                              className="mt-1 block font-bold text-wk-brand"
                            >
                              {row.playlist_title || "Open Playlist"}
                            </a>
                            <div className="mt-1 text-xs text-wk-text-muted">
                              Track position{" "}
                              {row.playlist_position ?? "Not set"}
                            </div>
                          </div>

                          <div className="rounded-xl bg-wk-surface-raised p-3">
                            <div className="text-[10px] font-black uppercase tracking-wide text-wk-text-faint">
                              Playlist curator note
                            </div>
                            <div className="mt-1 text-sm text-wk-text">
                              {row.playlist_note ||
                                "No curator note"}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="rounded-xl border border-wk-border p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-black">
                              Provider enrichment
                            </div>
                            <p className="mt-1 max-w-2xl text-xs leading-5 text-wk-text-muted">
                              Search independent provider catalogs to
                              fill Registry gaps. Evidence is staged
                              first. You decide which fields are
                              accepted for canonicalization.
                            </p>
                          </div>

                          <button
                            onClick={() =>
                              void loadEnrichment(suggestionId)
                            }
                            className="wk-button wk-button-ghost wk-button-sm"
                          >
                            <WkIcon name="Database" size={13} />
                            Load evidence
                          </button>
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-[150px_1fr_auto]">
                          <select
                            value={chosenProvider}
                            onChange={(event) =>
                              setProviderChoice((current) => ({
                                ...current,
                                [suggestionId]:
                                  event.target.value as ProviderKey,
                              }))
                            }
                            className="h-10 rounded-lg border border-wk-border bg-wk-bg px-3 text-xs outline-none"
                          >
                            <option value="apple_music">
                              Apple Music
                            </option>
                            <option value="spotify">
                              Spotify
                            </option>
                          </select>

                          <input
                            value={
                              providerQuery[suggestionId] ??
                              [
                                row.provider_title,
                                ...(row.artist_credits ?? []).map(
                                  (credit) =>
                                    credit.display_name,
                                ),
                              ]
                                .filter(Boolean)
                                .join(" ")
                            }
                            onChange={(event) =>
                              setProviderQuery((current) => ({
                                ...current,
                                [suggestionId]:
                                  event.target.value,
                              }))
                            }
                            className="h-10 rounded-lg border border-wk-border bg-wk-bg px-3 text-xs outline-none"
                            placeholder="Search provider catalog"
                          />

                          <button
                            onClick={() =>
                              void searchProvider(row)
                            }
                            disabled={busy !== null}
                            className="wk-button wk-button-ghost wk-button-sm disabled:opacity-40"
                          >
                            <WkIcon name="Search" size={13} />
                            Search
                          </button>
                        </div>

                        {(providerHits[suggestionId] ?? []).length >
                        0 ? (
                          <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-wk-border bg-wk-bg p-1.5">
                            {(providerHits[suggestionId] ?? []).map(
                              (hit) => (
                                <button
                                  key={`${hit.provider}:${hit.providerEntityId}`}
                                  onClick={() =>
                                    void inspectProvider(row, hit)
                                  }
                                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-wk-surface-raised"
                                >
                                  {hit.artworkUrl ? (
                                    <img
                                      src={hit.artworkUrl}
                                      alt=""
                                      className="h-10 w-10 rounded-lg object-cover"
                                    />
                                  ) : (
                                    <div className="h-10 w-10 rounded-lg bg-wk-surface-raised" />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-xs font-bold">
                                      {hit.title}
                                    </div>
                                    <div className="truncate text-[10px] text-wk-text-muted">
                                      {hit.artistDisplayName ||
                                        "Artist unavailable"}
                                    </div>
                                  </div>
                                  <span className="text-[9px] font-black uppercase text-wk-brand">
                                    Inspect
                                  </span>
                                </button>
                              ),
                            )}
                          </div>
                        ) : null}

                        {inspection ? (
                          <div className="mt-4">
                            <div className="mb-2 flex items-center justify-between">
                              <div className="text-[11px] font-black uppercase tracking-wide text-wk-text-faint">
                                Latest provider evidence
                              </div>
                              <span className="rounded-full bg-wk-brand-soft px-2 py-1 text-[9px] font-black uppercase text-wk-brand">
                                {humanize(inspection.provider)}
                              </span>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2">
                              {enrichmentFieldOrder.map(
                                (field) => {
                                  const value =
                                    inspection.enrichment?.[
                                      field
                                    ];
                                  if (
                                    value === null ||
                                    value === undefined ||
                                    value === ""
                                  ) {
                                    return null;
                                  }

                                  const checked =
                                    Object.prototype.hasOwnProperty.call(
                                      accepted,
                                      field,
                                    );

                                  return (
                                    <label
                                      key={field}
                                      className="flex gap-3 rounded-lg border border-wk-border bg-wk-bg p-3"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(event) =>
                                          setAcceptedFields(
                                            (current) => {
                                              const next = {
                                                ...(current[
                                                  suggestionId
                                                ] ?? {}),
                                              };

                                              if (
                                                event.target.checked
                                              ) {
                                                next[field] =
                                                  value;
                                              } else {
                                                delete next[
                                                  field
                                                ];
                                              }

                                              return {
                                                ...current,
                                                [suggestionId]:
                                                  next,
                                              };
                                            },
                                          )
                                        }
                                      />

                                      <div className="min-w-0">
                                        <div className="text-[9px] font-black uppercase tracking-wide text-wk-text-faint">
                                          {humanize(field)}
                                        </div>
                                        <div className="mt-1 break-words text-xs font-semibold text-wk-text">
                                          {fieldDisplay(
                                            field,
                                            value,
                                          )}
                                        </div>
                                      </div>
                                    </label>
                                  );
                                },
                              )}
                            </div>
                          </div>
                        ) : null}

                        {enrichment[suggestionId] ? (
                          <div className="mt-4 rounded-xl bg-wk-bg p-3">
                            <div className="text-[10px] font-black uppercase tracking-wide text-wk-text-faint">
                              Evidence already staged
                            </div>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              {enrichmentFieldOrder.map(
                                (field) => {
                                  const observation =
                                    latestObservation(
                                      suggestionId,
                                      field,
                                    );
                                  if (!observation) return null;

                                  return (
                                    <div
                                      key={field}
                                      className="rounded-lg bg-wk-surface p-2"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[9px] font-black uppercase text-wk-text-faint">
                                          {humanize(field)}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          {Object.prototype.hasOwnProperty.call(
                                            persistedAccepted,
                                            field,
                                          ) ? (
                                            <span className="text-[8px] font-black uppercase text-wk-brand">
                                              Accepted
                                            </span>
                                          ) : null}
                                          <span className="text-[8px] font-bold uppercase text-wk-text-faint">
                                            {humanize(
                                              observation.provider,
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="mt-1 break-words text-[11px] text-wk-text">
                                        {fieldDisplay(
                                          field,
                                          observation.field_value,
                                        )}
                                      </div>
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          </div>
                        ) : null}

                        {persistedCount > 0 ? (
                          <div className="mt-4 rounded-xl border border-wk-brand/20 bg-wk-brand-soft p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <WkIcon
                                  name="CheckCircle2"
                                  size={15}
                                  className="text-wk-brand"
                                />
                                <span className="text-xs font-black text-wk-text">
                                  Accepted enrichment saved
                                </span>
                              </div>
                              <span className="rounded-full bg-wk-surface px-2 py-1 text-[9px] font-black uppercase text-wk-brand">
                                {persistedCount} saved field
                                {persistedCount === 1 ? "" : "s"}
                              </span>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-wk-text-muted">
                              These decisions are saved for canonicalization.
                              Resolving Registry identity is a separate step.
                            </p>
                            {hasUnsavedEnrichment ? (
                              <p className="mt-2 text-[10px] font-bold text-wk-warning">
                                You have unsaved enrichment changes.
                              </p>
                            ) : saveFeedback[suggestionId] ? (
                              <p className="mt-2 text-[10px] font-bold text-wk-brand">
                                Saved just now.
                              </p>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={() =>
                              void saveEnrichment(row)
                            }
                            disabled={
                              busy !== null ||
                              !hasUnsavedEnrichment
                            }
                            className="wk-button wk-button-primary wk-button-sm disabled:opacity-40"
                          >
                            {savingEnrichment ? (
                              <>
                                <WkIcon
                                  name="Loader2"
                                  size={13}
                                  className="animate-spin"
                                />
                                Saving...
                              </>
                            ) : !hasUnsavedEnrichment &&
                              persistedCount > 0 ? (
                              <>
                                <WkIcon
                                  name="CheckCircle2"
                                  size={13}
                                />
                                Saved {persistedCount} fields
                              </>
                            ) : (
                              <>
                                <WkIcon name="Save" size={13} />
                                {persistedCount > 0
                                  ? "Save enrichment changes"
                                  : "Save accepted enrichment"}
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {row.provider_url ? (
                          <a
                            href={row.provider_url}
                            target="_blank"
                            rel="noreferrer"
                            className="wk-button wk-button-ghost wk-button-sm"
                          >
                            <WkIcon
                              name="ExternalLink"
                              size={14}
                            />
                            Open provider evidence
                          </a>
                        ) : null}
                        <a
                          href={`/admin/content/playlists/${row.playlist_id}`}
                          className="wk-button wk-button-ghost wk-button-sm"
                        >
                          <WkIcon name="ArrowLeft" size={14} />
                          Back to Playlist
                        </a>
                      </div>
                    </div>

                    <div className="rounded-xl border border-wk-border bg-wk-surface-raised p-4">
                      {row.status === "needs_review" ? (
                        <>
                          <div className="mb-4 rounded-xl border border-wk-border bg-wk-surface p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <div className="text-sm font-black">
                                  Artist identity review
                                </div>
                                <p className="mt-1 text-xs leading-5 text-wk-text-muted">
                                  Match every submitted artist to Registry identity and confirm the credit role. Mark genuinely new artists for follow-up instead of forcing a merge.
                                </p>
                              </div>

                              <a
                                href="/admin/registry/artists"
                                target="_blank"
                                rel="noreferrer"
                                className="wk-button wk-button-ghost wk-button-sm"
                              >
                                <WkIcon
                                  name="Users"
                                  size={13}
                                />
                                Artist Registry
                              </a>
                            </div>

                            <div className="mt-3 space-y-3">
                              {(row.artist_credits ?? []).map(
                                (credit) => {
                                  const key =
                                    artistCreditKey(
                                      suggestionId,
                                      credit.credit_order,
                                    );

                                  const role =
                                    artistRole[key] ??
                                    effectiveArtistRole(
                                      credit,
                                    );

                                  const queryValue =
                                    artistQuery[key] ??
                                    credit.display_name ??
                                    credit.observed_name ??
                                    "";

                                  const hits =
                                    artistHits[key] ??
                                    [];

                                  const selected =
                                    selectedArtist[key] ??
                                    null;

                                  const savingArtist =
                                    busy ===
                                    `artist-resolution:${key}`;

                                  return (
                                    <div
                                      key={`${suggestionId}:artist-review:${credit.credit_order}`}
                                      className="rounded-lg border border-wk-border bg-wk-bg p-3"
                                    >
                                      <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                          <div className="text-[10px] font-black uppercase tracking-wide text-wk-text-faint">
                                            Submitted artist {credit.credit_order}
                                          </div>

                                          <div className="mt-1 text-sm font-black text-wk-text">
                                            {credit.display_name ||
                                              credit.observed_name ||
                                              "Unnamed artist"}
                                          </div>
                                        </div>

                                        <span
                                          className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${
                                            credit.resolution_mode ===
                                              "existing_artist"
                                              ? "bg-wk-brand-soft text-wk-brand"
                                              : credit.resolution_mode ===
                                                  "new_artist"
                                                ? "bg-wk-warning-soft text-wk-warning"
                                                : "bg-wk-surface-raised text-wk-text-muted"
                                          }`}
                                        >
                                          {credit.resolution_mode ===
                                          "existing_artist"
                                            ? "Registry artist resolved"
                                            : credit.resolution_mode ===
                                                "new_artist"
                                              ? "New artist follow-up"
                                              : "Identity unresolved"}
                                        </span>
                                      </div>

                                      <div className="mt-3 grid gap-2 sm:grid-cols-[130px_minmax(0,1fr)_auto]">
                                        <select
                                          value={role}
                                          onChange={(event) =>
                                            setArtistRole(
                                              (current) => ({
                                                ...current,
                                                [key]:
                                                  event.target.value as
                                                    | "primary"
                                                    | "featured",
                                              }),
                                            )
                                          }
                                          className="h-10 rounded-lg border border-wk-border bg-wk-surface px-3 text-xs outline-none focus:border-wk-brand"
                                        >
                                          <option value="">
                                            Choose role
                                          </option>
                                          <option value="primary">
                                            Primary
                                          </option>
                                          <option value="featured">
                                            Featured
                                          </option>
                                        </select>

                                        <input
                                          value={queryValue}
                                          onChange={(event) => {
                                            setArtistQuery(
                                              (current) => ({
                                                ...current,
                                                [key]:
                                                  event.target.value,
                                              }),
                                            );

                                            setSelectedArtist(
                                              (current) => ({
                                                ...current,
                                                [key]:
                                                  null,
                                              }),
                                            );
                                          }}
                                          onKeyDown={(event) => {
                                            if (
                                              event.key ===
                                              "Enter"
                                            ) {
                                              event.preventDefault();
                                              void searchRegistryArtists(
                                                suggestionId,
                                                credit.credit_order,
                                                queryValue,
                                              );
                                            }
                                          }}
                                          placeholder="Search Registry artist"
                                          className="h-10 min-w-0 rounded-lg border border-wk-border bg-wk-surface px-3 text-xs outline-none focus:border-wk-brand"
                                        />

                                        <button
                                          type="button"
                                          onClick={() =>
                                            void searchRegistryArtists(
                                              suggestionId,
                                              credit.credit_order,
                                              queryValue,
                                            )
                                          }
                                          disabled={
                                            busy !== null ||
                                            queryValue.trim().length <
                                              2
                                          }
                                          className="wk-button wk-button-ghost wk-button-sm disabled:opacity-40"
                                        >
                                          <WkIcon
                                            name="Search"
                                            size={13}
                                          />
                                          Search
                                        </button>
                                      </div>

                                      {artistSearching[key] ? (
                                        <div className="mt-2 flex items-center gap-2 text-xs text-wk-text-muted">
                                          <WkIcon
                                            name="Loader2"
                                            size={13}
                                            className="animate-spin"
                                          />
                                          Searching Artist Registry...
                                        </div>
                                      ) : null}

                                      {hits.length > 0 ? (
                                        <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-wk-border bg-wk-surface p-1">
                                          {hits.map(
                                            (artist) => (
                                              <button
                                                key={artist.id}
                                                type="button"
                                                onClick={() =>
                                                  setSelectedArtist(
                                                    (current) => ({
                                                      ...current,
                                                      [key]:
                                                        artist,
                                                    }),
                                                  )
                                                }
                                                className={`flex w-full items-center gap-3 rounded-lg p-2 text-left ${
                                                  selected?.id ===
                                                  artist.id
                                                    ? "bg-wk-brand-soft"
                                                    : "hover:bg-wk-surface-raised"
                                                }`}
                                              >
                                                {artist.public_image_url ? (
                                                  <img
                                                    src={
                                                      artist.public_image_url
                                                    }
                                                    alt=""
                                                    className="h-9 w-9 rounded-full object-cover"
                                                  />
                                                ) : (
                                                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-wk-surface-raised">
                                                    <WkIcon
                                                      name="Mic2"
                                                      size={14}
                                                      className="text-wk-text-faint"
                                                    />
                                                  </div>
                                                )}

                                                <div className="min-w-0 flex-1">
                                                  <div className="truncate text-xs font-bold text-wk-text">
                                                    {artist.display_name}
                                                  </div>
                                                  <div className="truncate text-[10px] text-wk-text-faint">
                                                    {artist.slug ||
                                                      artist.id}
                                                  </div>
                                                </div>

                                                {selected?.id ===
                                                artist.id ? (
                                                  <WkIcon
                                                    name="Check"
                                                    size={14}
                                                    className="text-wk-brand"
                                                  />
                                                ) : null}
                                              </button>
                                            ),
                                          )}
                                        </div>
                                      ) : null}

                                      {!artistSearching[key] &&
                                      artistSearchAttempted[key] &&
                                      hits.length === 0 ? (
                                        <div className="mt-2 rounded-lg border border-wk-warning/20 bg-wk-warning-soft p-2 text-xs leading-5 text-wk-warning">
                                          No active Registry artist matched this search. Mark this as a new artist only after checking aliases and likely spelling variants.
                                        </div>
                                      ) : null}

                                      {selected ? (
                                        <div className="mt-2 rounded-lg border border-wk-brand/20 bg-wk-brand-soft p-2 text-xs">
                                          Selected{" "}
                                          <strong>
                                            {selected.display_name}
                                          </strong>
                                        </div>
                                      ) : null}

                                      <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void saveArtistResolution(
                                              row,
                                              credit,
                                              "existing_artist",
                                            )
                                          }
                                          disabled={
                                            busy !== null ||
                                            !selected ||
                                            !role
                                          }
                                          className="wk-button wk-button-primary wk-button-sm disabled:opacity-40"
                                        >
                                          {savingArtist ? (
                                            <WkIcon
                                              name="Loader2"
                                              size={13}
                                              className="animate-spin"
                                            />
                                          ) : (
                                            <WkIcon
                                              name="Check"
                                              size={13}
                                            />
                                          )}
                                          Resolve artist
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            void saveArtistResolution(
                                              row,
                                              credit,
                                              "new_artist",
                                            )
                                          }
                                          disabled={
                                            busy !== null ||
                                            !role
                                          }
                                          className="wk-button wk-button-ghost wk-button-sm disabled:opacity-40"
                                        >
                                          <WkIcon
                                            name="UserPlus"
                                            size={13}
                                          />
                                          Mark as new artist
                                        </button>
                                      </div>

                                      {credit.resolution_mode ===
                                      "new_artist" ? (
                                        <p className="mt-2 text-[10px] leading-4 text-wk-warning">
                                          Create or review this artist in the Artist Registry, then return here and resolve this credit to the canonical artist before creating the track.
                                        </p>
                                      ) : null}
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          </div>

                          <div className="text-sm font-black">
                            Canonical Registry identity
                          </div>
                          <p className="mt-1 text-xs leading-5 text-wk-text-muted">
                            Resolve the intake item to the canonical
                            Music Registry track after identity and
                            enrichment evidence are reviewed.
                          </p>

                          {row.canonical_track_id ? (
                            <div className="mt-3 rounded-xl border border-wk-brand/20 bg-wk-brand-soft p-3">
                              <div className="flex items-center gap-2">
                                <WkIcon
                                  name="CheckCircle2"
                                  size={15}
                                  className="text-wk-brand"
                                />
                                <span className="text-[10px] font-black uppercase tracking-wide text-wk-brand">
                                  Identity already matched
                                </span>
                              </div>
                              <div className="mt-2 text-sm font-bold text-wk-text">
                                {row.canonical_track_title ||
                                  row.submitted_track_title ||
                                  row.provider_title ||
                                  row.canonical_track_id}
                              </div>
                              <p className="mt-1 text-xs leading-5 text-wk-text-muted">
                                This queue item still needs Registry enrichment review,
                                but its canonical track identity is already resolved.
                                Enrichment cannot silently remap it to another track.
                              </p>
                            </div>
                          ) : (
                            <>
                          <div className="mt-3 flex items-center gap-2 rounded-lg border border-wk-border bg-wk-surface px-3">
                            <WkIcon
                              name="Search"
                              size={14}
                              className="text-wk-text-faint"
                            />
                            <input
                              value={
                                trackQuery[suggestionId] ??
                                row.submitted_track_title ??
                                row.provider_title ??
                                ""
                              }
                              onChange={(event) =>
                                void searchTracks(
                                  suggestionId,
                                  event.target.value,
                                )
                              }
                              placeholder="Search by track, artist, or ISRC"
                              className="h-10 w-full bg-transparent text-sm outline-none"
                            />
                          </div>

                          {trackSearching[suggestionId] ? (
                            <div className="mt-2 flex items-center gap-2 text-xs text-wk-text-muted">
                              <WkIcon name="Loader2" size={13} className="animate-spin" />
                              Searching Music Registry...
                            </div>
                          ) : null}

                          {(trackHits[suggestionId] ?? []).length >
                          0 ? (
                            <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-wk-border bg-wk-surface p-1">
                              {(trackHits[suggestionId] ?? []).map(
                                (track) => (
                                  <button
                                    key={track.id}
                                    onClick={() =>
                                      setSelectedTrack(
                                        (current) => ({
                                          ...current,
                                          [suggestionId]: track,
                                        }),
                                      )
                                    }
                                    className={`flex w-full items-center gap-3 rounded-lg p-2 text-left ${
                                      selectedTrack[
                                        suggestionId
                                      ]?.id === track.id
                                        ? "bg-wk-brand-soft"
                                        : "hover:bg-wk-surface-raised"
                                    }`}
                                  >
                                    {track.artwork_url ? (
                                      <img
                                        src={track.artwork_url}
                                        alt=""
                                        className="h-10 w-10 rounded-lg object-cover"
                                      />
                                    ) : (
                                      <div className="h-10 w-10 rounded-lg bg-wk-surface-raised" />
                                    )}
                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-bold">
                                        {track.title ||
                                          track.slug ||
                                          track.id}
                                      </div>
                                      {track.artist_names.length > 0 ? (
                                        <div className="truncate text-xs text-wk-text-muted">
                                          {track.artist_names.join(", ")}
                                        </div>
                                      ) : null}
                                      <div className="text-[10px] uppercase text-wk-text-faint">
                                        {track.isrc ||
                                          track.status}
                                      </div>
                                    </div>
                                  </button>
                                ),
                              )}
                            </div>
                          ) : null}

                          {!trackSearching[suggestionId] &&
                          trackSearchAttempted[suggestionId] &&
                          (trackHits[suggestionId] ?? []).length === 0 ? (
                            <div className="mt-2 rounded-lg border border-wk-border bg-wk-surface-raised p-3">
                              <div className="text-xs font-bold text-wk-text">
                                No active Registry track matches this search.
                              </div>
                              <p className="mt-1 text-xs leading-5 text-wk-text-muted">
                                Search by track title, artist, or ISRC. If this is genuinely new, create its canonical track from the reviewed intake evidence.
                              </p>

                              {allArtistCreditsResolved ? (
                                <div className="mt-3 rounded-lg border border-wk-brand/20 bg-wk-brand-soft p-3">
                                  <div className="text-xs font-black text-wk-text">
                                    Create canonical Registry track
                                  </div>
                                  <p className="mt-1 text-xs leading-5 text-wk-text-muted">
                                    This uses only the existing Registry artist identities already reviewed for this intake. It does not create new artists, releases, or labels.
                                  </p>
                                  <label className="mt-3 block">
                                    <span className="text-[10px] font-black uppercase text-wk-text-muted">
                                      Canonical track title
                                    </span>
                                    <input
                                      value={canonicalTitle}
                                      onChange={(event) =>
                                        setNewCanonicalTitle(
                                          (current) => ({
                                            ...current,
                                            [suggestionId]:
                                              event.target.value,
                                          }),
                                        )
                                      }
                                      placeholder="Confirm canonical track title"
                                      className="mt-1 w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-sm outline-none focus:border-wk-brand"
                                    />
                                  </label>
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {(row.artist_credits ?? []).map(
                                      (credit) => (
                                        <span
                                          key={`${suggestionId}:canonical-artist:${credit.credit_order}`}
                                          className="rounded-full bg-wk-surface px-2 py-1 text-[9px] font-bold text-wk-text-muted"
                                        >
                                          {credit.display_name}
                                        </span>
                                      ),
                                    )}
                                  </div>
                                  {hasUnsavedEnrichment ? (
                                    <p className="mt-2 text-[10px] font-bold text-wk-warning">
                                      Save enrichment changes before creating the canonical track.
                                    </p>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void createCanonicalTrack(
                                        row,
                                      )
                                    }
                                    disabled={
                                      busy !== null ||
                                      !canonicalTitle.trim() ||
                                      hasUnsavedEnrichment
                                    }
                                    className="wk-button wk-button-primary wk-button-sm mt-3 disabled:opacity-40"
                                  >
                                    {busy ===
                                    `canonical-create:${suggestionId}` ? (
                                      <>
                                        <WkIcon
                                          name="Loader2"
                                          size={13}
                                          className="animate-spin"
                                        />
                                        Creating...
                                      </>
                                    ) : (
                                      <>
                                        <WkIcon
                                          name="Plus"
                                          size={13}
                                        />
                                        Create canonical track + resolve
                                      </>
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <p className="mt-3 rounded-lg border border-wk-warning/20 bg-wk-warning-soft p-3 text-xs leading-5 text-wk-warning">
                                  Resolve every artist credit to an existing Registry artist before creating a canonical track.
                                </p>
                              )}
                            </div>
                          ) : null}
                            </>
                          )}

                          <textarea
                            value={
                              reviewNotes[suggestionId] ?? ""
                            }
                            onChange={(event) =>
                              setReviewNotes((current) => ({
                                ...current,
                                [suggestionId]:
                                  event.target.value,
                              }))
                            }
                            placeholder="Registry review note. Required when rejecting."
                            className="mt-3 min-h-[90px] w-full resize-y rounded-lg border border-wk-border bg-wk-surface p-3 text-sm outline-none focus:border-wk-brand"
                          />

                          <label className="mt-3 flex items-start gap-2 rounded-lg border border-wk-warning/20 bg-wk-warning-soft p-3 text-[10px] leading-4 text-wk-warning">
                            <input
                              type="checkbox"
                              checked={
                                allowOverwrite[
                                  suggestionId
                                ] === true
                              }
                              onChange={(event) =>
                                setAllowOverwrite(
                                  (current) => ({
                                    ...current,
                                    [suggestionId]:
                                      event.target.checked,
                                  }),
                                )
                              }
                            />
                            <span>
                              Allow accepted enrichment to replace
                              conflicting canonical values. Leave this
                              off unless you have reviewed the conflict.
                            </span>
                          </label>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              onClick={() => void resolve(row)}
                              disabled={
                                busy !== null ||
                                (
                                  !row.canonical_track_id &&
                                  !selectedTrack[suggestionId]
                                )
                              }
                              className="wk-button wk-button-primary disabled:opacity-40"
                            >
                              <WkIcon name="Check" size={14} />
                              {row.canonical_track_id
                                ? "Apply enrichment to matched track"
                                : "Resolve + apply enrichment"}
                            </button>

                            <button
                              onClick={() => void reject(row)}
                              disabled={busy !== null}
                              className="wk-button wk-button-ghost disabled:opacity-40"
                            >
                              <WkIcon name="X" size={14} />
                              Reject intake
                            </button>
                          </div>
                        </>
                      ) : (
                        <div>
                          <div className="text-sm font-black">
                            Review completed
                          </div>
                          <p className="mt-2 text-sm text-wk-text-muted">
                            {row.status === "canonicalized"
                              ? `Resolved to ${
                                  row.canonicalized_track_title ||
                                  "a canonical Registry track"
                                }.`
                              : row.review_note ||
                                "This intake item was rejected."}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}

            {!deepSuggestion &&
            !deepPlaylistItem &&
            filtered.length >
              TRACK_INTAKE_PAGE_SIZE ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-wk-border bg-wk-surface px-4 py-3">
                <button
                  type="button"
                  onClick={() =>
                    setPage(
                      Math.max(
                        0,
                        safePage - 1,
                      ),
                    )
                  }
                  disabled={safePage === 0}
                  className="wk-button wk-button-ghost wk-button-sm disabled:opacity-40"
                >
                  <WkIcon
                    name="ChevronLeft"
                    size={13}
                  />
                  Previous
                </button>

                <span className="text-xs font-bold text-wk-text-muted">
                  Page {safePage + 1} of{" "}
                  {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setPage(
                      Math.min(
                        totalPages - 1,
                        safePage + 1,
                      ),
                    )
                  }
                  disabled={
                    safePage >=
                    totalPages - 1
                  }
                  className="wk-button wk-button-ghost wk-button-sm disabled:opacity-40"
                >
                  Next
                  <WkIcon
                    name="ChevronRight"
                    size={13}
                  />
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
