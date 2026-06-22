import { useEffect, useRef, useState } from "react";
import type { UserProfileFields, UsernameAvailability } from "@/hooks/useUserSettings";
import { normalizeUsernameInput } from "@/hooks/useUserSettings";

interface Props {
  profile: UserProfileFields;
  userId: string;
  userInitial: string;
  isSignedIn: boolean;
  updateProfile: (patch: Partial<UserProfileFields>) => void;
  uploadAvatar: (file: File) => Promise<string | null>;
  uploadCover: (file: File) => Promise<string | null>;
  checkUsernameAvailability: (value: string) => Promise<UsernameAvailability>;
}

const coverFallback = "linear-gradient(135deg, #123908 0%, #245714 45%, #86c343 100%)";

export function AccountSettingsPane({
  profile,
  userId,
  userInitial,
  isSignedIn,
  updateProfile,
  uploadAvatar,
  uploadCover,
  checkUsernameAvailability,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);
  const [usernameAvailability, setUsernameAvailability] = useState<UsernameAvailability>({
    status: "idle",
    available: false,
    normalized: "",
    message: "Choose a public handle.",
  });

  useEffect(() => {
    if (!isSignedIn) return;

    const value = profile.username || "";
    setUsernameAvailability((prev) => ({
      ...prev,
      status: value ? "checking" : "idle",
      normalized: normalizeUsernameInput(value),
      message: value ? "Checking handle..." : "Choose a public handle.",
    }));

    const timer = window.setTimeout(async () => {
      const result = await checkUsernameAvailability(value);
      setUsernameAvailability(result);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [profile.username, isSignedIn, checkUsernameAvailability]);

  const handleAvatarClick = () => fileRef.current?.click();
  const handleCoverClick = () => coverFileRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image must be under 5MB");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadAvatar(file);
      if (url) updateProfile({ avatarUrl: url });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setCoverUploading(true);
    setCoverUploadError(null);
    try {
      const url = await uploadCover(file);
      if (url) updateProfile({ coverUrl: url });
    } catch (err) {
      setCoverUploadError(err instanceof Error ? err.message : "Cover upload failed");
    } finally {
      setCoverUploading(false);
    }
  };

  const handleUsernameChange = (value: string) => {
    updateProfile({ username: normalizeUsernameInput(value) });
  };

  const usernameStatusClass =
    usernameAvailability.status === "available" || usernameAvailability.status === "current"
      ? "text-[var(--wk-success)]"
      : usernameAvailability.status === "checking" || usernameAvailability.status === "idle"
        ? "text-[var(--wk-text-faint)]"
        : "text-[var(--wk-danger)]";

  return (
    <div>
      {/* Cover photo */}
      <div className="mb-6">
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)] mb-2">
          Cover photo
        </div>
        <div
          className="relative aspect-[8/3] min-h-[190px] overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface-raised)]"
          style={{ background: profile.coverUrl ? undefined : coverFallback }}
        >
          {profile.coverUrl && (
            <img
              src={profile.coverUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/35" />
          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-end justify-between gap-3">
            <div className="max-w-[520px]">
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/80">
                Public profile cover
              </div>
              <p className="mt-1 text-xs font-medium leading-relaxed text-white/80">
                Recommended 2400×900px. Minimum 1600×600px. Accepted aspect ratio 2.4:1 to 3.2:1. JPG, PNG, or WebP. Max 8MB.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCoverClick}
                disabled={coverUploading || !isSignedIn}
                className="h-9 rounded-full bg-white px-4 text-xs font-black text-black shadow-sm disabled:opacity-60"
              >
                {coverUploading ? "Uploading..." : profile.coverUrl ? "Change cover" : "Upload cover"}
              </button>
              {profile.coverUrl && (
                <button
                  onClick={() => updateProfile({ coverUrl: null })}
                  disabled={coverUploading || !isSignedIn}
                  className="h-9 rounded-full bg-black/45 px-4 text-xs font-black text-white backdrop-blur disabled:opacity-60"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
        <input
          ref={coverFileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleCoverFileChange}
          className="hidden"
        />
        {coverUploadError && <p className="mt-2 text-[11px] font-bold text-[var(--wk-danger)]">{coverUploadError}</p>}
      </div>

      {/* Avatar */}
      <div className="mb-6">
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)] mb-2">Profile picture</div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleAvatarClick}
            disabled={uploading || !isSignedIn}
            className="w-[80px] h-[80px] rounded-full overflow-hidden border-2 border-[var(--wk-border)] bg-[var(--wk-surface-raised)] cursor-pointer relative group shrink-0"
          >
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[28px] font-black text-[var(--wk-brand)]">
                {userInitial}
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <i className="ri-camera-line text-white text-xl" />
            </div>
          </button>
          <div>
            <button
              onClick={handleAvatarClick}
              disabled={uploading || !isSignedIn}
              className="text-xs font-bold text-[var(--wk-brand)] hover:underline cursor-pointer mb-1 block"
            >
              {uploading ? "Uploading..." : "Change photo"}
            </button>
            {profile.avatarUrl && (
              <button
                onClick={() => updateProfile({ avatarUrl: null })}
                className="text-[11px] text-[var(--wk-text-faint)] hover:text-[var(--wk-danger)] cursor-pointer"
              >
                Remove photo
              </button>
            )}
            <p className="text-[10px] text-[var(--wk-text-faint)] mt-1">JPG, PNG, WebP. Max 5MB.</p>
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
        </div>
        {uploadError && <p className="text-[11px] text-[var(--wk-danger)] mt-2">{uploadError}</p>}
      </div>

      {/* Profile fields */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <label className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)] block mb-1.5">Display name</label>
          <input
            className="w-full h-[42px] px-3 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] text-[var(--wk-text)] text-sm font-medium focus:outline-none focus:border-[var(--wk-brand)] transition-colors"
            value={profile.displayName}
            onChange={(e) => updateProfile({ displayName: e.target.value })}
            placeholder="Your public name"
            disabled={!isSignedIn}
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)] block mb-1.5">Handle</label>
          <div className="flex h-[42px] overflow-hidden rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] focus-within:border-[var(--wk-brand)] transition-colors">
            <span className="flex items-center px-3 text-sm font-black text-[var(--wk-text-faint)]">@</span>
            <input
              className="min-w-0 flex-1 bg-transparent pr-3 text-sm font-medium text-[var(--wk-text)] focus:outline-none"
              value={profile.username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              placeholder="your_handle"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={!isSignedIn}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <p className={`text-[10px] font-bold ${usernameStatusClass}`}>
              {usernameAvailability.message}
            </p>
            {usernameAvailability.normalized && (
              <span className="shrink-0 text-[10px] text-[var(--wk-text-faint)]">
                /u/{usernameAvailability.normalized}
              </span>
            )}
          </div>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)] block mb-1.5">Country</label>
          <input
            className="w-full h-[42px] px-3 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] text-[var(--wk-text)] text-sm font-medium focus:outline-none focus:border-[var(--wk-brand)] transition-colors"
            value={profile.country}
            onChange={(e) => updateProfile({ country: e.target.value })}
            placeholder="e.g. Kenya"
            disabled={!isSignedIn}
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)] block mb-1.5">City</label>
          <input
            className="w-full h-[42px] px-3 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] text-[var(--wk-text)] text-sm font-medium focus:outline-none focus:border-[var(--wk-brand)] transition-colors"
            value={profile.city}
            onChange={(e) => updateProfile({ city: e.target.value })}
            placeholder="e.g. Nairobi"
            disabled={!isSignedIn}
          />
        </div>
        <div className="col-span-2 sm:col-span-1" />
        <div className="col-span-2">
          <label className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)] block mb-1.5">Bio</label>
          <textarea
            className="w-full min-h-[100px] px-3 py-2.5 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] text-[var(--wk-text)] text-sm leading-relaxed resize-y focus:outline-none focus:border-[var(--wk-brand)] transition-colors"
            value={profile.bio}
            onChange={(e) => updateProfile({ bio: e.target.value })}
            placeholder="Tell the WAKILISHA community about yourself..."
            maxLength={300}
            disabled={!isSignedIn}
          />
          <p className="text-[10px] text-[var(--wk-text-faint)] mt-1 text-right">{profile.bio.length}/300</p>
        </div>
      </div>
    </div>
  );
}
