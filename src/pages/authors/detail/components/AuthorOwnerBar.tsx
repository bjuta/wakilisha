import { useState, useCallback } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { updateAuthorBySlug, bustAuthorCache, type AuthorRow } from "@/services/authorProfiles";
import type { AuthUser } from "@/hooks/useAuthUser";

/* ─── Types ─── */

interface SocialLink {
  label: string;
  url: string;
  icon: string;
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

interface AuthorOwnerBarProps {
  authUser: AuthUser;
  authorRow: AuthorRow;
  onProfileUpdated: () => void;
}

/* ─── Social link presets ─── */

const SOCIAL_PRESETS: { label: string; icon: string; placeholder: string }[] = [
  { label: "Website", icon: "ri-global-line", placeholder: "https://yoursite.com" },
  { label: "Twitter", icon: "ri-twitter-x-line", placeholder: "https://x.com/username" },
  { label: "Instagram", icon: "ri-instagram-line", placeholder: "https://instagram.com/username" },
  { label: "YouTube", icon: "ri-youtube-line", placeholder: "https://youtube.com/@channel" },
  { label: "LinkedIn", icon: "ri-linkedin-line", placeholder: "https://linkedin.com/in/username" },
  { label: "SoundCloud", icon: "ri-soundcloud-line", placeholder: "https://soundcloud.com/username" },
  { label: "TikTok", icon: "ri-tiktok-line", placeholder: "https://tiktok.com/@username" },
  { label: "Facebook", icon: "ri-facebook-line", placeholder: "https://facebook.com/username" },
  { label: "Link", icon: "ri-link", placeholder: "https://..." },
];

/* ─── Helpers ─── */

function toDraft(row: AuthorRow): Draft {
  return {
    name: row.name,
    role: row.role || "",
    bio: row.bio || "",
    location: row.location || "",
    avatar_url: row.avatar_url || "",
    cover_url: row.cover_url || "",
    social_links: Array.isArray(row.social_links)
      ? (row.social_links as SocialLink[]).filter((l) => l && typeof l.url === "string")
      : [],
    joined_date: row.joined_date || "",
  };
}

function hasChanges(a: Draft, b: Draft): boolean {
  return (
    a.name !== b.name ||
    a.role !== b.role ||
    a.bio !== b.bio ||
    a.location !== b.location ||
    a.avatar_url !== b.avatar_url ||
    a.cover_url !== b.cover_url ||
    a.joined_date !== b.joined_date ||
    JSON.stringify(a.social_links) !== JSON.stringify(b.social_links)
  );
}

/* ─── Component ─── */

export default function AuthorOwnerBar({ authUser, authorRow, onProfileUpdated }: AuthorOwnerBarProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(toDraft(authorRow));
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const openEditor = useCallback(() => {
    setDraft(toDraft(authorRow));
    setSaveMessage(null);
    setEditorOpen(true);
  }, [authorRow]);

  const patchDraft = useCallback((patch: Partial<Draft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  /* Social link helpers */

  function addSocialLink(label: string) {
    if (draft.social_links.some((l) => l.label === label)) return;
    const preset = SOCIAL_PRESETS.find((p) => p.label === label);
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

  /* Save */

  async function handleSave() {
    if (!hasChanges(draft, toDraft(authorRow))) {
      setEditorOpen(false);
      return;
    }
    setSaving(true);
    setSaveMessage(null);

    const success = await updateAuthorBySlug(authorRow.slug, {
      name: draft.name,
      role: draft.role || undefined,
      bio: draft.bio || undefined,
      location: draft.location || undefined,
      avatar_url: draft.avatar_url || undefined,
      cover_url: draft.cover_url || undefined,
      social_links: draft.social_links.length > 0 ? draft.social_links : null,
      joined_date: draft.joined_date || undefined,
    });

    setSaving(false);

    if (success) {
      setSaveMessage({ type: "success", text: "Profile updated!" });
      bustAuthorCache();
      onProfileUpdated();
      setTimeout(() => {
        setEditorOpen(false);
        setSaveMessage(null);
      }, 1200);
    } else {
      setSaveMessage({ type: "error", text: "Failed to save. Try again." });
    }
  }

  const availableSocialLabels = SOCIAL_PRESETS.filter(
    (p) => !draft.social_links.some((l) => l.label === p.label)
  );

  return (
    <>
      {/* ── Owner bar ── */}
      <div className="author-owner-bar">
        <div className="author-owner-bar-inner">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
              <WkIcon name="UserCheck" size={16} />
            </div>
            <div>
              <p className="text-[13px] font-bold text-[var(--wk-text)]">
                You&rsquo;re viewing your author profile
              </p>
              <p className="text-[11px] text-[var(--wk-text-muted)]">
                Signed in as {authUser.email}
              </p>
            </div>
          </div>
          <button
            onClick={openEditor}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--wk-brand)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-brand-on)] hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap"
          >
            <WkIcon name="PenLine" size={14} />
            Edit Profile
          </button>
        </div>
      </div>

      {/* ── Editor modal ── */}
      {editorOpen && (
        <div className="author-editor-overlay" onClick={() => setEditorOpen(false)}>
          <div
            className="author-editor-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="author-editor-header">
              <div>
                <h2 className="text-[18px] font-black tracking-tight text-[var(--wk-text)]">
                  Edit Your Profile
                </h2>
                <p className="mt-0.5 text-[12px] text-[var(--wk-text-muted)]">
                  Changes appear instantly on your public profile.
                </p>
              </div>
              <button
                onClick={() => setEditorOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--wk-border)] text-[var(--wk-text-muted)] hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)] transition-colors cursor-pointer"
              >
                <WkIcon name="X" size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="author-editor-body">
              {/* Name */}
              <div className="author-editor-field">
                <label className="author-editor-label">Display Name</label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => patchDraft({ name: e.target.value })}
                  className="author-editor-input"
                />
              </div>

