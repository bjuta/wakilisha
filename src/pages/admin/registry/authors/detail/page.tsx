import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { supabase } from "@/lib/supabase";
import type { SocialLink } from "@/services/authorProfiles";
import { bustAuthorCache } from "@/services/authorProfiles";

/* ─── Types ─── */

interface AuthorRecord {
  id: string;
  slug: string;
  name: string;
  email: string | null;
  url: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  role: string | null;
  location: string | null;
  social_links: SocialLink[] | null;
  joined_date: string | null;
  created_at: string;
  updated_at: string;
}

interface Draft {
  name: string;
  role: string;
  bio: string;
  location: string;
  avatar_url: string;
  cover_url: string;
  social_links: SocialLink[];
  joined_date: string;
}

interface ToastMsg {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

let toastCounter = 0;

const SOCIAL_ICONS: { label: string; icon: string; placeholder: string }[] = [
  { label: "Website", icon: "ri-global-line", placeholder: "https://yoursite.com" },
  { label: "Twitter", icon: "ri-twitter-x-line", placeholder: "https://x.com/username" },
  { label: "Instagram", icon: "ri-instagram-line", placeholder: "https://instagram.com/username" },
  { label: "YouTube", icon: "ri-youtube-line", placeholder: "https://youtube.com/@channel" },
  { label: "LinkedIn", icon: "ri-linkedin-line", placeholder: "https://linkedin.com/in/username" },
  { label: "SoundCloud", icon: "ri-soundcloud-line", placeholder: "https://soundcloud.com/username" },
  { label: "TikTok", icon: "ri-tiktok-line", placeholder: "https://tiktok.com/@username" },
  { label: "Facebook", icon: "ri-facebook-line", placeholder: "https://facebook.com/username" },
  { label: "Bandcamp", icon: "ri-music-line", placeholder: "https://username.bandcamp.com" },
  { label: "Spotify", icon: "ri-spotify-line", placeholder: "https://open.spotify.com/artist/..." },
  { label: "Apple Music", icon: "ri-apple-line", placeholder: "https://music.apple.com/artist/..." },
  { label: "Link", icon: "ri-link", placeholder: "https://..." },
];

/* ─── Helpers ─── */

function initialsFromName(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0]?.toUpperCase() || "")
    .join("")
    .slice(0, 2);
}

function generatedAvatarUrl(name: string): string {
  const initials = initialsFromName(name);
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <rect width="240" height="240" fill="#1A1F16"/>
      <text x="120" y="132" text-anchor="middle" fill="#85C441" font-family="system-ui,sans-serif" font-size="72" font-weight="900">${initials}</text>
    </svg>`
  )}`;
}

/* ─── Page ─── */

