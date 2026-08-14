import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { WkButton } from "@/components/design-system/primitives/Button";
import { useAuthUser } from "@/hooks/useAuthUser";
import { getArtist, type PublicArtistDetail } from "@/services/publicContent/client";
import {
  getArtistPublicPresentation,
  getArtistRepresentationState,
  getArtistTeam,
  inviteArtistRepresentative,
  revokeArtistRepresentative,
  saveArtistPresentation,
  submitArtistRegistryCorrection,
  updateArtistRepresentative,
  type ArtistPermissionSet,
  type ArtistPresentation,
  type ArtistRepresentationState,
  type ArtistTeamMember,
} from "@/services/artists/claimedArtist";
import {
  editArtistUpdate,
  listArtistManageUpdates,
  publishArtistUpdate,
  withdrawArtistUpdate,
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

export default function ArtistManagePage() {
  const { slug } = useParams<{ slug: string }>();
  const user = useAuthUser();
  const [artist, setArtist] = useState<PublicArtistDetail | null>(null);
  const [representationState, setRepresentationState] = useState<ArtistRepresentationState | null>(null);
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
  const [updateBody, setUpdateBody] = useState("");
  const [updateImageUrl, setUpdateImageUrl] = useState("");
  const [updateLinkUrl, setUpdateLinkUrl] = useState("");
  const [updateLinkLabel, setUpdateLinkLabel] = useState("");
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);

  const [musicSubmissions, setMusicSubmissions] = useState<ArtistMusicSubmission[]>([]);
  const [musicProvider, setMusicProvider] = useState<ArtistMusicProviderKey>("apple_music");
  const [musicQuery, setMusicQuery] = useState("");
  const [musicHits, setMusicHits] = useState<ArtistMusicProviderHit[]>([]);
  const [musicInspection, setMusicInspection] = useState<ArtistMusicInspection | null>(null);
  const [musicCreditName, setMusicCreditName] = useState("");
  const [musicCreditRole, setMusicCreditRole] = useState<ArtistMusicCreditInput["role"]>("featured");
  const [musicCredits, setMusicCredits] = useState<ArtistMusicCreditInput[]>([]);

  const activeRepresentation = representationState?.representation?.status === "active"
    ? representationState.representation
    : null;

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
      if (!slug || user.loading) return;
      setLoading(true);
      setMessage(null);
      try {
        const loadedArtist = await getArtist(slug);
        if (!alive) return;
        if (!loadedArtist) {
          setArtist(null);
          return;
        }
        setArtist(loadedArtist);

        if (!user.id) {
          setRepresentationState(null);
          return;
        }

        const [state, authority] = await Promise.all([
          getArtistRepresentationState(loadedArtist.id),
          getArtistPublicPresentation(loadedArtist.id).catch(() => ({
            artistId: loadedArtist.id,
            official: false,
            presentation: null,
          })),
        ]);
        if (!alive) return;
        setRepresentationState(state);
        const nextPresentation = authority.presentation ?? EMPTY_PRESENTATION;
        setPresentation(nextPresentation);
        setBio(nextPresentation.bio ?? "");
        setProfileImageUrl(nextPresentation.profileImageUrl ?? "");
        setHeroImageUrl(nextPresentation.heroImageUrl ?? "");
        setWebsiteUrl(nextPresentation.websiteUrl ?? "");
        setPublicEmail(nextPresentation.publicEmail ?? "");
        setSocialLinks(nextPresentation.socialLinks ?? {});

        const canManageTeam = state.representation?.status === "active" && state.representation.permissions.team;
        const canPostUpdates = state.representation?.status === "active" && state.representation.permissions.updates;
        const canSubmitMusic = state.representation?.status === "active" && state.representation.permissions.releases;
        await Promise.all([
          loadTeam(loadedArtist.id, Boolean(canManageTeam)),
          loadUpdates(loadedArtist.id, Boolean(canPostUpdates)),
          loadMusicSubmissions(loadedArtist.id, Boolean(canSubmitMusic)),
        ]);
      } catch (error) {
        if (alive) setMessage({ type: "error", text: error instanceof Error ? error.message : "We could not load Artist management." });
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => { alive = false; };
  }, [slug, user.id, user.loading]);

  const socialFields = useMemo(() => [
    ["instagram", "Instagram"],
    ["tiktok", "TikTok"],
    ["x", "X"],
    ["youtube", "YouTube"],
    ["facebook", "Facebook"],
    ["spotify", "Spotify"],
    ["soundcloud", "SoundCloud"],
  ] as const, []);

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

  function resetUpdateComposer() {
    setEditingUpdateId(null);
    setUpdateBody("");
    setUpdateImageUrl("");
    setUpdateLinkUrl("");
    setUpdateLinkLabel("");
  }

  function beginEditUpdate(update: ArtistUpdate) {
    if (update.status !== "published") return;
    setEditingUpdateId(update.id);
    setUpdateBody(update.body);
    setUpdateImageUrl(update.imageUrl ?? "");
    setUpdateLinkUrl(update.linkUrl ?? "");
    setUpdateLinkLabel(update.linkLabel ?? "");
    document.getElementById("artist-updates")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function handleArtistUpdate(event: FormEvent) {
    event.preventDefault();
    if (!artist || !activeRepresentation?.permissions.updates || !updateBody.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      if (editingUpdateId) {
        await editArtistUpdate({
          updateId: editingUpdateId,
          body: updateBody.trim(),
          imageUrl: updateImageUrl.trim(),
          linkUrl: updateLinkUrl.trim(),
          linkLabel: updateLinkLabel.trim(),
        });
        setMessage({ type: "success", text: "Artist Update saved." });
      } else {
        await publishArtistUpdate({
          artistId: artist.id,
          body: updateBody.trim(),
          imageUrl: updateImageUrl.trim(),
          linkUrl: updateLinkUrl.trim(),
          linkLabel: updateLinkLabel.trim(),
        });
        setMessage({ type: "success", text: "Artist Update published to Following." });
      }
      resetUpdateComposer();
      await loadUpdates(artist.id, true);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "We could not publish this Artist Update." });
    } finally {
      setBusy(false);
    }
  }

  async function handleWithdrawUpdate(update: ArtistUpdate) {
    if (!artist || !activeRepresentation?.permissions.updates || update.status !== "published") return;
    const reason = window.prompt("Why are you withdrawing this Artist Update?");
    if (!reason || reason.trim().length < 3) return;
    setBusy(true);
    setMessage(null);
    try {
      await withdrawArtistUpdate(update.id, reason.trim());
      if (editingUpdateId === update.id) resetUpdateComposer();
      setMessage({ type: "success", text: "Artist Update withdrawn." });
      await loadUpdates(artist.id, true);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "We could not withdraw this Artist Update." });
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
          <Link to={`/artists/${artist.slug}`} className="mt-6 inline-block"><WkButton variant="soft">Back to Artist</WkButton></Link>
        </div>
      </main>
    );
  }

  const permissions = activeRepresentation.permissions;

  return (
    <main className="wk-container px-6 py-10 md:py-14">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Link to={`/artists/${artist.slug}`} className="text-[12px] font-bold text-[var(--wk-brand)] hover:underline">Back to {artist.name}</Link>
          <h1 className="mt-2 text-[34px] font-black tracking-[-0.03em] text-[var(--wk-text)]">Manage {artist.name}</h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[var(--wk-text-muted)]">Your access follows the permissions assigned to your Artist role.</p>
        </div>
        <p className="text-[12px] font-semibold text-[var(--wk-text-muted)]">
          You can manage {
            [
              permissions.profile ? "profile" : null,
              permissions.releases ? "music" : null,
              permissions.updates ? "updates" : null,
              permissions.team ? "team" : null,
            ].filter(Boolean).join(", ")
          }.
        </p>
      </div>

      {message && (
        <div className={`mb-6 rounded-xl border px-4 py-3 text-[13px] ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          {message.text}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.8fr)]">
        <div className="space-y-6">
          {permissions.profile && (
            <section className="rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 md:p-7">
              <h2 className="text-[22px] font-black tracking-tight text-[var(--wk-text)]">Edit Profile</h2>
              <p className="mt-1 text-[13px] leading-6 text-[var(--wk-text-muted)]">These details shape the public Artist page. Registry facts stay under WAKILISHA review.</p>

              <form onSubmit={handleSaveProfile} className="mt-6 space-y-5">
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">Bio</span>
                  <textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={8} maxLength={4000} className="w-full resize-y rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] leading-6 text-[var(--wk-text)]" />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">Profile Image URL</span>
                    <input type="url" value={profileImageUrl} onChange={(event) => setProfileImageUrl(event.target.value)} placeholder="https://" className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] text-[var(--wk-text)]" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">Hero Image URL</span>
                    <input type="url" value={heroImageUrl} onChange={(event) => setHeroImageUrl(event.target.value)} placeholder="https://" className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] text-[var(--wk-text)]" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">Website</span>
                    <input type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://" className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] text-[var(--wk-text)]" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">Public Email</span>
                    <input type="email" value={publicEmail} onChange={(event) => setPublicEmail(event.target.value)} placeholder="artist@example.com" className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] text-[var(--wk-text)]" />
                  </label>
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
            <section id="artist-music-submission" className="scroll-mt-24 rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 md:p-7">
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

          {permissions.updates && (
            <section id="artist-updates" className="scroll-mt-24 rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 md:p-7">
              <h2 className="text-[22px] font-black tracking-tight text-[var(--wk-text)]">Post Update</h2>
              <p className="mt-1 text-[13px] leading-6 text-[var(--wk-text-muted)]">Share something directly from this Artist with people who follow them on WAKILISHA.</p>

              <form onSubmit={handleArtistUpdate} className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">Update</span>
                  <textarea
                    value={updateBody}
                    onChange={(event) => setUpdateBody(event.target.value)}
                    rows={6}
                    maxLength={2000}
                    placeholder="What do you want people following this Artist to know?"
                    className="w-full resize-y rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] leading-6 text-[var(--wk-text)]"
                  />
                  <span className="mt-1 block text-right text-[10px] font-semibold text-[var(--wk-text-faint)]">{updateBody.length}/2000</span>
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">Image URL</span>
                    <input type="url" value={updateImageUrl} onChange={(event) => setUpdateImageUrl(event.target.value)} placeholder="https://" className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] text-[var(--wk-text)]" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">Link URL</span>
                    <input type="url" value={updateLinkUrl} onChange={(event) => setUpdateLinkUrl(event.target.value)} placeholder="https://" className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] text-[var(--wk-text)]" />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-bold text-[var(--wk-text)]">Link Label</span>
                  <input value={updateLinkLabel} onChange={(event) => setUpdateLinkLabel(event.target.value)} maxLength={120} placeholder="Listen, read, RSVP, or another short action" className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[14px] text-[var(--wk-text)]" />
                </label>

                <div className="flex flex-wrap justify-end gap-2">
                  {editingUpdateId && (
                    <WkButton type="button" variant="ghost" onClick={resetUpdateComposer} disabled={busy}>Cancel Edit</WkButton>
                  )}
                  <WkButton type="submit" disabled={busy || !updateBody.trim()}>
                    {editingUpdateId ? "Save Update" : "Post Update"}
                  </WkButton>
                </div>
              </form>

              <div className="mt-7 border-t border-[var(--wk-divider)] pt-5">
                <h3 className="text-[13px] font-black text-[var(--wk-text)]">Recent Updates</h3>
                <div className="mt-3 space-y-3">
                  {artistUpdates.map((update) => (
                    <div key={update.id} className="rounded-2xl border border-[var(--wk-border)] p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">
                            {update.status === "published" ? "Published" : "Withdrawn"} · {new Date(update.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-[var(--wk-text)]">{update.body}</p>
                        </div>
                        {update.status === "published" && (
                          <div className="flex shrink-0 gap-2">
                            <WkButton type="button" variant="soft" onClick={() => beginEditUpdate(update)} disabled={busy}>Edit</WkButton>
                            <WkButton type="button" variant="ghost" onClick={() => void handleWithdrawUpdate(update)} disabled={busy}>Withdraw</WkButton>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {artistUpdates.length === 0 && (
                    <p className="text-[13px] text-[var(--wk-text-muted)]">No Artist Updates yet.</p>
                  )}
                </div>
              </div>
            </section>
          )}

          {permissions.team && (
            <section className="rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 md:p-7">
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

          {permissions.profile && (
            <section className="rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 md:p-7">
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

        <aside className="space-y-4">
          <section className="rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
            <h2 className="text-[16px] font-black text-[var(--wk-text)]">Artist Actions</h2>
            <div className="mt-4 space-y-3">
              <div className={`rounded-2xl border border-[var(--wk-border)] p-4 ${permissions.releases ? "" : "opacity-50"}`}>
                <div className="text-[13px] font-black text-[var(--wk-text)]">Add Music</div>
                <p className="mt-1 text-[12px] leading-5 text-[var(--wk-text-muted)]">Send a provider-confirmed track to Music Registry review.</p>
                <button
                  type="button"
                  disabled={!permissions.releases}
                  onClick={() => document.getElementById("artist-music-submission")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="mt-3 rounded-full border border-[var(--wk-border)] px-4 py-2 text-[12px] font-bold text-[var(--wk-text-muted)] disabled:opacity-40"
                >
                  Add Music
                </button>
              </div>
              <div className={`rounded-2xl border border-[var(--wk-border)] p-4 ${permissions.updates ? "" : "opacity-50"}`}>
                <div className="text-[13px] font-black text-[var(--wk-text)]">Post Update</div>
                <p className="mt-1 text-[12px] leading-5 text-[var(--wk-text-muted)]">Share an Artist-authored update with people following this Artist.</p>
                <button
                  type="button"
                  disabled={!permissions.updates}
                  onClick={() => document.getElementById("artist-updates")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="mt-3 rounded-full border border-[var(--wk-border)] px-4 py-2 text-[12px] font-bold text-[var(--wk-text)] disabled:text-[var(--wk-text-muted)]"
                >
                  Post Update
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
            <h2 className="text-[16px] font-black text-[var(--wk-text)]">What Stays Protected</h2>
            <p className="mt-2 text-[12px] leading-5 text-[var(--wk-text-muted)]">WAKILISHA still reviews canonical Artist facts, credits, and discography. Your profile presentation stays separate from those records.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
