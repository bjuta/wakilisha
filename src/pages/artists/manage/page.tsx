import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { WkButton } from "@/components/design-system/primitives/Button";
import {
  WkIcon,
  type WkIconName,
} from "@/components/design-system/Icon";
import { ArtistImageField } from "@/components/artists/ArtistImageField";
import { useAuthUser } from "@/hooks/useAuthUser";
import {
  getArtistManagementWorkspace,
  getArtistTeam,
  inviteArtistRepresentative,
  revokeArtistRepresentative,
  saveArtistPresentation,
  submitArtistRegistryCorrection,
  updateArtistRepresentative,
  type ArtistManagementIdentity,
  type ArtistPermissionSet,
  type ArtistPresentation,
  type ArtistRepresentation,
  type ArtistTeamMember,
} from "@/services/artists/claimedArtist";
import {
  listArtistManageUpdates,
  type ArtistUpdate,
} from "@/services/artists/artistUpdates";
import {
  inspectArtistMusicProvider,
  listArtistMusicSubmissions,
  searchArtistMusicProvider,
  submitArtistMusic,
  type ArtistMusicCreditInput,
  type ArtistMusicInspection,
  type ArtistMusicProviderHit,
  type ArtistMusicProviderKey,
  type ArtistMusicSubmission,
} from "@/services/artists/artistMusicSubmissions";
import {
  buildArtistLaunchLink,
  getArtistLaunchAnalytics,
  type ArtistLaunchAnalytics,
  type ArtistLaunchTarget,
  type ArtistLaunchTargetType,
} from "@/services/artists/artistLaunchTools";

const EMPTY_PRESENTATION: ArtistPresentation = {
  bio: null,
  profileImageUrl: null,
  heroImageUrl: null,
  websiteUrl: null,
  publicEmail: null,
  socialLinks: {},
  updatedAt: null,
};

const ROLE_OPTIONS = [
  ["manager", "Manager"],
  ["label", "Label"],
  ["publicist", "Publicist"],
  ["team_member", "Team Member"],
  ["other", "Other"],
] as const;

const CORRECTION_FIELDS = [
  ["display_name", "Artist Name"],
  ["artist_type", "Artist Type"],
  ["origin_iso2", "Country"],
  ["discography", "Discography"],
  ["credits", "Credits"],
  ["other", "Something Else"],
] as const;

type ArtistStudioSection =
  | "home"
  | "music"
  | "insights"
  | "settings";

type ArtistSettingsSection =
  | "profile"
  | "team"
  | "registry";

function StudioNavItem({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: WkIconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] font-black transition ${
        active
          ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
          : "text-[var(--wk-text-muted)] hover:bg-[var(--wk-bg)] hover:text-[var(--wk-text)]"
      }`}
    >
      <WkIcon
        name={icon}
        size={16}
      />
      {label}
    </button>
  );
}

function defaultPermissionsForRole(role: string): ArtistPermissionSet {
  if (role === "manager") return { profile: true, releases: true, updates: true, team: true };
  if (role === "label") return { profile: false, releases: true, updates: true, team: false };
  if (role === "publicist") return { profile: true, releases: false, updates: true, team: false };
  if (role === "team_member") return { profile: false, releases: false, updates: true, team: false };
  return { profile: false, releases: false, updates: false, team: false };
}

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-2 text-[12px] font-semibold ${disabled ? "opacity-50" : ""}`}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} />
      <span>{label}</span>
    </label>
  );
}

function formatArtistMetric(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return value.toLocaleString();
}

function artistLaunchTargetLabel(type: ArtistLaunchTargetType): string {
  if (type === "artist") return "Artist Page";
  if (type === "release") return "Release";
  if (type === "track") return "Track";
  return "Artist Update";
}

function artistLaunchTargetKey(target: ArtistLaunchTarget): string {
  return `${target.type}:${target.id}`;
}