export default function AuthorDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [author, setAuthor] = useState<AuthorRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [draft, setDraft] = useState<Draft>({
    name: "",
    role: "",
    bio: "",
    location: "",
    avatar_url: "",
    cover_url: "",
    social_links: [],
    joined_date: "",
  });

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const [avatarPreviewError, setAvatarPreviewError] = useState(false);
  const [coverPreviewError, setCoverPreviewError] = useState(false);

  /* ─── Load ─── */

  useEffect(() => {
    if (!slug) return;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("registry_authors")
        .select("id, slug, name, email, url, bio, avatar_url, cover_url, role, location, social_links, joined_date, created_at, updated_at")
        .eq("slug", slug)
        .maybeSingle();

      if (error) {
        addToast("error", "Failed to load author.");
        setLoading(false);
        return;
      }
      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setAuthor(data as AuthorRecord);
      setDraft({
        name: data.name,
        role: data.role || "",
        bio: data.bio || "",
        location: data.location || "",
        avatar_url: data.avatar_url || "",
        cover_url: data.cover_url || "",
        social_links: (data.social_links as SocialLink[]) || [],
        joined_date: data.joined_date || "",
      });
      setIsDirty(false);
      setLoading(false);
    }
    load();
  }, [slug]);

  /* ─── Toast ─── */

  function addToast(type: ToastMsg["type"], message: string) {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  /* ─── Draft helpers ─── */

  const patchDraft = useCallback((patch: Partial<Draft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setIsDirty(true);
  }, []);

  /* ─── Social link helpers ─── */

  function addSocialLink(label: string) {
    if (draft.social_links.some((l) => l.label === label)) return;
    const preset = SOCIAL_ICONS.find((p) => p.label === label);
    patchDraft({
      social_links: [
        ...draft.social_links,
        { label, url: "", icon: preset?.icon || "ri-link" },
      ],
    });
  }

  function updateSocialLink(index: number, url: string) {
    const updated = [...draft.social_links];
    updated[index] = { ...updated[index], url };
    patchDraft({ social_links: updated });
  }

  function removeSocialLink(index: number) {
    patchDraft({ social_links: draft.social_links.filter((_, i) => i !== index) });
  }

  /* ─── Save ─── */

  async function handleSave() {
    if (!author) return;
    setIsSaving(true);

    const payload = {
      name: draft.name,
      role: draft.role || null,
      bio: draft.bio || null,
      location: draft.location || null,
      avatar_url: draft.avatar_url || null,
      cover_url: draft.cover_url || null,
      social_links: draft.social_links.length > 0 ? draft.social_links : null,
      joined_date: draft.joined_date || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("registry_authors").update(payload).eq("id", author.id);
    setIsSaving(false);

    if (error) {
      addToast("error", `Save failed: ${error.message}`);
      return;
    }

    setAuthor((prev) => (prev ? { ...prev, ...payload, social_links: payload.social_links } : prev));
    setIsDirty(false);
    addToast("success", "Author profile saved.");
    bustAuthorCache();
  }

  /* ─── Keyboard shortcuts ─── */

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, author]);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  /* ─── Reset avatar/cover error on URL change ─── */

  useEffect(() => { setAvatarPreviewError(false); }, [draft.avatar_url]);
  useEffect(() => { setCoverPreviewError(false); }, [draft.cover_url]);

  /* ─── Loading / Not Found ─── */

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-10 w-72 rounded-xl bg-[var(--wk-surface-raised)]" />
        <div className="h-[400px] rounded-xl bg-[var(--wk-surface-raised)]" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--wk-surface-raised)] text-[var(--wk-text-faint)]">
          <WkIcon name="UserX" size={28} />
        </div>
        <h2 className="text-[18px] font-bold">Author Not Found</h2>
        <p className="text-[13px] text-[var(--wk-text-muted)]">No author with slug "{slug}"</p>
        <button
          onClick={() => navigate("/admin/registry/authors")}
          className="wk-button wk-button-secondary wk-button-sm"
        >
          <WkIcon name="ArrowLeft" size={14} />
          Back to Authors
        </button>
      </div>
    );
  }

  if (!author) return null;

  const availableSocialLabels = SOCIAL_ICONS.filter(
    (p) => !draft.social_links.some((l) => l.label === p.label)
  );

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)] mb-1.5">
            <button
              onClick={() => navigate("/admin/registry/authors")}
              className="text-[var(--wk-brand)] hover:opacity-80 font-black uppercase tracking-wider transition-opacity cursor-pointer"
            >
              Authors
            </button>
            <WkIcon name="ChevronRight" size={12} />
            <span className="font-semibold uppercase tracking-wider text-[var(--wk-text-muted)] truncate max-w-[200px]">
              {draft.name || slug}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[22px] font-black tracking-tight truncate max-w-[480px]">
              {draft.name || "(Untitled)"}
            </h1>
            {draft.role && (
              <span className="inline-flex items-center rounded-full bg-[var(--wk-brand-soft)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]">
                {draft.role}
              </span>
            )}
            {isDirty && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-warning-soft)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--wk-warning)]">
                <WkIcon name="Circle" size={6} />
                Unsaved
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] text-[var(--wk-text-faint)] font-mono">{author.slug}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="wk-button wk-button-primary wk-button-sm whitespace-nowrap"
          >
            {isSaving ? (
              <>
                <WkIcon name="Loader2" size={14} className="animate-spin" />
                Saving&hellip;
              </>
            ) : (
              <>
                <WkIcon name="Save" size={14} />
                Save
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)]">
        <WkIcon name="Command" size={11} />
        <span>+S to save</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* ── Main content ── */}
        <div className="space-y-4">

          {/* Name */}
          <WkSurface className="p-5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => patchDraft({ name: e.target.value })}
              className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-4 py-3 text-[16px] font-bold text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors"
            />
          </WkSurface>

          {/* Role + Location row */}
          <WkSurface className="p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-2">
                  Role
                </label>
                <input
                  type="text"
                  value={draft.role}
                  onChange={(e) => patchDraft({ role: e.target.value })}
                  placeholder="Contributor, Staff Writer, Editor..."
                  className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-4 py-3 text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-2">
                  Location
                </label>
                <div className="relative">
                  <WkIcon name="MapPin" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)]" />
                  <input
                    type="text"
                    value={draft.location}
                    onChange={(e) => patchDraft({ location: e.target.value })}
                    placeholder="Nairobi, Kenya"
                    className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] pl-9 pr-4 py-3 text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors"
                  />
                </div>
              </div>
            </div>
          </WkSurface>

          {/* Bio */}
          <WkSurface className="p-5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-2">
              Biography
            </label>
            <textarea
              value={draft.bio}
              onChange={(e) => patchDraft({ bio: e.target.value })}
              placeholder="Author biography — tell readers who this writer is..."
              rows={6}
              className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-4 py-3 text-[13px] leading-relaxed text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] resize-none transition-colors"
            />
            <div className="mt-1.5 text-right text-[10px] text-[var(--wk-text-faint)]">
              {draft.bio.length} characters
            </div>
          </WkSurface>

          {/* Social Links */}
          <WkSurface className="p-5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-3">
              Social Links
            </label>

            {draft.social_links.length > 0 && (
              <div className="space-y-2 mb-4">
                {draft.social_links.map((link, i) => (
                  <div key={link.label} className="flex items-center gap-2">
                    <div className="flex items-center gap-2 shrink-0 min-w-[120px] rounded-md border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3 py-2">
                      <i className={`${link.icon} text-[15px] text-[var(--wk-text-muted)]`} />
                      <span className="text-[12px] font-semibold text-[var(--wk-text-soft)]">{link.label}</span>
                    </div>
                    <input
                      type="url"
                      value={link.url}
                      onChange={(e) => updateSocialLink(i, e.target.value)}
                      placeholder={SOCIAL_ICONS.find((p) => p.label === link.label)?.placeholder || "https://..."}
                      className="flex-1 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3 py-2 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors font-mono"
                    />
                    <button
                      onClick={() => removeSocialLink(i)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--wk-border)] text-[var(--wk-text-faint)] hover:text-[var(--wk-danger)] hover:border-[var(--wk-danger)] transition-colors cursor-pointer"
                    >
                      <WkIcon name="X" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {availableSocialLabels.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {availableSocialLabels.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => addSocialLink(preset.label)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3 py-1.5 text-[11px] font-semibold text-[var(--wk-text-muted)] hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)] transition-colors cursor-pointer"
                  >
                    <i className={`${preset.icon} text-[12px]`} />
                    {preset.label}
                    <WkIcon name="Plus" size={11} />
                  </button>
                ))}
              </div>
            )}
          </WkSurface>

          {/* Avatar + Cover URL */}
          <WkSurface className="p-5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-4">
              Images
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Avatar */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--wk-text-muted)] mb-2">
                  Avatar URL
                </label>
                <input
                  type="url"
                  value={draft.avatar_url}
                  onChange={(e) => patchDraft({ avatar_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3 py-2.5 text-[12px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors font-mono"
                />
                <div className="mt-3 flex items-center gap-3">
                  {draft.avatar_url && !avatarPreviewError ? (
                    <img
                      src={draft.avatar_url}
                      alt="Avatar preview"
                      className="h-16 w-16 rounded-full object-cover border border-[var(--wk-border)]"
                      onError={() => setAvatarPreviewError(true)}
                    />
                  ) : (
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-full text-[14px] font-black text-[var(--wk-brand-on)]"
                      style={{ background: "linear-gradient(135deg, #1A1F16, #2A3A1A)" }}
                    >
                      {initialsFromName(draft.name || slug || "?")}
                    </div>
                  )}
                  {draft.avatar_url && (
                    <button
                      onClick={() => patchDraft({ avatar_url: "" })}
                      className="text-[11px] font-semibold text-[var(--wk-danger)] hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Cover */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--wk-text-muted)] mb-2">
                  Cover URL
                </label>
                <input
                  type="url"
                  value={draft.cover_url}
                  onChange={(e) => patchDraft({ cover_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3 py-2.5 text-[12px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors font-mono"
                />
                <div className="mt-3">
                  {draft.cover_url && !coverPreviewError ? (
                    <div className="relative h-20 w-full rounded-lg overflow-hidden border border-[var(--wk-border)]">
                      <img
                        src={draft.cover_url}
                        alt="Cover preview"
                        className="h-full w-full object-cover"
                        onError={() => setCoverPreviewError(true)}
                      />
                    </div>
                  ) : (
                    <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-[var(--wk-border)] bg-[var(--wk-bg-subtle)]">
                      <span className="text-[11px] text-[var(--wk-text-faint)]">No cover image</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </WkSurface>

          {/* Joined Date */}
          <WkSurface className="p-5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-2">
              Joined Date
            </label>
            <div className="relative max-w-[240px]">
              <WkIcon name="Calendar" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)]" />
              <input
                type="text"
                value={draft.joined_date}
                onChange={(e) => patchDraft({ joined_date: e.target.value })}
                placeholder="e.g. March 2024"
                className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] pl-9 pr-4 py-3 text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors"
              />
            </div>
          </WkSurface>
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">
          <WkSurface className="p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-3">
              Record Info
            </h3>
            <div className="space-y-2">
              <InfoRow label="Slug" value={author.slug} mono />
              <InfoRow label="Email" value={author.email || "—"} />
              <InfoRow label="Website" value={author.url || "—"} mono />
              <InfoRow label="Created" value={new Date(author.created_at).toLocaleString()} />
              <InfoRow label="Modified" value={new Date(author.updated_at).toLocaleString()} />
            </div>
          </WkSurface>

          <WkSurface className="p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)] mb-3">
              Profile Preview
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {draft.avatar_url && !avatarPreviewError ? (
                  <img
                    src={draft.avatar_url}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover border border-[var(--wk-border)]"
                    onError={() => setAvatarPreviewError(true)}
                  />
                ) : (
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full text-[12px] font-black text-[var(--wk-brand-on)]"
                    style={{ background: "linear-gradient(135deg, #1A1F16, #2A3A1A)" }}
                  >
                    {initialsFromName(draft.name || "?")}
                  </div>
                )}
                <div>
                  <p className="text-[14px] font-bold">{draft.name || slug}</p>
                  {draft.role && (
                    <p className="text-[11px] text-[var(--wk-text-muted)]">{draft.role}</p>
                  )}
                </div>
              </div>

              {draft.location && (
                <div className="flex items-center gap-1.5 text-[12px] text-[var(--wk-text-soft)]">
                  <WkIcon name="MapPin" size={12} className="text-[var(--wk-text-faint)]" />
                  <span>{draft.location}</span>
                </div>
              )}

              {draft.bio && (
                <p className="text-[12px] leading-relaxed text-[var(--wk-text-soft)] line-clamp-4">
                  {draft.bio}
                </p>
              )}

              {draft.social_links.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {draft.social_links.map((link) =>
                    link.url ? (
                      <a
                        key={link.label}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--wk-border)] text-[var(--wk-text-muted)] hover:text-[var(--wk-brand)] hover:border-[var(--wk-brand)] transition-colors"
                        title={link.label}
                      >
                        <i className={`${link.icon} text-[14px]`} />
                      </a>
                    ) : null
                  )}
                </div>
              )}
            </div>
          </WkSurface>
        </div>
      </div>

      {/* ── Toasts ── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 text-[13px] font-semibold shadow-lg transition-all ${
              toast.type === "success"
                ? "border-[var(--wk-success)]/20 bg-[var(--wk-success-soft)] text-[var(--wk-success)]"
                : toast.type === "error"
                ? "border-[var(--wk-danger)]/20 bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]"
                : "border-[var(--wk-info)]/20 bg-[var(--wk-info-soft)] text-[var(--wk-info)]"
            }`}
          >
            <WkIcon
              name={toast.type === "success" ? "CheckCircle2" : toast.type === "error" ? "XCircle" : "Info"}
              size={16}
            />
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Tiny helpers ─── */

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-[11px] font-semibold text-[var(--wk-text-faint)] shrink-0">{label}</span>
      <span
        className={`text-right text-[11px] text-[var(--wk-text-soft)] truncate max-w-[170px] ${mono ? "font-mono" : ""}`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}