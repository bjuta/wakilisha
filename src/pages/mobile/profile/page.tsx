import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthUser } from "@/hooks/useAuthUser";
import { WkIcon } from "@/components/design-system/Icon";
import { supabase } from "@/lib/supabase";
import {
  getUserComments,
  getUserReplies,
  getUserSaves,
  getUserFollows,
  getUserProfileWithStats,
  hydrateCommentsWithUserState,
} from "@/services/community";
import type { CommunityComment, CommunityProfile } from "@/services/community";

type Tab = "Following" | "Saves" | "Comments" | "Replies" | "Account";
const tabs: Tab[] = ["Following", "Saves", "Comments", "Replies", "Account"];

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function entityLabel(type: string): string {
  const map: Record<string, string> = {
    article: "Article", artist: "Artist", track: "Track", release: "Release",
    label: "Label", genre: "Genre", chart: "Chart", chart_edition: "Chart",
    field_guide: "Guide", magazine_issue: "Issue", briefing_issue: "Briefing",
    profile: "Profile", comment: "Comment",
  };
  return map[type] || type;
}


type ProfileEntityRecord = Record<string, unknown>;

function recordText(row: ProfileEntityRecord, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text && text !== "null" && text !== "undefined") return text;
  }
  return fallback;
}

function titleFromSlug(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function entityTitle(row: ProfileEntityRecord, slugKey = "entity_slug"): string {
  return recordText(row, ["title", "entity_title", "target_title", "name"], "") ||
    titleFromSlug(recordText(row, [slugKey, "target_slug", "slug"], "Saved item"));
}

function entityImage(row: ProfileEntityRecord): string {
  return recordText(row, [
    "image_url",
    "imageUrl",
    "target_image_url",
    "targetImageUrl",
    "public_image_url",
    "artwork_url",
    "cover_url",
    "avatar_url",
  ]);
}

function entityCreatedAt(row: ProfileEntityRecord): string {
  return recordText(row, ["created_at", "createdAt"]);
}

function followUrl(row: ProfileEntityRecord): string {
  const type = recordText(row, ["target_type"]);
  const slug = recordText(row, ["target_slug"]);
  const urlMap: Record<string, string> = {
    article: `/magazine/${slug}`,
    artist: `/artists/${slug}`,
    track: `/tracks/${slug}`,
    release: `/releases/${slug}`,
    label: `/labels/${slug}`,
    genre: `/genres/${slug}`,
    chart: `/charts/${slug}`,
    chart_edition: `/charts/${slug}`,
    field_guide: `/guides/${slug}`,
    magazine_issue: `/magazine/issue/${slug}`,
  };
  return urlMap[type] || "#";
}

async function enrichFollowEntities(rows: ProfileEntityRecord[]): Promise<ProfileEntityRecord[]> {
  const artistSlugs = Array.from(new Set(
    rows
      .filter((row) => recordText(row, ["target_type"]) === "artist")
      .map((row) => recordText(row, ["target_slug"]))
      .filter(Boolean)
  ));

  if (artistSlugs.length === 0) return rows;

  const { data, error } = await supabase
    .from("registry_artists")
    .select("slug, name, public_image_url")
    .eq("status", "active")
    .in("slug", artistSlugs);

  if (error || !data) return rows;

  const artistBySlug = new Map(
    (data as Array<{ slug: string; name: string | null; public_image_url: string | null }>)
      .map((artist) => [artist.slug, artist])
  );

  return rows.map((row) => {
    const slug = recordText(row, ["target_slug"]);
    const artist = artistBySlug.get(slug);
    if (!artist) return row;

    return {
      ...row,
      target_title: recordText(row, ["target_title"]) || artist.name || titleFromSlug(slug),
      target_image_url: entityImage(row) || artist.public_image_url || "",
    };
  });
}

function getCoverColor(): string {
  try {
    return localStorage.getItem("wk-cover-color") || "#1a3a0a";
  } catch {
    return "#1a3a0a";
  }
}

function coverGradient(color: string): string {
  return `linear-gradient(135deg, ${color} 0%, ${adjustBrightness(color, 30)} 40%, ${adjustBrightness(color, 50)} 100%)`;
}

function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (num >> 16) + percent);
  const g = Math.min(255, ((num >> 8) & 0x00FF) + percent);
  const b = Math.min(255, (num & 0x0000FF) + percent);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export default function MobileProfilePage() {
  const authUser = useAuthUser();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("Following");
  const [coverColor] = useState(() => getCoverColor());

  const isSignedIn = !authUser.loading && !!authUser.id;
  const userId = authUser.id;
  const fallbackDisplayName = authUser.name || authUser.email?.split("@")[0] || "Reader";
  const userEmail = authUser.email || "";

  const [commProfile, setCommProfile] = useState<CommunityProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [replies, setReplies] = useState<CommunityComment[]>([]);
  const [saves, setSaves] = useState<Record<string, unknown>[]>([]);
  const [follows, setFollows] = useState<Record<string, unknown>[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState<string | null>(null);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  useEffect(() => {
    if (!userId) {
      setProfileLoading(false);
      return;
    }
    getUserProfileWithStats(userId)
      .then((p) => setCommProfile(p))
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setSaves([]);
      setFollows([]);
      return;
    }

    let alive = true;

    Promise.all([
      getUserSaves(userId).catch(() => []),
      getUserFollows(userId)
        .then((rows) => enrichFollowEntities(rows as ProfileEntityRecord[]))
        .catch(() => []),
    ]).then(([saveRows, followRows]) => {
      if (!alive) return;
      setSaves(saveRows as ProfileEntityRecord[]);
      setFollows(followRows as ProfileEntityRecord[]);
    });

    return () => {
      alive = false;
    };
  }, [userId]);


  const loadTabData = useCallback(
    async (activeTab: Tab) => {
      if (!userId) return;
      setTabLoading(true);
      setTabError(null);
      try {
        switch (activeTab) {
          case "Comments": {
            const raw = await getUserComments(userId, 30);
            const hydrated = await hydrateCommentsWithUserState(raw, userId);
            setComments(hydrated);
            break;
          }
          case "Replies": {
            const raw = await getUserReplies(userId, 30);
            const hydrated = await hydrateCommentsWithUserState(raw, userId);
            setReplies(hydrated);
            break;
          }
          case "Saves": {
            const data = await getUserSaves(userId);
            setSaves(data);
            break;
          }
          case "Following": {
            const data = await getUserFollows(userId);
            const enriched = await enrichFollowEntities(data as ProfileEntityRecord[]);
            setFollows(enriched);
            break;
          }
        }
      } catch (e) {
        setTabError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setTabLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    if (tab !== "Account") loadTabData(tab);
  }, [tab, loadTabData]);

  const statsCommentCount = Math.max(commProfile?.commentCount ?? 0, comments.length);
  const statsSaveCount = saves.length;
  const statsFollowCount = follows.length;
  const profileUsername =
    commProfile?.username && commProfile.username !== "undefined"
      ? commProfile.username
      : "";
  const profileDisplayName = commProfile?.displayName || fallbackDisplayName;
  const profileAvatarUrl = commProfile?.avatarUrl || authUser.avatarUrl || null;
  const profileInitial = profileDisplayName[0]?.toUpperCase() || "W";
  const profileCoverUrl = commProfile?.coverUrl || null;

  return (
    <div className="min-h-[100dvh]" style={{ background: "var(--wk-bg)", color: "var(--wk-text)" }}>
      {/* Cover */}
      <div
        className="w-full h-[140px] relative overflow-hidden"
        style={{ background: profileCoverUrl ? "var(--wk-surface-raised)" : coverGradient(coverColor) }}
      >
        {profileCoverUrl && (
          <img src={profileCoverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/25" />
        {/* Back chevron */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/25 text-white/90 cursor-pointer"
        >
          <i className="ri-arrow-left-line text-lg" />
        </button>
        {/* Settings gear */}
        <Link
          to="/settings"
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/25 text-white/90"
        >
          <i className="ri-settings-3-line text-lg" />
        </Link>
      </div>

      {/* Profile header — overlaps cover */}
      <div className="px-5 -mt-12 relative z-10">
        {/* Avatar */}
        <div className="flex justify-center mb-3">
          <div
            className="w-[96px] h-[96px] rounded-full border-[4px] overflow-hidden shrink-0"
            style={{ borderColor: "var(--wk-bg)", background: "var(--wk-surface-raised)" }}
          >
            {profileAvatarUrl ? (
              <img src={profileAvatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[32px] font-black" style={{ color: "var(--wk-brand)" }}>
                {profileInitial}
              </div>
            )}
          </div>
        </div>

        {/* Name & handle */}
        <div className="text-center mb-2">
          {authUser.loading ? (
            <div className="space-y-2">
              <div className="h-6 w-36 mx-auto rounded animate-pulse" style={{ background: "var(--wk-surface-raised)" }} />
              <div className="h-4 w-24 mx-auto rounded animate-pulse" style={{ background: "var(--wk-surface-raised)" }} />
            </div>
          ) : (
            <>
              <h1 className="text-xl font-black tracking-[-0.02em]" style={{ color: "var(--wk-text)" }}>
                {isSignedIn ? profileDisplayName : "WAKILISHA Reader"}
              </h1>
              <p className="text-[13px] font-semibold mt-0.5" style={{ color: "var(--wk-text-muted)" }}>
                {profileUsername ? `@${profileUsername}` : (isSignedIn ? userEmail : "Sign in to customize")}
              </p>
            </>
          )}
        </div>

        {/* Bio */}
        {commProfile?.bio ? (
          <p className="text-[13px] leading-relaxed text-center max-w-[320px] mx-auto mb-3" style={{ color: "var(--wk-text-soft)" }}>
            {commProfile.bio}
          </p>
        ) : isSignedIn && !profileLoading ? (
          <p className="text-[13px] leading-relaxed text-center max-w-[320px] mx-auto mb-3" style={{ color: "var(--wk-text-faint)" }}>
            Your profile saves reading history, followed artists, and chart preferences.
          </p>
        ) : null}

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {isSignedIn ? (
            <>
              <Link
                to="/settings"
                className="inline-flex items-center gap-1.5 h-[34px] px-4 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer"
                style={{ background: "var(--wk-surface-raised)", color: "var(--wk-text)", border: "1px solid var(--wk-border)" }}
              >
                <i className="ri-pencil-line text-[13px]" /> Edit profile
              </Link>
              {profileUsername && (
                <Link
                  to={`/u/${profileUsername}`}
                  className="inline-flex items-center gap-1.5 h-[34px] px-4 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer"
                  style={{ background: "var(--wk-surface-raised)", color: "var(--wk-text)", border: "1px solid var(--wk-border)" }}
                >
                  <i className="ri-share-line text-[13px]" /> Share
                </Link>
              )}
            </>
          ) : (
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 h-[36px] px-6 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer"
              style={{ background: "var(--wk-brand)", color: "var(--wk-brand-on)" }}
            >
              Sign in
            </Link>
          )}
        </div>

        {/* Stats row — IG style */}
        <div className="flex items-center justify-center gap-8 pb-4 mb-1 border-b" style={{ borderColor: "var(--wk-divider)" }}>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-lg font-black tabular-nums" style={{ color: "var(--wk-text)" }}>
              {statsCommentCount}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--wk-text-faint)" }}>
              Comments
            </span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-lg font-black tabular-nums" style={{ color: "var(--wk-text)" }}>
              {statsSaveCount}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--wk-text-faint)" }}>
              Saves
            </span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-lg font-black tabular-nums" style={{ color: "var(--wk-text)" }}>
              {statsFollowCount}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--wk-text-faint)" }}>
              Following
            </span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-lg font-black tabular-nums" style={{ color: "var(--wk-text)" }}>
              {commProfile ? commProfile.reputationScore : "—"}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--wk-text-faint)" }}>
              Rep
            </span>
          </div>
        </div>
      </div>

      {/* Tab bar — segmented control style */}
      <div className="px-4 pt-2 pb-0">
        <div className="flex overflow-x-auto gap-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
          {tabs.map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`shrink-0 px-4 py-2 rounded-full text-[12px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
                tab === item
                  ? ""
                  : ""
              }`}
              style={
                tab === item
                  ? { background: "var(--wk-text)", color: "var(--wk-bg)" }
                  : { background: "var(--wk-surface-raised)", color: "var(--wk-text-muted)", border: "1px solid var(--wk-border)" }
              }
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 pt-3 pb-24">
        {!isSignedIn && tab !== "Account" ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: "var(--wk-surface-raised)" }}>
              <i className="ri-chat-3-line text-2xl" style={{ color: "var(--wk-text-faint)" }} />
            </div>
            <p className="text-sm font-bold mb-3" style={{ color: "var(--wk-text-muted)" }}>
              Sign in to see your community activity
            </p>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer"
              style={{ color: "var(--wk-brand)" }}
            >
              Sign in <i className="ri-arrow-right-line" />
            </Link>
          </div>
        ) : tab === "Comments" ? (
          <MobileCommentsTab comments={comments} loading={tabLoading} error={tabError} onRetry={() => loadTabData("Comments")} />
        ) : tab === "Replies" ? (
          <MobileRepliesTab replies={replies} loading={tabLoading} error={tabError} onRetry={() => loadTabData("Replies")} />
        ) : tab === "Saves" ? (
          <MobileSavesTab saves={saves} loading={tabLoading} error={tabError} onRetry={() => loadTabData("Saves")} />
        ) : tab === "Following" ? (
          <MobileFollowingTab follows={follows} loading={tabLoading} error={tabError} onRetry={() => loadTabData("Following")} />
        ) : (
          <MobileAccountTab isSignedIn={isSignedIn} userEmail={userEmail} onSignOut={handleSignOut} />
        )}
      </div>
    </div>
  );
}