              {/* Role + Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="author-editor-field">
                  <label className="author-editor-label">Role</label>
                  <input
                    type="text"
                    value={draft.role}
                    onChange={(e) => patchDraft({ role: e.target.value })}
                    placeholder="Contributor, Staff Writer, Editor..."
                    className="author-editor-input"
                  />
                </div>
                <div className="author-editor-field">
                  <label className="author-editor-label">Location</label>
                  <input
                    type="text"
                    value={draft.location}
                    onChange={(e) => patchDraft({ location: e.target.value })}
                    placeholder="Nairobi, Kenya"
                    className="author-editor-input"
                  />
                </div>
              </div>

              {/* Bio */}
              <div className="author-editor-field">
                <label className="author-editor-label">Biography</label>
                <textarea
                  value={draft.bio}
                  onChange={(e) => patchDraft({ bio: e.target.value })}
                  placeholder="Tell readers who you are..."
                  rows={5}
                  className="author-editor-textarea"
                />
                <div className="text-right text-[10px] text-[var(--wk-text-faint)] mt-1">
                  {draft.bio.length} characters
                </div>
              </div>

              {/* Joined Date */}
              <div className="author-editor-field">
                <label className="author-editor-label">Joined Date</label>
                <input
                  type="text"
                  value={draft.joined_date}
                  onChange={(e) => patchDraft({ joined_date: e.target.value })}
                  placeholder="e.g. March 2024"
                  className="author-editor-input max-w-[240px]"
                />
              </div>

              {/* Avatar URL */}
              <div className="author-editor-field">
                <label className="author-editor-label">Avatar URL</label>
                <input
                  type="url"
                  value={draft.avatar_url}
                  onChange={(e) => patchDraft({ avatar_url: e.target.value })}
                  placeholder="https://..."
                  className="author-editor-input font-mono text-[12px]"
                />
              </div>

              {/* Cover URL */}
              <div className="author-editor-field">
                <label className="author-editor-label">Cover Image URL</label>
                <input
                  type="url"
                  value={draft.cover_url}
                  onChange={(e) => patchDraft({ cover_url: e.target.value })}
                  placeholder="https://..."
                  className="author-editor-input font-mono text-[12px]"
                />
              </div>

              {/* Social Links */}
              <div className="author-editor-field">
                <label className="author-editor-label">Social Links</label>
                {draft.social_links.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {draft.social_links.map((link, i) => (
                      <div key={link.label} className="flex items-center gap-2">
                        <div className="flex items-center gap-2 shrink-0 min-w-[110px] rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3 py-2.5">
                          <i className={`${link.icon} text-[14px] text-[var(--wk-text-muted)]`} />
                          <span className="text-[12px] font-semibold text-[var(--wk-text-soft)] whitespace-nowrap">{link.label}</span>
                        </div>
                        <input
                          type="url"
                          value={link.url}
                          onChange={(e) => updateSocialLink(i, e.target.value)}
                          placeholder="https://..."
                          className="flex-1 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3 py-2.5 text-[12px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors font-mono"
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
              </div>
            </div>

            {/* Footer */}
            <div className="author-editor-footer">
              {saveMessage && (
                <div className={`flex items-center gap-2 text-[13px] font-semibold ${saveMessage.type === "success" ? "text-[var(--wk-success)]" : "text-[var(--wk-danger)]"}`}>
                  <WkIcon name={saveMessage.type === "success" ? "CheckCircle2" : "AlertCircle"} size={15} />
                  {saveMessage.text}
                </div>
              )}
              <div className="flex items-center gap-3 ml-auto">
                <button
                  onClick={() => setEditorOpen(false)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-text-soft)] hover:bg-[var(--wk-bg-subtle)] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--wk-brand)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-brand-on)] hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <WkIcon name="Loader2" size={14} className="animate-spin" />
                      Saving&hellip;
                    </>
                  ) : (
                    <>
                      <WkIcon name="Save" size={14} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}