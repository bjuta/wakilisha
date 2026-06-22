import { useRef, useState } from "react";
import type { UserProfileFields } from "@/hooks/useUserSettings";

interface Props {
  profile: UserProfileFields;
  userId: string;
  userInitial: string;
  isSignedIn: boolean;
  updateProfile: (patch: Partial<UserProfileFields>) => void;
  uploadAvatar: (file: File) => Promise<string | null>;
}

const coverSwatches = [
  { label: "Forest", value: "#1a3a0a" },
  { label: "Midnight", value: "#0a1a2a" },
  { label: "Burgundy", value: "#2a0a1a" },
  { label: "Charcoal", value: "#1a1a1a" },
  { label: "Olive", value: "#2a3a0a" },
  { label: "Slate", value: "#0a1a2a" },
];

export function AccountSettingsPane({ profile, userId, userInitial, isSignedIn, updateProfile, uploadAvatar }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [coverColor, setCoverColor] = useState(() => {
    try {
      return localStorage.getItem("wk-cover-color") || "#1a3a0a";
    } catch {
      return "#1a3a0a";
    }
  });

  const handleAvatarClick = () => fileRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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

  const handleCoverColorChange = (color: string) => {
    setCoverColor(color);
    try { localStorage.setItem("wk-cover-color", color); } catch { /* noop */ }
  };

  return (
    <div>
      {/* Cover color picker */}
      <div className="mb-6">
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)] mb-2">Cover color</div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {coverSwatches.map((sw) => (
            <button
              key={sw.value}
              onClick={() => handleCoverColorChange(sw.value)}
              className="w-10 h-10 rounded-full border-2 cursor-pointer transition-transform hover:scale-110"
              style={{
                background: sw.value,
                borderColor: coverColor === sw.value ? "var(--wk-text)" : sw.value,
              }}
              aria-label={`Cover color: ${sw.label}`}
            />
          ))}
        </div>
        <p className="text-[11px] text-[var(--wk-text-faint)] mt-2">Changes apply immediately to your profile cover. Pick a vibe.</p>
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
            <p className="text-[10px] text-[var(--wk-text-faint)] mt-1">JPG, PNG. Max 5MB.</p>
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