/* ─── Comments Tab (Mobile) ─── */
function MobileCommentsTab({
  comments, loading, error, onRetry,
}: { comments: CommunityComment[]; loading: boolean; error: string | null; onRetry: () => void }) {
  if (loading) {
    return <MobileSkeletonList count={4} />;
  }
  if (error) {
    return <MobileErrorState message={error} onRetry={onRetry} />;
  }
  if (comments.length === 0) {
    return (
      <MobileEmptyState
        icon="ri-chat-3-line"
        title="No comments yet"
        action={{ label: "Browse articles", to: "/magazine" }}
      />
    );
  }
  return (
    <div className="space-y-1.5">
      {comments.map((c) => (
        <div key={c.id} className="p-3.5 rounded-xl border" style={{ borderColor: "var(--wk-border)", background: "var(--wk-surface)" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px]" style={{ color: "var(--wk-text-faint)" }}>{timeAgo(c.createdAt)}</span>
            {c.isEditorPick && (
              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: "var(--wk-warning-soft)", color: "var(--wk-warning)" }}>
                Editor Pick
              </span>
            )}
          </div>
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words line-clamp-4" style={{ color: "var(--wk-text-soft)" }}>
            {c.bodyMarkdown}
          </p>
          <div className="flex items-center gap-4 mt-2 text-[11px]" style={{ color: "var(--wk-text-muted)" }}>
            <span className="flex items-center gap-1"><i className="ri-arrow-up-line text-xs" /> {c.upvoteCount}</span>
            <span className="flex items-center gap-1"><i className="ri-chat-3-line text-xs" /> {c.replyCount} {c.replyCount === 1 ? "reply" : "replies"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Replies Tab (Mobile) ─── */
function MobileRepliesTab({
  replies, loading, error, onRetry,
}: { replies: CommunityComment[]; loading: boolean; error: string | null; onRetry: () => void }) {
  if (loading) return <MobileSkeletonList count={3} />;
  if (error) return <MobileErrorState message={error} onRetry={onRetry} />;
  if (replies.length === 0) {
    return (
      <MobileEmptyState
        icon="ri-reply-line"
        title="No replies yet"
        subtitle="When someone replies to your comments, they'll show up here."
      />
    );
  }
  return (
    <div className="space-y-1.5">
      {replies.map((r) => (
        <div key={r.id} className="p-3.5 rounded-xl border" style={{ borderColor: "var(--wk-border)", background: "var(--wk-surface)" }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full overflow-hidden shrink-0 flex items-center justify-center" style={{ background: "var(--wk-surface-raised)" }}>
              {r.author?.avatarUrl ? (
                <img src={r.author.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <i className="ri-user-line text-[9px]" style={{ color: "var(--wk-text-faint)" }} />
              )}
            </div>
            <span className="text-xs font-bold" style={{ color: "var(--wk-text)" }}>
              {r.author?.displayName || r.author?.username || "Anonymous"}
            </span>
            <span className="text-[11px]" style={{ color: "var(--wk-text-faint)" }}>replied {timeAgo(r.createdAt)}</span>
          </div>
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words line-clamp-3" style={{ color: "var(--wk-text-soft)" }}>
            {r.bodyMarkdown}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ─── Image-led profile entity cards ─── */
function MobileEntityArtwork({
  imageUrl,
  title,
  type,
  tall = false,
}: {
  imageUrl: string;
  title: string;
  type: string;
  tall?: boolean;
}) {
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "WK";

  return (
    <div className={`relative overflow-hidden rounded-[22px] ${tall ? "aspect-[3/4]" : "aspect-[4/5]"}`} style={{ background: "var(--wk-surface-raised)" }}>
      {imageUrl ? (
        <img src={imageUrl} alt={title} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3"
          style={{
            background: "linear-gradient(135deg, var(--wk-brand-soft) 0%, var(--wk-surface-raised) 52%, var(--wk-bg) 100%)",
            color: "var(--wk-brand)",
          }}
        >
          <i className={`${iconForTargetType(type)} text-3xl`} />
          <span className="text-2xl font-black tracking-[-0.04em]">{initials}</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/18 to-transparent" />
      <div className="absolute left-3 top-3 rounded-full bg-black/35 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white/85 backdrop-blur-md">
        {entityLabel(type)}
      </div>
    </div>
  );
}

/* ─── Saves Tab (Mobile — image-first culture shelf) ─── */
function MobileSavesTab({
  saves, loading, error, onRetry,
}: { saves: Record<string, unknown>[]; loading: boolean; error: string | null; onRetry: () => void }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-[4/5] rounded-[22px] animate-pulse" style={{ background: "var(--wk-surface-raised)" }} />
        ))}
      </div>
    );
  }
  if (error) return <MobileErrorState message={error} onRetry={onRetry} />;
  if (saves.length === 0) {
    return (
      <MobileEmptyState
        icon="ri-bookmark-line"
        title="No saved items"
        subtitle="Save artists, releases, tracks, and stories to build your culture shelf."
        action={{ label: "Browse magazine", to: "/magazine" }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] mb-1" style={{ color: "var(--wk-brand)" }}>
          Saved shelf
        </p>
        <p className="text-[12px] leading-relaxed" style={{ color: "var(--wk-text-muted)" }}>
          Things you kept close for later.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {saves.map((raw) => {
          const save = raw as ProfileEntityRecord;
          const entityUrl = recordText(save, ["entity_url"], "#");
          const entityType = recordText(save, ["entity_type"]);
          const title = entityTitle(save);
          const imageUrl = entityImage(save);
          const createdAt = entityCreatedAt(save);

          return (
            <Link
              key={String(save.id)}
              to={entityUrl || "#"}
              className="group block min-w-0 cursor-pointer"
            >
              <MobileEntityArtwork imageUrl={imageUrl} title={title} type={entityType} />
              <div className="pt-2 px-1">
                <div className="text-[13px] font-black leading-tight line-clamp-2" style={{ color: "var(--wk-text)" }}>
                  {title}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--wk-text-faint)" }}>
                  <span>{entityLabel(entityType)}</span>
                  {createdAt && (
                    <>
                      <span>·</span>
                      <span>{timeAgo(createdAt)}</span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Following Tab (Mobile — image-first people/entities) ─── */
function MobileFollowingTab({
  follows, loading, error, onRetry,
}: { follows: Record<string, unknown>[]; loading: boolean; error: string | null; onRetry: () => void }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] rounded-[24px] animate-pulse" style={{ background: "var(--wk-surface-raised)" }} />
        ))}
      </div>
    );
  }
  if (error) return <MobileErrorState message={error} onRetry={onRetry} />;
  if (follows.length === 0) {
    return (
      <MobileEmptyState
        icon="ri-user-add-line"
        title="Not following yet"
        subtitle="Follow artists, labels, charts, and scenes to shape your WAKILISHA feed."
        action={{ label: "Find artists", to: "/artists" }}
      />
    );
  }

  const [lead, ...rest] = follows as ProfileEntityRecord[];

  const renderFollowCard = (follow: ProfileEntityRecord, featured = false) => {
    const targetType = recordText(follow, ["target_type"]);
    const targetSlug = recordText(follow, ["target_slug"]);
    const createdAt = entityCreatedAt(follow);
    const title = entityTitle(follow, "target_slug") || titleFromSlug(targetSlug);
    const imageUrl = entityImage(follow);
    const url = followUrl(follow);

    return (
      <Link
        key={String(follow.id)}
        to={url}
        className={`group block min-w-0 cursor-pointer ${featured ? "col-span-2" : ""}`}
      >
        <div className="relative">
          <MobileEntityArtwork imageUrl={imageUrl} title={title} type={targetType} tall={featured} />
          {featured && (
            <div className="absolute bottom-4 left-4 right-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/65">
                Recently followed
              </p>
              <h3 className="mt-1 text-2xl font-black tracking-[-0.05em] leading-none text-white">
                {title}
              </h3>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/65">
                {entityLabel(targetType)}{createdAt ? ` · ${timeAgo(createdAt)}` : ""}
              </p>
            </div>
          )}
        </div>

        {!featured && (
          <div className="pt-2 px-1">
            <div className="text-[13px] font-black leading-tight line-clamp-2" style={{ color: "var(--wk-text)" }}>
              {title}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--wk-text-faint)" }}>
              <span>{entityLabel(targetType)}</span>
              {createdAt && (
                <>
                  <span>·</span>
                  <span>{timeAgo(createdAt)}</span>
                </>
              )}
            </div>
          </div>
        )}
      </Link>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] mb-1" style={{ color: "var(--wk-brand)" }}>
          Your circle
        </p>
        <p className="text-[12px] leading-relaxed" style={{ color: "var(--wk-text-muted)" }}>
          Artists and culture threads you want WAKILISHA to remember.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {lead && renderFollowCard(lead, true)}
        {rest.map((follow) => renderFollowCard(follow))}
      </div>
    </div>
  );
}

function iconForTargetType(type: string): string {
  const map: Record<string, string> = {
    article: "ri-article-line", artist: "ri-mic-line", track: "ri-music-line",
    release: "ri-disc-line", label: "ri-building-line", genre: "ri-price-tag-3-line",
    chart: "ri-bar-chart-line", chart_edition: "ri-bar-chart-line",
    field_guide: "ri-book-open-line", magazine_issue: "ri-pages-line", profile: "ri-user-line",
  };
  return map[type] || "ri-link";
}

/* ─── Account Tab (Mobile) ─── */
function MobileAccountTab({
  isSignedIn, userEmail, onSignOut,
}: { isSignedIn: boolean; userEmail: string; onSignOut: () => void }) {
  return (
    <div className="space-y-4">
      {/* Preferences */}
      <div className="rounded-xl border p-4" style={{ borderColor: "var(--wk-border)", background: "var(--wk-surface)" }}>
        <p className="text-[10px] font-black uppercase tracking-[0.14em] mb-3" style={{ color: "var(--wk-brand)" }}>
          Preferences
        </p>
        <Link
          to="/settings"
          className="flex items-center gap-3 py-3 border-b cursor-pointer"
          style={{ borderColor: "var(--wk-divider)" }}
        >
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--wk-surface-raised)" }}>
            <i className="ri-settings-3-line text-base" style={{ color: "var(--wk-text-muted)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold" style={{ color: "var(--wk-text)" }}>Full settings</div>
            <div className="text-[11px]" style={{ color: "var(--wk-text-muted)" }}>Privacy, playback, notifications</div>
          </div>
          <i className="ri-arrow-right-s-line" style={{ color: "var(--wk-text-faint)" }} />
        </Link>
        <Link
          to="/search"
          className="flex items-center gap-3 py-3 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--wk-surface-raised)" }}>
            <i className="ri-search-line text-base" style={{ color: "var(--wk-text-muted)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold" style={{ color: "var(--wk-text)" }}>Discover</div>
            <div className="text-[11px]" style={{ color: "var(--wk-text-muted)" }}>Browse artists, charts & guides</div>
          </div>
          <i className="ri-arrow-right-s-line" style={{ color: "var(--wk-text-faint)" }} />
        </Link>
      </div>

      {/* Account */}
      <div className="rounded-xl border p-4" style={{ borderColor: "var(--wk-border)", background: "var(--wk-surface)" }}>
        <p className="text-[10px] font-black uppercase tracking-[0.14em] mb-3" style={{ color: "var(--wk-brand)" }}>
          Account
        </p>
        {isSignedIn ? (
          <button onClick={onSignOut} className="flex items-center gap-3 py-3 w-full text-left cursor-pointer">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--wk-surface-raised)" }}>
              <i className="ri-logout-box-line text-base" style={{ color: "var(--wk-text-muted)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold" style={{ color: "var(--wk-text)" }}>Sign out</div>
              <div className="text-[11px] truncate" style={{ color: "var(--wk-text-muted)" }}>{userEmail}</div>
            </div>
            <i className="ri-arrow-right-s-line" style={{ color: "var(--wk-text-faint)" }} />
          </button>
        ) : (
          <Link to="/auth" className="flex items-center gap-3 py-3 cursor-pointer">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--wk-surface-raised)" }}>
              <i className="ri-login-box-line text-base" style={{ color: "var(--wk-text-muted)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold" style={{ color: "var(--wk-text)" }}>Sign in</div>
              <div className="text-[11px]" style={{ color: "var(--wk-text-muted)" }}>Sync profile and saves</div>
            </div>
            <i className="ri-arrow-right-s-line" style={{ color: "var(--wk-text-faint)" }} />
          </Link>
        )}
      </div>

      {/* Profile info */}
      {isSignedIn && (
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--wk-border)", background: "var(--wk-surface)" }}>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] mb-3" style={{ color: "var(--wk-brand)" }}>
            Profile info
          </p>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 text-[12px]" style={{ color: "var(--wk-text)" }}>
              <i className="ri-at-line text-sm" style={{ color: "var(--wk-text-muted)" }} />
              <span className="truncate">{userEmail}</span>
            </div>
            <div className="flex items-center gap-3 text-[12px]" style={{ color: "var(--wk-text)" }}>
              <i className="ri-global-line text-sm" style={{ color: "var(--wk-text-muted)" }} />
              <span>wakilisha.africa</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Shared mobile sub-components ─── */

function MobileSkeletonList({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border p-4 space-y-2" style={{ borderColor: "var(--wk-border)" }}>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full" style={{ background: "var(--wk-surface-raised)" }} />
            <div className="h-3 w-20 rounded" style={{ background: "var(--wk-surface-raised)" }} />
          </div>
          <div className="h-4 w-3/4 rounded" style={{ background: "var(--wk-surface-raised)" }} />
        </div>
      ))}
    </div>
  );
}

function MobileErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="py-12 text-center">
      <div className="w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center" style={{ background: "var(--wk-surface-raised)" }}>
        <i className="ri-error-warning-line text-xl" style={{ color: "var(--wk-text-faint)" }} />
      </div>
      <p className="text-sm font-bold mb-3" style={{ color: "var(--wk-text-muted)" }}>{message}</p>
      <button onClick={onRetry} className="text-xs font-bold cursor-pointer" style={{ color: "var(--wk-brand)" }}>
        Try again
      </button>
    </div>
  );
}

function MobileEmptyState({
  icon, title, subtitle, action,
}: { icon: string; title: string; subtitle?: string; action?: { label: string; to: string } }) {
  return (
    <div className="py-16 text-center">
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: "var(--wk-surface-raised)" }}>
        <i className={`${icon} text-2xl`} style={{ color: "var(--wk-text-faint)" }} />
      </div>
      <p className="text-sm font-bold mb-2" style={{ color: "var(--wk-text-muted)" }}>{title}</p>
      {subtitle && (
        <p className="text-xs max-w-[240px] mx-auto mb-4" style={{ color: "var(--wk-text-faint)" }}>{subtitle}</p>
      )}
      {action && (
        <Link
          to={action.to}
          className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer"
          style={{ color: "var(--wk-brand)" }}
        >
          {action.label} <i className="ri-arrow-right-line" />
        </Link>
      )}
    </div>
  );
}