export default function ArtistManagePage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthUser();
  const [artist, setArtist] = useState<ArtistManagementIdentity | null>(null);
  const [activeRepresentation, setActiveRepresentation] = useState<ArtistRepresentation | null>(null);
  const [presentation, setPresentation] = useState<ArtistPresentation>(EMPTY_PRESENTATION);
  const [team, setTeam] = useState<ArtistTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [bio, setBio] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [publicEmail, setPublicEmail] = useState("");
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});

  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteRole, setInviteRole] = useState("manager");
  const [invitePermissions, setInvitePermissions] = useState<ArtistPermissionSet>(defaultPermissionsForRole("manager"));
  const [teamDrafts, setTeamDrafts] = useState<Record<string, { role: string; permissions: ArtistPermissionSet }>>({});

  const [correctionField, setCorrectionField] = useState("display_name");
  const [correctionValue, setCorrectionValue] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");

  const [artistUpdates, setArtistUpdates] = useState<ArtistUpdate[]>([]);
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);

  const [musicSubmissions, setMusicSubmissions] = useState<ArtistMusicSubmission[]>([]);
  const [musicProvider, setMusicProvider] = useState<ArtistMusicProviderKey>("apple_music");
  const [musicQuery, setMusicQuery] = useState("");
  const [musicHits, setMusicHits] = useState<ArtistMusicProviderHit[]>([]);
  const [musicInspection, setMusicInspection] = useState<ArtistMusicInspection | null>(null);
  const [musicCreditName, setMusicCreditName] = useState("");
  const [musicCreditRole, setMusicCreditRole] = useState<ArtistMusicCreditInput["role"]>("featured");
  const [musicCredits, setMusicCredits] = useState<ArtistMusicCreditInput[]>([]);

  const [launchAnalytics, setLaunchAnalytics] = useState<ArtistLaunchAnalytics | null>(null);
  const [launchAnalyticsLoading, setLaunchAnalyticsLoading] = useState(false);
  const [launchAnalyticsError, setLaunchAnalyticsError] = useState<string | null>(null);
  const [launchRangeDays, setLaunchRangeDays] = useState<7 | 30 | 90>(30);
  const [launchTargetKey, setLaunchTargetKey] = useState("");
  const [launchSource, setLaunchSource] = useState("instagram");
  const [launchCampaign, setLaunchCampaign] = useState("");
  const [launchCopied, setLaunchCopied] = useState(false);

  async function loadTeam(artistId: string, canManageTeam: boolean) {
    if (!canManageTeam) {
      setTeam([]);
      setTeamDrafts({});
      return;
    }
    const members = await getArtistTeam(artistId);
    setTeam(members);
    setTeamDrafts(Object.fromEntries(members.map((member) => [member.representationId, {
      role: member.role,
      permissions: { ...member.permissions },
    }])));
  }

  async function loadUpdates(artistId: string, canPostUpdates: boolean) {
    if (!canPostUpdates) {
      setArtistUpdates([]);
      return;
    }
    setArtistUpdates(await listArtistManageUpdates(artistId));
  }

  async function loadMusicSubmissions(artistId: string, canSubmitMusic: boolean) {
    if (!canSubmitMusic) {
      setMusicSubmissions([]);
      return;
    }
    setMusicSubmissions(await listArtistMusicSubmissions(artistId));
  }

  useEffect(() => {
    let alive = true;

    async function load() {
      if (
        !slug ||
        user.loading
      ) {
        return;
      }

      setLoading(true);
      setMessage(null);

      if (!user.id) {
        setArtist(null);
        setActiveRepresentation(null);
        setLoading(false);
        return;
      }

      try {
        const workspace =
          await getArtistManagementWorkspace(
            slug,
          );

        if (!alive) return;

        setArtist(
          workspace.artist,
        );
        setActiveRepresentation(
          workspace.representation,
        );

        const nextPresentation =
          workspace.presentation ??
          EMPTY_PRESENTATION;

        setPresentation(
          nextPresentation,
        );
        setBio(
          nextPresentation.bio ??
            "",
        );
        setProfileImageUrl(
          nextPresentation.profileImageUrl ??
            "",
        );
        setHeroImageUrl(
          nextPresentation.heroImageUrl ??
            "",
        );
        setWebsiteUrl(
          nextPresentation.websiteUrl ??
            "",
        );
        setPublicEmail(
          nextPresentation.publicEmail ??
            "",
        );
        setSocialLinks(
          nextPresentation.socialLinks ??
            {},
        );

        const isPublicArtist =
          workspace.artist.status ===
          "active";
        const permissions =
          workspace.representation
            .permissions;

        await Promise.all([
          loadTeam(
            workspace.artist.id,
            permissions.team,
          ),
          loadUpdates(
            workspace.artist.id,
            isPublicArtist &&
              permissions.updates,
          ),
          loadMusicSubmissions(
            workspace.artist.id,
            isPublicArtist &&
              permissions.releases,
          ),
        ]);
      } catch (error) {
        if (!alive) return;

        setArtist(null);
        setActiveRepresentation(null);
        setMessage({
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "We could not load Artist Studio access.",
        });
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, [
    slug,
    user.id,
    user.loading,
  ]);

  useEffect(() => {
    let alive = true;

    if (
      !artist?.id ||
      artist.status !== "active" ||
      activeRepresentation?.status !== "active"
    ) {
      setLaunchAnalytics(null);
      setLaunchAnalyticsError(null);
      setLaunchAnalyticsLoading(false);
      return () => {
        alive = false;
      };
    }

    setLaunchAnalyticsLoading(true);
    setLaunchAnalyticsError(null);

    getArtistLaunchAnalytics(
      artist.id,
      launchRangeDays,
    )
      .then((analytics) => {
        if (!alive) return;

        setLaunchAnalytics(analytics);

        setLaunchCampaign((current) =>
          current.trim()
            ? current
            : `${analytics.artist.slug}-launch`,
        );

        setLaunchTargetKey((current) => {
          const currentExists =
            analytics.launchTargets.some(
              (target) =>
                artistLaunchTargetKey(target) === current,
            );

          if (currentExists) {
            return current;
          }

          const first =
            analytics.launchTargets[0];

          return first
            ? artistLaunchTargetKey(first)
            : "";
        });
      })
      .catch((error) => {
        if (!alive) return;

        setLaunchAnalytics(null);
        setLaunchAnalyticsError(
          error instanceof Error
            ? error.message
            : "Artist performance could not be loaded.",
        );
      })
      .finally(() => {
        if (alive) {
          setLaunchAnalyticsLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [
    artist?.id,
    artist?.status,
    activeRepresentation?.status,
    launchRangeDays,
  ]);

  const socialFields = useMemo(() => [
    ["instagram", "Instagram"],
    ["tiktok", "TikTok"],
    ["x", "X"],
    ["youtube", "YouTube"],
    ["facebook", "Facebook"],
    ["spotify", "Spotify"],
    ["soundcloud", "SoundCloud"],
  ] as const, []);

  const selectedLaunchTarget = useMemo(
    () =>
      launchAnalytics?.launchTargets.find(
        (target) =>
          artistLaunchTargetKey(target) === launchTargetKey,
      ) ??
      launchAnalytics?.launchTargets[0] ??
      null,
    [
      launchAnalytics,
      launchTargetKey,
    ],
  );

  const launchLink = useMemo(
    () =>
      selectedLaunchTarget
        ? buildArtistLaunchLink({
            target: selectedLaunchTarget,
            source: launchSource,
            campaign: launchCampaign,
          })
        : "",
    [
      selectedLaunchTarget,
      launchSource,
      launchCampaign,
    ],
  );

  const artistMediaUrls = useMemo(
    () =>
      Array.from(
        new Set(
          [
            profileImageUrl,
            heroImageUrl,
            ...artistUpdates.map(
              (update) =>
                update.imageUrl ?? "",
            ),
          ]
            .map((url) => url.trim())
            .filter(Boolean),
        ),
      ),
    [
      profileImageUrl,
      heroImageUrl,
      artistUpdates,
    ],
  );

  function patchSocial(key: string, value: string) {
    setSocialLinks((current) => ({ ...current, [key]: value }));
  }

  async function handleSaveProfile(event: FormEvent) {
    event.preventDefault();
    if (!artist || !activeRepresentation?.permissions.profile) return;
    setBusy(true);
    setMessage(null);
    try {
      const cleanSocial = Object.fromEntries(
        Object.entries(socialLinks).filter(([, value]) => value.trim().length > 0).map(([key, value]) => [key, value.trim()]),
      );
      const saved = await saveArtistPresentation({
        artistId: artist.id,
        bio: bio.trim(),
        profileImageUrl: profileImageUrl.trim(),
        heroImageUrl: heroImageUrl.trim(),
        websiteUrl: websiteUrl.trim(),
        publicEmail: publicEmail.trim(),
        socialLinks: cleanSocial,
      });
      setPresentation(saved);
      setMessage({ type: "success", text: "Artist profile updated." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "We could not update this Artist profile." });
    } finally {
      setBusy(false);
    }
  }

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    if (!artist || !activeRepresentation?.permissions.team || !inviteUsername.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      await inviteArtistRepresentative({
        artistId: artist.id,
        username: inviteUsername.trim(),
        role: inviteRole,
        permissions: {
          profile: invitePermissions.profile && activeRepresentation.permissions.profile,
          releases: invitePermissions.releases && activeRepresentation.permissions.releases,
          updates: invitePermissions.updates && activeRepresentation.permissions.updates,
          team: invitePermissions.team && activeRepresentation.permissions.team,
        },
      });
      setInviteUsername("");
      setMessage({ type: "success", text: "Team invitation sent." });
      await loadTeam(artist.id, true);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "We could not send this invitation." });
    } finally {
      setBusy(false);
    }
  }

  function patchTeamDraft(representationId: string, patch: Partial<{ role: string; permissions: ArtistPermissionSet }>) {
    setTeamDrafts((current) => {
      const existing = current[representationId];
      if (!existing) return current;
      return {
        ...current,
        [representationId]: {
          role: patch.role ?? existing.role,
          permissions: patch.permissions ?? existing.permissions,
        },
      };
    });
  }

  async function handleSaveTeamMember(member: ArtistTeamMember) {
    const draft = teamDrafts[member.representationId];
    if (!artist || !draft || !activeRepresentation?.permissions.team) return;
    setBusy(true);
    setMessage(null);
    try {
      await updateArtistRepresentative({
        representationId: member.representationId,
        role: draft.role,
        permissions: {
          profile: draft.permissions.profile && activeRepresentation.permissions.profile,
          releases: draft.permissions.releases && activeRepresentation.permissions.releases,
          updates: draft.permissions.updates && activeRepresentation.permissions.updates,
          team: draft.permissions.team && activeRepresentation.permissions.team,
        },
      });
      setMessage({ type: "success", text: "Team permissions updated." });
      await loadTeam(artist.id, true);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "We could not update this team member." });
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveTeamMember(member: ArtistTeamMember) {
    if (!artist || !activeRepresentation?.permissions.team) return;
    const reason = window.prompt("Why are you removing this team member?");
    if (!reason || reason.trim().length < 3) return;
    setBusy(true);
    setMessage(null);
    try {
      await revokeArtistRepresentative(member.representationId, reason.trim());
      setMessage({ type: "success", text: "Team access removed." });
      await loadTeam(artist.id, true);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "We could not remove this team member." });
    } finally {
      setBusy(false);
    }
  }

  async function handleCorrection(event: FormEvent) {
    event.preventDefault();
    if (!artist || !activeRepresentation?.permissions.profile) return;
    if (!correctionValue.trim() || correctionReason.trim().length < 10) {
      setMessage({ type: "error", text: "Tell us what should change and why." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await submitArtistRegistryCorrection({
        artistId: artist.id,
        fieldKey: correctionField,
        proposedValue: correctionValue.trim(),
        reason: correctionReason.trim(),
      });
      setCorrectionValue("");
      setCorrectionReason("");
      setMessage({ type: "success", text: "Correction sent for review." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "We could not send this correction." });
    } finally {
      setBusy(false);
    }
  }

  function resetMusicComposer() {
    setMusicQuery("");
    setMusicHits([]);
    setMusicInspection(null);
    setMusicCreditName("");
    setMusicCreditRole("featured");
    setMusicCredits([]);
  }

  async function handleMusicSearch() {
    if (!artist || !activeRepresentation?.permissions.releases) return;
    const query = musicQuery.trim();
    if (query.length < 2) {
      setMessage({ type: "error", text: "Enter at least two characters to search for the track." });
      return;
    }

    setBusy(true);
    setMessage(null);
    setMusicInspection(null);
    try {
      setMusicHits(await searchArtistMusicProvider({
        artistId: artist.id,
        provider: musicProvider,
        query,
      }));
    } catch (error) {
      setMusicHits([]);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "We could not search this music provider.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleMusicInspect(hit: ArtistMusicProviderHit) {
    if (!artist || !activeRepresentation?.permissions.releases) return;
    setBusy(true);
    setMessage(null);
    try {
      const inspection = await inspectArtistMusicProvider({
        artistId: artist.id,
        hit,
      });
      setMusicInspection(inspection);
      setMusicQuery(inspection.title);
      setMusicHits([]);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "We could not validate this provider track.",
      });
    } finally {
      setBusy(false);
    }
  }

  function addMusicCredit() {
    if (!artist) return;
    const name = musicCreditName.trim();
    if (!name) return;

    const duplicate = [
      artist.name,
      ...musicCredits.map((credit) => credit.name),
    ].some((existing) => existing.trim().toLowerCase() === name.toLowerCase());

    if (duplicate) {
      setMessage({ type: "error", text: "That Artist is already included in this submission." });
      return;
    }

    setMusicCredits((current) => [
      ...current,
      {
        role: musicCreditRole,
        name,
      },
    ]);
    setMusicCreditName("");
    setMusicCreditRole("featured");
    setMessage(null);
  }

  function removeMusicCredit(index: number) {
    setMusicCredits((current) =>
      current.filter((_, creditIndex) => creditIndex !== index),
    );
  }

  async function handleMusicSubmission(event: FormEvent) {
    event.preventDefault();
    if (!artist || !activeRepresentation?.permissions.releases) return;
    if (!musicInspection) {
      setMessage({ type: "error", text: "Choose and validate the provider track first." });
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      await submitArtistMusic({
        artistId: artist.id,
        validationId: musicInspection.validationId,
        credits: musicCredits,
        submissionKey: crypto.randomUUID(),
      });
      resetMusicComposer();
      await loadMusicSubmissions(artist.id, true);
      setMessage({ type: "success", text: "Music sent to Registry review." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "We could not send this music to Registry review.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyLaunchLink() {
    if (!launchLink) {
      setMessage({
        type: "error",
        text: "Choose a public page and enter a campaign name before copying the link.",
      });
      return;
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard is unavailable.");
      }

      await navigator.clipboard.writeText(launchLink);
      setLaunchCopied(true);
      setMessage({
        type: "success",
        text: "Launch link copied.",
      });

      window.setTimeout(
        () => setLaunchCopied(false),
        2000,
      );
    } catch {
      setLaunchCopied(false);
      setMessage({
        type: "error",
        text: "Copy the launch link from the field below.",
      });
    }
  }

  function openStudioSection(
    section: ArtistStudioSection,
    settings?: ArtistSettingsSection,
  ) {
    const next =
      new URLSearchParams(
        searchParams,
      );

    next.set(
      "section",
      section,
    );

    if (
      section === "settings" &&
      settings
    ) {
      next.set(
        "settings",
        settings,
      );
    } else if (
      section !== "settings"
    ) {
      next.delete("settings");
    }

    setSearchParams(
      next,
      {
        replace: true,
      },
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  if (user.loading || loading) {
    return <main className="wk-container px-6 py-20"><p className="text-[14px] text-[var(--wk-text-muted)]">Loading Artist access…</p></main>;
  }

  if (!user.id) {
    const returnTo = slug ? `/artists/${slug}/manage` : "/artists";
    return (
      <main className="wk-container px-6 py-20">
        <div className="max-w-xl rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-7">
          <h1 className="text-[28px] font-black tracking-tight text-[var(--wk-text)]">Artist Management</h1>
          <p className="mt-2 text-[14px] leading-6 text-[var(--wk-text-muted)]">Sign in with the account connected to this Artist.</p>
          <Link to={`/auth?returnTo=${encodeURIComponent(returnTo)}`} className="mt-6 inline-block"><WkButton>Sign In</WkButton></Link>
        </div>
      </main>
    );
  }

  if (!artist) {
    return <main className="wk-container px-6 py-20"><h1 className="text-[28px] font-black text-[var(--wk-text)]">Artist Not Found</h1></main>;
  }

  if (!activeRepresentation) {
    return (
      <main className="wk-container px-6 py-20">
        <div className="max-w-xl rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-7">
          <h1 className="text-[28px] font-black tracking-tight text-[var(--wk-text)]">You Cannot Manage This Artist</h1>
          <p className="mt-2 text-[14px] leading-6 text-[var(--wk-text-muted)]">Your account does not have active access to {artist.name}.</p>
          <Link to="/artist-studio" className="mt-6 inline-block"><WkButton variant="soft">Back to Artist Studio</WkButton></Link>
        </div>
      </main>
    );
  }

  const permissions = activeRepresentation.permissions;
  const isPublicArtist =
    artist.status === "active";

  const requestedStudioSection =
    searchParams.get("section");
  const requestedSettingsSection =
    searchParams.get("settings");

  const requestedStudioAllowed =
    requestedStudioSection === "home" ||
    (
      requestedStudioSection === "music" &&
      isPublicArtist &&
      permissions.releases
    ) ||
    (
      requestedStudioSection === "insights" &&
      isPublicArtist
    ) ||
    (
      requestedStudioSection === "settings" &&
      (
        permissions.profile ||
        permissions.team
      )
    );

  const studioSection: ArtistStudioSection =
    requestedStudioAllowed
      ? requestedStudioSection as ArtistStudioSection
      : "home";

  const requestedSettingsAllowed =
    (
      requestedSettingsSection === "profile" &&
      permissions.profile
    ) ||
    (
      requestedSettingsSection === "team" &&
      permissions.team
    ) ||
    (
      requestedSettingsSection === "registry" &&
      isPublicArtist &&
      permissions.profile
    );

  const settingsSection: ArtistSettingsSection =
    requestedSettingsAllowed
      ? requestedSettingsSection as ArtistSettingsSection
      : permissions.profile
        ? "profile"
        : "team";

  const profileChecks = [
    {
      label: "Profile picture",
      complete:
        Boolean(
          profileImageUrl.trim(),
        ),
    },
    {
      label: "Cover image",
      complete:
        Boolean(
          heroImageUrl.trim(),
        ),
    },
    {
      label: "Bio",
      complete:
        Boolean(
          bio.trim(),
        ),
    },
    {
      label: "Contact or social link",
      complete:
        Boolean(
          websiteUrl.trim() ||
          publicEmail.trim() ||
          Object.values(
            socialLinks,
          ).some(
            (value) =>
              value.trim(),
          ),
        ),
    },
  ];

  const completedProfileChecks =
    profileChecks.filter(
      (item) =>
        item.complete,
    ).length;

  const profileCompletionPercent =
    Math.round(
      (
        completedProfileChecks /
        profileChecks.length
      ) * 100,
    );

  return (
    <main className="wk-container px-6 py-10 md:py-14">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Link
            to={
              isPublicArtist
                ? `/artists/${artist.slug}`
                : `/artist-studio?q=${encodeURIComponent(
                    artist.name,
                  )}`
            }
            className="text-[12px] font-bold text-[var(--wk-brand)] hover:underline"
          >
            {isPublicArtist
              ? `Back to ${artist.name}`
              : "Back to Artist Studio"}
          </Link>
          <div className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">
            {isPublicArtist
              ? "Official Artist"
              : "Registry Artist"}
          </div>
          <h1 className="mt-1 text-[34px] font-black tracking-[-0.03em] text-[var(--wk-text)]">
            Artist Studio
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[var(--wk-text-muted)]">
            Create, manage, and understand {artist.name}'s presence on WAKILISHA.
          </p>
        </div>

        {isPublicArtist ? (
          <Link
            to={`/artists/${artist.slug}`}
            className="inline-flex items-center gap-2 text-[12px] font-black text-[var(--wk-text-muted)] hover:text-[var(--wk-brand)]"
          >
            View Public Profile
            <WkIcon
              name="ExternalLink"
              size={14}
            />
          </Link>
        ) : (
          <span className="rounded-full bg-[var(--wk-brand-soft)] px-3 py-1.5 text-[10px] font-black text-[var(--wk-brand)]">
            Registry Review
          </span>
        )}
      </div>

      {message && (
        <div className={`mb-6 rounded-xl border px-4 py-3 text-[13px] ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          {message.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="self-start rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 lg:sticky lg:top-24">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-[var(--wk-bg)] p-3">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
              {(profileImageUrl || artist.imageUrl) ? (
                <img
                  src={profileImageUrl || artist.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[16px] font-black text-[var(--wk-brand)]">
                  {artist.name[0]?.toUpperCase() || "A"}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[12px] font-black text-[var(--wk-text)]">
                {artist.name}
              </div>
              <div className="mt-0.5 text-[10px] font-semibold capitalize text-[var(--wk-text-muted)]">
                {activeRepresentation.role.replace(/_/g, " ")}
              </div>
            </div>
          </div>

          <nav
            className="space-y-1"
            aria-label="Artist Studio sections"
          >
            <StudioNavItem
              active={studioSection === "home"}
              icon="Home"
              label="Home"
              onClick={() => openStudioSection("home")}
            />

            {isPublicArtist &&
            permissions.releases && (
              <StudioNavItem
                active={studioSection === "music"}
                icon="Music"
                label="Music"
                onClick={() => openStudioSection("music")}
              />
            )}

            {isPublicArtist ? (
              <StudioNavItem
                active={studioSection === "insights"}
                icon="BarChart3"
                label="Insights"
                onClick={() => openStudioSection("insights")}
              />
            ) : null}

            {(permissions.profile || permissions.team) && (
              <StudioNavItem
                active={studioSection === "settings"}
                icon="Settings"
                label="Settings"
                onClick={() =>
                  openStudioSection(
                    "settings",
                    settingsSection,
                  )
                }
              />
            )}
          </nav>
        </aside>

        <div className="min-w-0 space-y-6">
          {studioSection === "home" && (
            <section className="rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 md:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">
                    Artist Studio
                  </div>
                  <h2 className="mt-2 text-[26px] font-black tracking-tight text-[var(--wk-text)]">
                    You represent {artist.name} on WAKILISHA.
                  </h2>
                  <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[var(--wk-text-muted)]">
                    {isPublicArtist
                      ? "Keep the profile current, share updates, submit music for Registry review, and understand what reaches people."
                      : "Your representation is approved. Profile and team tools are available while the Registry identity remains under review."}
                  </p>
                </div>

                <div className="rounded-2xl bg-[var(--wk-bg)] px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">
                    Profile Setup
                  </div>
                  <div className="mt-1 text-[24px] font-black text-[var(--wk-text)]">
                    {profileCompletionPercent}%
                  </div>
                </div>
              </div>

              <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
                <div className="rounded-2xl border border-[var(--wk-border)] p-5">
                  <h3 className="text-[15px] font-black text-[var(--wk-text)]">
                    Start With Your Presence
                  </h3>
                  <p className="mt-1 text-[11px] leading-5 text-[var(--wk-text-muted)]">
                    These details shape how people see {artist.name} across WAKILISHA.
                  </p>

                  <div className="mt-4 space-y-2">
                    {profileChecks.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center gap-2 text-[12px] font-semibold text-[var(--wk-text-muted)]"
                      >
                        <WkIcon
                          name={item.complete ? "CheckCircle2" : "Circle"}
                          size={15}
                          className={item.complete ? "text-[var(--wk-success)]" : "text-[var(--wk-text-faint)]"}
                        />
                        {item.label}
                      </div>
                    ))}
                  </div>

                  {permissions.profile && (
                    <button
                      type="button"
                      onClick={() =>
                        openStudioSection(
                          "settings",
                          "profile",
                        )
                      }
                      className="mt-5 inline-flex items-center gap-2 text-[12px] font-black text-[var(--wk-brand)] hover:underline"
                    >
                      Edit Profile
                      <WkIcon
                        name="ArrowRight"
                        size={14}
                      />
                    </button>
                  )}
                </div>

                <div className="rounded-2xl border border-[var(--wk-border)] p-5">
                  <h3 className="text-[15px] font-black text-[var(--wk-text)]">
                    Quick Actions
                  </h3>

                  <div className="mt-4 grid gap-2">
                    {isPublicArtist &&
                    permissions.updates && (
                      <Link
                        to={`/artists/${artist.slug}`}
                        className="flex items-center justify-between rounded-xl bg-[var(--wk-bg)] px-4 py-3 text-left text-[12px] font-black text-[var(--wk-text)] hover:bg-[var(--wk-surface-strong)]"
                      >
                        Create Post
                        <WkIcon name="ArrowRight" size={14} />
                      </Link>
                    )}

                    {permissions.releases && (
                      <button
                        type="button"
                        onClick={() => openStudioSection("music")}
                        className="flex items-center justify-between rounded-xl bg-[var(--wk-bg)] px-4 py-3 text-left text-[12px] font-black text-[var(--wk-text)] hover:bg-[var(--wk-surface-strong)]"
                      >
                        Add Music
                        <WkIcon name="ArrowRight" size={14} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => openStudioSection("insights")}
                      className="flex items-center justify-between rounded-xl bg-[var(--wk-bg)] px-4 py-3 text-left text-[12px] font-black text-[var(--wk-text)] hover:bg-[var(--wk-surface-strong)]"
                    >
                      View Insights
                      <WkIcon name="ArrowRight" size={14} />
                    </button>

                    {permissions.team && (
                      <button
                        type="button"
                        onClick={() =>
                          openStudioSection(
                            "settings",
                            "team",
                          )
                        }
                        className="flex items-center justify-between rounded-xl bg-[var(--wk-bg)] px-4 py-3 text-left text-[12px] font-black text-[var(--wk-text)] hover:bg-[var(--wk-surface-strong)]"
                      >
                        Team Access
                        <WkIcon name="ArrowRight" size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {studioSection === "settings" && (
            <section className="rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 md:p-6">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-brand)]">
                  Artist Studio
                </div>
                <h2 className="mt-1 text-[22px] font-black tracking-tight text-[var(--wk-text)]">
                  Settings
                </h2>
                <p className="mt-1 text-[12px] leading-5 text-[var(--wk-text-muted)]">
                  Manage presentation, team access, and reviewed Registry corrections.
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {permissions.profile && (
                  <button
                    type="button"
                    onClick={() =>
                      openStudioSection(
                        "settings",
                        "profile",
                      )
                    }
                    className={`rounded-full px-4 py-2 text-[11px] font-black ${
                      settingsSection === "profile"
                        ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                        : "border border-[var(--wk-border)] text-[var(--wk-text-muted)]"
                    }`}
                  >
                    Profile
                  </button>
                )}

                {permissions.team && (
                  <button
                    type="button"
                    onClick={() =>
                      openStudioSection(
                        "settings",
                        "team",
                      )
                    }
                    className={`rounded-full px-4 py-2 text-[11px] font-black ${
                      settingsSection === "team"
                        ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                        : "border border-[var(--wk-border)] text-[var(--wk-text-muted)]"
                    }`}
                  >
                    Team
                  </button>
                )}

                {permissions.profile && (
                  <button
                    type="button"
                    onClick={() =>
                      openStudioSection(
                        "settings",
                        "registry",
                      )
                    }
                    className={`rounded-full px-4 py-2 text-[11px] font-black ${
                      settingsSection === "registry"
                        ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                        : "border border-[var(--wk-border)] text-[var(--wk-text-muted)]"
                    }`}
                  >
                    Registry
                  </button>
                )}
              </div>
            </section>
          )}
          <section id="artist-launch-tools" className={`${studioSection === "insights" ? "" : "hidden"} scroll-mt-24 rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 md:p-7`}>
            <h2 className="text-[22px] font-black tracking-tight text-[var(--wk-text)]">Launch Tools</h2>
            <p className="mt-1 max-w-3xl text-[13px] leading-6 text-[var(--wk-text-muted)]">
              Create tracked links to this Artist page, music, and published Updates. Visits from these links are grouped in Performance below.
            </p>

            <div className="mt-6 rounded-2xl border border-[var(--wk-border)] p-5">
              <h3 className="text-[16px] font-black text-[var(--wk-text)]">Launch Links</h3>
              <p className="mt-1 text-[11px] leading-5 text-[var(--wk-text-muted)]">
                Choose a public WAKILISHA page, name the campaign, and copy a link for the channel you are using.
              </p>

              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_160px_minmax(0,1fr)]">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-bold text-[var(--wk-text)]">Public Page</span>
                  <select
                    value={launchTargetKey}
                    onChange={(event) => {
                      setLaunchTargetKey(event.target.value);
                      setLaunchCopied(false);
                    }}
                    disabled={launchAnalyticsLoading || !launchAnalytics?.launchTargets.length}
                    className="h-11 w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 text-[12px] text-[var(--wk-text)] disabled:opacity-50"
                  >
                    {(launchAnalytics?.launchTargets ?? []).map((target) => (
                      <option key={artistLaunchTargetKey(target)} value={artistLaunchTargetKey(target)}>
                        {artistLaunchTargetLabel(target.type)} · {target.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-bold text-[var(--wk-text)]">Source</span>
                  <select
                    value={launchSource}
                    onChange={(event) => {
                      setLaunchSource(event.target.value);
                      setLaunchCopied(false);
                    }}
                    className="h-11 w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 text-[12px] text-[var(--wk-text)]"
                  >
                    <option value="instagram">Instagram</option>
                    <option value="tiktok">TikTok</option>
                    <option value="x">X</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="newsletter">Newsletter</option>
                    <option value="press">Press</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-bold text-[var(--wk-text)]">Campaign</span>
                  <input
                    value={launchCampaign}
                    onChange={(event) => {
                      setLaunchCampaign(event.target.value);
                      setLaunchCopied(false);
                    }}
                    maxLength={80}
                    placeholder="new-single-launch"
                    className="h-11 w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 text-[12px] text-[var(--wk-text)]"
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  readOnly
                  value={launchLink}
                  placeholder="Your tracked launch link appears here."
                  className="h-11 w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 text-[11px] text-[var(--wk-text-muted)]"
                />
                <WkButton
                  type="button"
                  disabled={!launchLink}
                  onClick={() => void handleCopyLaunchLink()}
                >
                  {launchCopied ? "Copied" : "Copy Launch Link"}
                </WkButton>
              </div>

              <p className="mt-2 text-[10px] leading-4 text-[var(--wk-text-faint)]">
                Tracked visits appear under Launch Campaigns after people open the link.
              </p>
            </div>

            <div className="mt-7 border-t border-[var(--wk-divider)] pt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-[18px] font-black text-[var(--wk-text)]">Performance</h3>
                  <p className="mt-1 text-[11px] leading-5 text-[var(--wk-text-muted)]">
                    Public activity across this Artist's WAKILISHA pages. Visitor and follower identities are not shown here.
                  </p>
                </div>

                <div className="flex gap-2">
                  {([7, 30, 90] as const).map((range) => (
                    <WkButton
                      key={range}
                      type="button"
                      variant={launchRangeDays === range ? "primary" : "soft"}
                      onClick={() => setLaunchRangeDays(range)}
                      disabled={launchAnalyticsLoading}
                    >
                      {range} Days
                    </WkButton>
                  ))}
                </div>
              </div>

              {launchAnalyticsError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-800">
                  {launchAnalyticsError}
                </div>
              )}

              {launchAnalyticsLoading && !launchAnalytics ? (
                <p className="mt-5 text-[12px] text-[var(--wk-text-muted)]">Loading performance…</p>
              ) : launchAnalytics ? (
                <>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    {[
                      ["Views", launchAnalytics.summary.views],
                      ["Plays", launchAnalytics.summary.plays],
                      ["Shares", launchAnalytics.summary.shares],
                      ["Visitors", launchAnalytics.summary.visitors],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded-2xl bg-[var(--wk-bg)] p-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">{label}</div>
                        <div className="mt-2 text-[26px] font-black tracking-tight text-[var(--wk-text)]">{formatArtistMetric(Number(value))}</div>
                      </div>
                    ))}
                    <div className="rounded-2xl bg-[var(--wk-bg)] p-4">
                      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">Followers</div>
                      <div className="mt-2 text-[26px] font-black tracking-tight text-[var(--wk-text)]">{formatArtistMetric(launchAnalytics.summary.followers)}</div>
                      <div className="mt-1 text-[10px] font-semibold text-[var(--wk-text-muted)]">
                        +{formatArtistMetric(launchAnalytics.summary.newFollowers)} in this period
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-5 lg:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--wk-border)] p-4">
                      <h4 className="text-[13px] font-black text-[var(--wk-text)]">Top Content</h4>
                      <div className="mt-3 space-y-2">
                        {launchAnalytics.topContent.map((item) => (
                          <Link
                            key={`${item.type}:${item.id}`}
                            to={item.path}
                            className="flex items-center justify-between gap-3 rounded-xl bg-[var(--wk-bg)] px-3 py-3 hover:bg-[var(--wk-surface-strong)]"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-[12px] font-black text-[var(--wk-text)]">{item.title}</div>
                              <div className="mt-0.5 text-[10px] font-semibold text-[var(--wk-text-muted)]">{artistLaunchTargetLabel(item.type)}</div>
                            </div>
                            <div className="shrink-0 text-right text-[10px] leading-4 text-[var(--wk-text-muted)]">
                              <div>{formatArtistMetric(item.views)} views</div>
                              {(item.plays > 0 || item.shares > 0) && (
                                <div>
                                  {item.plays > 0 ? `${formatArtistMetric(item.plays)} plays` : ""}
                                  {item.plays > 0 && item.shares > 0 ? " · " : ""}
                                  {item.shares > 0 ? `${formatArtistMetric(item.shares)} shares` : ""}
                                </div>
                              )}
                            </div>
                          </Link>
                        ))}
                        {launchAnalytics.topContent.length === 0 && (
                          <p className="rounded-xl bg-[var(--wk-bg)] px-3 py-4 text-[11px] text-[var(--wk-text-muted)]">
                            No public activity in this range yet.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[var(--wk-border)] p-4">
                      <h4 className="text-[13px] font-black text-[var(--wk-text)]">Launch Campaigns</h4>
                      <div className="mt-3 space-y-2">
                        {launchAnalytics.launchCampaigns.map((campaign) => (
                          <div key={`${campaign.campaign}:${campaign.source}`} className="rounded-xl bg-[var(--wk-bg)] px-3 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-[12px] font-black text-[var(--wk-text)]">{campaign.campaign}</div>
                                <div className="mt-0.5 text-[10px] font-semibold text-[var(--wk-text-muted)]">{campaign.source}</div>
                              </div>
                              <div className="shrink-0 text-right text-[10px] leading-4 text-[var(--wk-text-muted)]">
                                <div>{formatArtistMetric(campaign.views)} views</div>
                                <div>{formatArtistMetric(campaign.visitors)} visitors</div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {launchAnalytics.launchCampaigns.length === 0 && (
                          <p className="rounded-xl bg-[var(--wk-bg)] px-3 py-4 text-[11px] text-[var(--wk-text-muted)]">
                            No tracked launch visits in this range yet.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-[10px] text-[var(--wk-text-faint)]">
                    Range starts {new Date(launchAnalytics.since).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.
                  </p>
                </>
              ) : null}
            </div>
          </section>

          {permissions.profile && (
            <section className={`${studioSection === "settings" && settingsSection === "profile" ? "" : "hidden"} rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 md:p-7`}>
              <h2 className="text-[22px] font-black tracking-tight text-[var(--wk-text)]">Profile</h2>
              <p className="mt-1 text-[13px] leading-6 text-[var(--wk-text-muted)]">These details shape the public Artist page. Registry facts stay under WAKILISHA review.</p>

              <form onSubmit={handleSaveProfile} className="mt-6 space-y-5">
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">Bio</span>
                  <textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={8} maxLength={4000} className="w-full resize-y rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] leading-6 text-[var(--wk-text)]" />
                </label>

                <div className="space-y-6">
                  <ArtistImageField
                    artistId={artist.id}
                    label="Cover Image"
                    value={heroImageUrl}
                    onChange={setHeroImageUrl}
                    libraryUrls={artistMediaUrls}
                    variant="cover"
                    helper="Use a wide image that works behind the Artist name."
                  />

                  <ArtistImageField
                    artistId={artist.id}
                    label="Profile Picture"
                    value={profileImageUrl}
                    onChange={setProfileImageUrl}
                    libraryUrls={artistMediaUrls}
                    variant="profile"
                    helper="Use a clear square Artist image. JPG, PNG, or WebP."
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">Website</span>
                      <input type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://" className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] text-[var(--wk-text)]" />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">Public Email</span>
                      <input type="email" value={publicEmail} onChange={(event) => setPublicEmail(event.target.value)} placeholder="artist@example.com" className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] text-[var(--wk-text)]" />
                    </label>
                  </div>
                </div>

                <div>
                  <h3 className="text-[13px] font-black text-[var(--wk-text)]">Social Links</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {socialFields.map(([key, label]) => (
                      <label key={key} className="block">
                        <span className="mb-1 block text-[11px] font-bold text-[var(--wk-text-muted)]">{label}</span>
                        <input type="url" value={socialLinks[key] ?? ""} onChange={(event) => patchSocial(key, event.target.value)} placeholder="https://" className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[13px] text-[var(--wk-text)]" />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end"><WkButton type="submit" disabled={busy}>Save Profile</WkButton></div>
              </form>
            </section>
          )}

          {permissions.releases && (
            <section id="artist-music-submission" className={`${studioSection === "music" ? "" : "hidden"} scroll-mt-24 rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 md:p-7`}>
              <h2 className="text-[22px] font-black tracking-tight text-[var(--wk-text)]">Submit Music</h2>
              <p className="mt-1 max-w-3xl text-[13px] leading-6 text-[var(--wk-text-muted)]">
                Choose the Apple Music or Spotify record that represents this track. WAKILISHA uses it as review evidence, then checks the Music Registry before anything is added.
              </p>
              <p className="mt-2 text-[12px] font-bold text-[var(--wk-text)]">Registry review target: 3 business days.</p>

              <form onSubmit={handleMusicSubmission} className="mt-6 space-y-5">
                <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)_auto]">
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">Provider</span>
                    <select
                      value={musicProvider}
                      onChange={(event) => {
                        setMusicProvider(event.target.value as ArtistMusicProviderKey);
                        setMusicHits([]);
                        setMusicInspection(null);
                      }}
                      className="h-11 w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 text-[13px] text-[var(--wk-text)]"
                    >
                      <option value="apple_music">Apple Music</option>
                      <option value="spotify">Spotify</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">Track</span>
                    <input
                      value={musicQuery}
                      onChange={(event) => {
                        setMusicQuery(event.target.value);
                        setMusicInspection(null);
                      }}
                      placeholder="Search by track title"
                      className="h-11 w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 text-[14px] text-[var(--wk-text)]"
                    />
                  </label>
                  <div className="flex items-end">
                    <WkButton type="button" variant="soft" disabled={busy || musicQuery.trim().length < 2} onClick={() => void handleMusicSearch()}>
                      Search
                    </WkButton>
                  </div>
                </div>

                {musicHits.length > 0 && (
                  <div className="max-h-64 overflow-y-auto rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-2">
                    {musicHits.map((hit) => (
                      <button
                        key={`${hit.provider}:${hit.providerEntityId}`}
                        type="button"
                        onClick={() => void handleMusicInspect(hit)}
                        disabled={busy}
                        className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-[var(--wk-surface)] disabled:opacity-50"
                      >
                        {hit.artworkUrl ? (
                          <img src={hit.artworkUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                        ) : (
                          <div className="h-12 w-12 shrink-0 rounded-xl bg-[var(--wk-surface-strong)]" />
                        )}
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-black text-[var(--wk-text)]">{hit.title}</div>
                          <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{hit.artistDisplayName || "Artist name unavailable"}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {musicInspection && (
                  <div className="rounded-2xl border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)] p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-brand)]">Provider Record Selected</div>
                    <div className="mt-3 flex items-center gap-3">
                      {musicInspection.artworkUrl ? (
                        <img src={musicInspection.artworkUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <div className="h-16 w-16 shrink-0 rounded-xl bg-[var(--wk-surface)]" />
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-black text-[var(--wk-text)]">{musicInspection.title}</div>
                        <div className="mt-0.5 truncate text-[12px] text-[var(--wk-text-muted)]">{musicInspection.artistDisplayName || artist.name}</div>
                        {musicInspection.releaseTitle && <div className="mt-0.5 truncate text-[11px] text-[var(--wk-text-faint)]">{musicInspection.releaseTitle}</div>}
                      </div>
                    </div>
                    <p className="mt-3 text-[11px] leading-5 text-[var(--wk-text-muted)]">This provider record is review evidence. It does not create or replace Music Registry identity.</p>
                  </div>
                )}

                <div className="rounded-2xl border border-[var(--wk-border)] p-4">
                  <h3 className="text-[13px] font-black text-[var(--wk-text)]">Artist Credits</h3>
                  <div className="mt-3 rounded-xl bg-[var(--wk-bg)] px-3 py-2.5">
                    <div className="text-[12px] font-bold text-[var(--wk-text)]">{artist.name}</div>
                    <div className="text-[10px] font-semibold text-[var(--wk-text-muted)]">Primary · Music Registry Artist</div>
                  </div>

                  <div className="mt-4">
                    <div className="text-[12px] font-black text-[var(--wk-text)]">Other Artists</div>
                    <p className="mt-1 text-[11px] leading-5 text-[var(--wk-text-muted)]">Add other Primary or Featured Artists exactly as they should be reviewed.</p>
                    <div className="mt-3 grid gap-2 md:grid-cols-[150px_minmax(0,1fr)_auto]">
                      <select
                        value={musicCreditRole}
                        onChange={(event) => setMusicCreditRole(event.target.value as ArtistMusicCreditInput["role"])}
                        className="h-10 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 text-[12px] text-[var(--wk-text)]"
                      >
                        <option value="primary">Primary</option>
                        <option value="featured">Featured</option>
                      </select>
                      <input
                        value={musicCreditName}
                        onChange={(event) => setMusicCreditName(event.target.value)}
                        placeholder="Artist name"
                        maxLength={300}
                        className="h-10 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 text-[13px] text-[var(--wk-text)]"
                      />
                      <WkButton type="button" variant="soft" disabled={!musicCreditName.trim()} onClick={addMusicCredit}>
                        Add
                      </WkButton>
                    </div>

                    {musicCredits.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {musicCredits.map((credit, index) => (
                          <div key={`${credit.role}:${credit.name}:${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--wk-bg)] px-3 py-2.5">
                            <div>
                              <div className="text-[12px] font-bold text-[var(--wk-text)]">{credit.name}</div>
                              <div className="text-[10px] font-semibold text-[var(--wk-text-muted)]">{credit.role === "primary" ? "Primary" : "Featured"} · Registry review required</div>
                            </div>
                            <button type="button" onClick={() => removeMusicCredit(index)} className="text-[11px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]">
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <WkButton type="submit" disabled={busy || !musicInspection}>
                    Submit to Registry Review
                  </WkButton>
                </div>
              </form>

              <div className="mt-8 border-t border-[var(--wk-border)] pt-6">
                <div>
                  <h3 className="text-[16px] font-black text-[var(--wk-text)]">Review History</h3>
                  <p className="mt-1 text-[11px] leading-5 text-[var(--wk-text-muted)]">Your recent music submissions and their Registry review status.</p>
                </div>

                {musicSubmissions.length === 0 ? (
                  <p className="mt-4 rounded-xl bg-[var(--wk-bg)] px-4 py-5 text-[12px] text-[var(--wk-text-muted)]">No music submissions yet.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {musicSubmissions.map((submission) => {
                      const overdue = submission.slaStatus === "overdue";
                      return (
                        <article key={submission.id} className="rounded-2xl border border-[var(--wk-border)] p-4">
                          <div className="flex items-start gap-3">
                            {submission.artworkUrl ? (
                              <img src={submission.artworkUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                            ) : (
                              <div className="h-12 w-12 shrink-0 rounded-xl bg-[var(--wk-bg)]" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-[13px] font-black text-[var(--wk-text)]">{submission.trackTitle}</div>
                              {submission.releaseTitle && <div className="mt-0.5 text-[11px] text-[var(--wk-text-muted)]">{submission.releaseTitle}</div>}
                              <div className="mt-2 text-[11px] font-semibold text-[var(--wk-text)]">Registry review: {submission.status.replace(/_/g, " ")}.</div>
                              <div className="mt-1 text-[10px] leading-4 text-[var(--wk-text-muted)]">
                                Submitted {new Date(submission.createdAt).toLocaleString()} · Review target {new Date(submission.reviewDueAt).toLocaleString()}
                              </div>
                              {overdue ? (
                                <div className="mt-2 text-[11px] font-bold text-amber-700">Overdue: this submission has passed the 3-business-day review target.</div>
                              ) : submission.reviewedAt ? (
                                <div className="mt-2 text-[11px] text-[var(--wk-text-muted)]">Reviewed {new Date(submission.reviewedAt).toLocaleString()}.</div>
                              ) : (
                                <div className="mt-2 text-[11px] text-[var(--wk-text-muted)]">Within the 3-business-day review target.</div>
                              )}
                              {submission.canonicalTrackTitle && (
                                <div className="mt-2 text-[11px] font-bold text-[var(--wk-brand)]">Music Registry: {submission.canonicalTrackTitle}</div>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}

          {permissions.team && (
            <section className={`${studioSection === "settings" && settingsSection === "team" ? "" : "hidden"} rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 md:p-7`}>
              <h2 className="text-[22px] font-black tracking-tight text-[var(--wk-text)]">Manage Team</h2>
              <p className="mt-1 text-[13px] leading-6 text-[var(--wk-text-muted)]">Invite WAKILISHA accounts and choose what each person can manage.</p>

              <form onSubmit={handleInvite} className="mt-5 grid gap-3 rounded-2xl bg-[var(--wk-bg)] p-4 md:grid-cols-[1fr_180px_auto] md:items-end">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold text-[var(--wk-text-muted)]">Username</span>
                  <input value={inviteUsername} onChange={(event) => setInviteUsername(event.target.value)} placeholder="@username" className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3 text-[13px] text-[var(--wk-text)]" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold text-[var(--wk-text-muted)]">Role</span>
                  <select value={inviteRole} onChange={(event) => { const role = event.target.value; setInviteRole(role); setInvitePermissions(defaultPermissionsForRole(role)); }} className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3 text-[13px] text-[var(--wk-text)]">
                    {ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <WkButton type="submit" disabled={busy || !inviteUsername.trim()}>Invite</WkButton>
                <div className="md:col-span-3 flex flex-wrap gap-4 pt-1">
                  <Toggle label="Profile" checked={invitePermissions.profile} onChange={(checked) => setInvitePermissions((current) => ({ ...current, profile: checked }))} disabled={!permissions.profile} />
                  <Toggle label="Music" checked={invitePermissions.releases} onChange={(checked) => setInvitePermissions((current) => ({ ...current, releases: checked }))} disabled={!permissions.releases} />
                  <Toggle label="Updates" checked={invitePermissions.updates} onChange={(checked) => setInvitePermissions((current) => ({ ...current, updates: checked }))} disabled={!permissions.updates} />
                  <Toggle label="Team" checked={invitePermissions.team} onChange={(checked) => setInvitePermissions((current) => ({ ...current, team: checked }))} disabled={!permissions.team} />
                </div>
              </form>

              <div className="mt-5 space-y-3">
                {team.map((member) => {
                  const draft = teamDrafts[member.representationId];
                  const isArtistRole = member.role === "artist";
                  return (
                    <div key={member.representationId} className="rounded-2xl border border-[var(--wk-border)] p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="text-[14px] font-black text-[var(--wk-text)]">{member.displayName || member.username || "WAKILISHA Account"}</div>
                          <div className="mt-1 text-[11px] text-[var(--wk-text-muted)]">{member.username ? `@${member.username}` : "No public username"} · {member.status === "active" ? "Active" : "Invitation Pending"}</div>
                        </div>
                        {!isArtistRole && draft && (
                          <div className="flex flex-wrap gap-2">
                            <WkButton variant="soft" onClick={() => void handleSaveTeamMember(member)} disabled={busy}>Save Access</WkButton>
                            <WkButton variant="ghost" onClick={() => void handleRemoveTeamMember(member)} disabled={busy}>Remove</WkButton>
                          </div>
                        )}
                      </div>

                      {isArtistRole ? (
                        <p className="mt-3 text-[12px] leading-5 text-[var(--wk-text-muted)]">The verified Artist role can only be revoked through WAKILISHA review.</p>
                      ) : draft ? (
                        <div className="mt-4 space-y-3">
                          <select value={draft.role} onChange={(event) => patchTeamDraft(member.representationId, { role: event.target.value })} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[12px] text-[var(--wk-text)]">
                            {ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                          <div className="flex flex-wrap gap-4">
                            {(["profile", "releases", "updates", "team"] as const).map((key) => (
                              <Toggle
                                key={key}
                                label={key === "releases" ? "Music" : key.charAt(0).toUpperCase() + key.slice(1)}
                                checked={draft.permissions[key]}
                                disabled={!permissions[key]}
                                onChange={(checked) => patchTeamDraft(member.representationId, { permissions: { ...draft.permissions, [key]: checked } })}
                              />
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {team.length === 0 && <p className="text-[13px] text-[var(--wk-text-muted)]">No team members yet.</p>}
              </div>
            </section>
          )}

          {isPublicArtist &&
          permissions.profile && (
            <section className={`${studioSection === "settings" && settingsSection === "registry" ? "" : "hidden"} rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 md:p-7`}>
              <h2 className="text-[22px] font-black tracking-tight text-[var(--wk-text)]">Suggest a Registry Correction</h2>
              <p className="mt-1 text-[13px] leading-6 text-[var(--wk-text-muted)]">Names, country, type, credits, and discography stay under WAKILISHA review.</p>
              <form onSubmit={handleCorrection} className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">What Needs Changing?</span>
                  <select value={correctionField} onChange={(event) => setCorrectionField(event.target.value)} className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] text-[var(--wk-text)]">
                    {CORRECTION_FIELDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">What Should It Say?</span>
                  <textarea value={correctionValue} onChange={(event) => setCorrectionValue(event.target.value)} rows={4} maxLength={4000} className="w-full resize-y rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] leading-6 text-[var(--wk-text)]" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">Why Should We Change It?</span>
                  <textarea value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} rows={4} maxLength={4000} className="w-full resize-y rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] leading-6 text-[var(--wk-text)]" />
                </label>
                <div className="flex justify-end"><WkButton type="submit" disabled={busy}>Send for Review</WkButton></div>
              </form>
            </section>
          )}
        </div>

      </div>
    </main>
  );
}
