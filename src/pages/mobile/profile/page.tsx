import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthUser } from "@/hooks/useAuthUser";
import { WkIcon } from "@/components/design-system/Icon";
import { PlaylistCoverPresentation } from "@/components/media/PlaylistCoverPresentation";
import { supabase } from "@/lib/supabase";
import {
  getUserComments,
  getUserReplies,
  getUserSaves,
  getUserFollowing,
  getUserProfileWithStats,
  hydrateCommentsWithUserState,
  softDeleteComment,
  updateComment,
} from "@/services/community";
import type { CommunityComment, CommunityProfile } from "@/services/community";
import {
  followingTargetIcon,
  followingTargetLabel,
  type FollowingPresentationItem,
} from "@/services/community/followingPresentation";
import {
  formatListeningProgress,
  getListeningHistory,
  type ListeningHistoryItem,
} from "@/services/listeningHistory";

type Tab = "Listening" | "Following" | "Saves" | "Comments" | "Replies" | "Account";
const tabs: Tab[] = ["Listening", "Following", "Saves", "Comments", "Replies", "Account"];

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

function formatExactTimestamp(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat("en-KE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(dateStr));
  } catch {
    return new Date(dateStr).toLocaleString();
  }
}

function canEditComment(comment: CommunityComment): boolean {
  if (comment.deletedAt || comment.status === "deleted" || comment.status === "removed" || comment.status === "spam") return false;
  return Date.now() - new Date(comment.createdAt).getTime() <= 60 * 60 * 1000;
}

function editWindowLabel(comment: CommunityComment): string {
  const remainingMs = 60 * 60 * 1000 - (Date.now() - new Date(comment.createdAt).getTime());
  if (remainingMs <= 0) return "Edit window closed";
  const minutes = Math.max(1, Math.ceil(remainingMs / 60000));
  return `${minutes}m left to edit`;
}

function entityContextUrl(type?: string | null, slug?: string | null, rawUrl?: string | null, commentId?: string): string {
  let base = rawUrl || "";

  if (!base && type && slug) {
    const map: Record<string, string> = {
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
    base = map[type] || "";
  }

  if (!base) return "#";

  try {
    if (base.startsWith("http://") || base.startsWith("https://")) {
      const url = new URL(base);
      if (typeof window !== "undefined" && url.origin === window.location.origin) {
        base = `${url.pathname}${url.search}`;
      }
    }
  } catch {
    // keep base
  }

  if (commentId && !base.includes("#")) return `${base}#comment-${commentId}`;
  return base;
}

function commentContextTitle(comment: CommunityComment): string {
  return comment.threadTitle || "Original discussion";
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

  const [tab, setTab] = useState<Tab>("Listening");
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
  const [follows, setFollows] = useState<FollowingPresentationItem[]>([]);
  const [listeningHistory, setListeningHistory] = useState<ListeningHistoryItem[]>(() => getListeningHistory());
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
      getUserFollowing(userId)
        .catch(() => []),
    ]).then(([saveRows, followRows]) => {
      if (!alive) return;
      setSaves(saveRows as ProfileEntityRecord[]);
      setFollows(followRows);
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
          case "Listening": {
            setListeningHistory(getListeningHistory());
            break;
          }
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
            const data = await getUserFollowing(userId);
            setFollows(data);
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
    const syncListeningHistory = () => setListeningHistory(getListeningHistory());

    syncListeningHistory();
    window.addEventListener("wk-listening-history-changed", syncListeningHistory);

    return () => {
      window.removeEventListener("wk-listening-history-changed", syncListeningHistory);
    };
  }, []);

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
              {listeningHistory.length}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--wk-text-faint)" }}>
              Plays
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
        {!isSignedIn && tab !== "Account" && tab !== "Listening" ? (
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
        ) : tab === "Listening" ? (
          <MobileListeningTab history={listeningHistory} />
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


/* ─── Listening Tab (Mobile — continue listening shelf) ─── */
function MobileListeningTab({ history }: { history: ListeningHistoryItem[] }) {
  if (history.length === 0) {
    return (
      <MobileEmptyState
        icon="ri-headphone-line"
        title="Nothing played yet"
        subtitle="Play tracks, charts, and article sessions to build your listening shelf."
        action={{ label: "Browse charts", to: "/charts" }}
      />
    );
  }

  const [lead, ...rest] = history;
  const leadProgress = Math.round(Math.min(1, Math.max(0, lead.progress || 0)) * 100);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] mb-1" style={{ color: "var(--wk-brand)" }}>
          Continue listening
        </p>
        <p className="text-[12px] leading-relaxed" style={{ color: "var(--wk-text-muted)" }}>
          Your recent WAKILISHA plays, previews, and full Apple Music sessions.
        </p>
      </div>

      <Link
        to={lead.trackUrl}
        className="block overflow-hidden rounded-[28px] border"
        style={{ borderColor: "var(--wk-border)", background: "var(--wk-surface)" }}
      >
        <div className="relative aspect-[16/10] overflow-hidden" style={{ background: "var(--wk-surface-raised)" }}>
          {lead.artworkUrl ? (
            <img src={lead.artworkUrl} alt={lead.title} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <i className="ri-music-2-line text-4xl" style={{ color: "var(--wk-brand)" }} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
          <div className="absolute left-4 right-4 bottom-4">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-black/45 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white backdrop-blur">
              <i className={lead.backend === "apple" ? "ri-music-2-line" : "ri-radio-2-line"} />
              {lead.backend === "apple" ? "Apple Music" : "Preview"}
            </div>
            <h3 className="text-2xl font-black tracking-[-0.05em] leading-none text-white">
              {lead.title}
            </h3>
            <p className="mt-1 text-[12px] font-bold text-white/72">{lead.artist}</p>
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between gap-3 text-[11px] font-bold" style={{ color: "var(--wk-text-muted)" }}>
            <span>{formatListeningProgress(lead)}</span>
            <span>{lead.playCount} play{lead.playCount === 1 ? "" : "s"}</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--wk-surface-raised)" }}>
            <div className="h-full rounded-full" style={{ width: `${leadProgress}%`, background: "var(--wk-brand)" }} />
          </div>
        </div>
      </Link>

      {rest.length > 0 && (
        <div className="space-y-2">
          {rest.slice(0, 20).map((item) => {
            const progress = Math.round(Math.min(1, Math.max(0, item.progress || 0)) * 100);

            return (
              <Link
                key={item.id}
                to={item.trackUrl}
                className="flex items-center gap-3 rounded-2xl border p-2.5"
                style={{ borderColor: "var(--wk-border)", background: "var(--wk-surface)" }}
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl" style={{ background: "var(--wk-surface-raised)" }}>
                  {item.artworkUrl ? (
                    <img src={item.artworkUrl} alt={item.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <i className="ri-music-2-line" style={{ color: "var(--wk-brand)" }} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-black" style={{ color: "var(--wk-text)" }}>
                    {item.title}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] font-semibold" style={{ color: "var(--wk-text-muted)" }}>
                    {item.artist} · {item.backend === "apple" ? "Apple Music" : "Preview"}
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full" style={{ background: "var(--wk-surface-raised)" }}>
                    <div className="h-full rounded-full" style={{ width: `${progress}%`, background: "var(--wk-brand)" }} />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-black tabular-nums" style={{ color: "var(--wk-text)" }}>
                    {item.playCount}x
                  </div>
                  <div className="mt-1 text-[9px] font-black uppercase tracking-[0.12em]" style={{ color: "var(--wk-text-faint)" }}>
                    {formatListeningProgress(item)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}


/* ─── Comments Tab (Mobile) ─── */
function MobileCommentsTab({
  comments, loading, error, onRetry,
}: { comments: CommunityComment[]; loading: boolean; error: string | null; onRetry: () => void }) {
  return (
    <MobileUserCommentList
      comments={comments}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={{
        icon: "ri-chat-3-line",
        title: "No comments yet",
        subtitle: "When you join a discussion, your comments will appear here with context.",
        action: { label: "Browse articles", to: "/magazine" },
      }}
    />
  );
}

/* ─── Replies Tab (Mobile) ─── */
function MobileRepliesTab({
  replies, loading, error, onRetry,
}: { replies: CommunityComment[]; loading: boolean; error: string | null; onRetry: () => void }) {
  return (
    <MobileUserCommentList
      comments={replies}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={{
        icon: "ri-reply-line",
        title: "No replies yet",
        subtitle: "When you reply to someone, those replies will appear here with context.",
      }}
      isReplyList
    />
  );
}

function MobileUserCommentList({
  comments,
  loading,
  error,
  onRetry,
  empty,
  isReplyList = false,
}: {
  comments: CommunityComment[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  empty: { icon: string; title: string; subtitle?: string; action?: { label: string; to: string } };
  isReplyList?: boolean;
}) {
  const [items, setItems] = useState<CommunityComment[]>(comments);
  const [activeComment, setActiveComment] = useState<CommunityComment | null>(null);

  useEffect(() => {
    setItems(comments);
  }, [comments]);

  if (loading) return <MobileSkeletonList count={4} />;
  if (error) return <MobileErrorState message={error} onRetry={onRetry} />;
  if (items.length === 0) {
    return (
      <MobileEmptyState
        icon={empty.icon}
        title={empty.title}
        subtitle={empty.subtitle}
        action={empty.action}
      />
    );
  }

  const handleUpdated = (comment: CommunityComment) => {
    setItems((current) => current.map((item) => item.id === comment.id ? { ...item, ...comment } : item));
  };

  const handleDeleted = (commentId: string) => {
    setItems((current) => current.filter((item) => item.id !== commentId));
  };

  return (
    <>
      <div className="space-y-3">
        {items.map((comment) => {
          const contextUrl = entityContextUrl(
            comment.threadEntityType,
            comment.threadEntitySlug,
            comment.threadEntityUrl,
            comment.id
          );
          const editable = canEditComment(comment);

          return (
            <article
              key={comment.id}
              className="overflow-hidden rounded-2xl border"
              style={{ borderColor: "var(--wk-border)", background: "var(--wk-surface)" }}
            >
              <div className="p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--wk-brand)" }}>
                      {isReplyList ? "Reply on" : "Commented on"}
                    </p>
                    {contextUrl !== "#" ? (
                      <Link
                        to={contextUrl}
                        className="mt-1 block truncate text-[14px] font-black tracking-[-0.02em]"
                        style={{ color: "var(--wk-text)" }}
                      >
                        {commentContextTitle(comment)}
                      </Link>
                    ) : (
                      <p className="mt-1 truncate text-[14px] font-black tracking-[-0.02em]" style={{ color: "var(--wk-text)" }}>
                        {commentContextTitle(comment)}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] leading-snug" style={{ color: "var(--wk-text-faint)" }}>
                      {formatExactTimestamp(comment.createdAt)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveComment(comment)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full cursor-pointer"
                    style={{ background: "var(--wk-surface-raised)", color: "var(--wk-text-muted)" }}
                    aria-label="Manage comment"
                  >
                    <i className="ri-more-2-fill text-base" />
                  </button>
                </div>

                <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words" style={{ color: "var(--wk-text-soft)" }}>
                  {comment.bodyMarkdown}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {contextUrl !== "#" && (
                    <Link
                      to={contextUrl}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black"
                      style={{ background: "var(--wk-brand-soft)", color: "var(--wk-brand)" }}
                    >
                      View context <i className="ri-arrow-right-up-line" />
                    </Link>
                  )}

                  {editable ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold" style={{ background: "var(--wk-surface-raised)", color: "var(--wk-text-muted)" }}>
                      <i className="ri-time-line" /> {editWindowLabel(comment)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold" style={{ background: "var(--wk-surface-raised)", color: "var(--wk-text-faint)" }}>
                      <i className="ri-lock-line" /> Edit closed
                    </span>
                  )}

                  <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: "var(--wk-text-muted)" }}>
                    <i className="ri-arrow-up-line text-xs" /> {comment.upvoteCount}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: "var(--wk-text-muted)" }}>
                    <i className="ri-chat-3-line text-xs" /> {comment.replyCount}
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {activeComment && (
        <MobileCommentActionDrawer
          comment={activeComment}
          onClose={() => setActiveComment(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );
}

function MobileCommentActionDrawer({
  comment,
  onClose,
  onUpdated,
  onDeleted,
}: {
  comment: CommunityComment;
  onClose: () => void;
  onUpdated: (comment: CommunityComment) => void;
  onDeleted: (commentId: string) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(comment.bodyMarkdown);
  const [mode, setMode] = useState<"actions" | "edit">("actions");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editable = canEditComment(comment);
  const contextUrl = entityContextUrl(
    comment.threadEntityType,
    comment.threadEntitySlug,
    comment.threadEntityUrl,
    comment.id
  );

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelector<HTMLElement>("button, a, textarea");
    focusable?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialog) return;

      const nodes = Array.from(
        dialog.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], textarea:not(:disabled)")
      ).filter((node) => node.offsetParent !== null);

      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, [onClose]);

  const handleSave = async () => {
    const nextBody = draft.trim();
    if (!nextBody) {
      setError("Comment cannot be empty.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await updateComment({
        commentId: comment.id,
        bodyMarkdown: nextBody,
        bodyPlain: nextBody,
        bodyHtml: null,
      });
      onUpdated({
        ...comment,
        ...result.comment,
        threadTitle: comment.threadTitle,
        threadEntityType: comment.threadEntityType,
        threadEntityId: comment.threadEntityId,
        threadEntitySlug: comment.threadEntitySlug,
        threadEntityUrl: comment.threadEntityUrl,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not edit comment.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm("Delete this comment? This cannot be undone.");
    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    try {
      await softDeleteComment(comment.id);
      onDeleted(comment.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete comment.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end bg-black/55 px-3 pb-3"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-comment-actions-title"
        className="w-full rounded-[28px] border p-4 shadow-2xl"
        style={{
          background: "var(--wk-surface)",
          borderColor: "var(--wk-border)",
          color: "var(--wk-text)",
        }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p id="mobile-comment-actions-title" className="text-lg font-black tracking-[-0.04em]">
              Comment options
            </p>
            <p className="mt-1 text-[12px]" style={{ color: "var(--wk-text-muted)" }}>
              Posted {formatExactTimestamp(comment.createdAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full cursor-pointer"
            style={{ background: "var(--wk-surface-raised)", color: "var(--wk-text-muted)" }}
            aria-label="Close comment options"
          >
            <i className="ri-close-line text-lg" />
          </button>
        </div>

        <div className="mb-4 rounded-2xl border p-3" style={{ borderColor: "var(--wk-border)", background: "var(--wk-bg)" }}>
          <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--wk-brand)" }}>
            Appeared on
          </p>
          <p className="mt-1 text-sm font-black" style={{ color: "var(--wk-text)" }}>
            {commentContextTitle(comment)}
          </p>
          <p className="mt-1 text-[11px]" style={{ color: "var(--wk-text-faint)" }}>
            {editable ? editWindowLabel(comment) : "Editing is only available for 1 hour after posting."}
          </p>
        </div>

        {mode === "edit" ? (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--wk-text-muted)" }}>
                Edit comment
              </span>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={5}
                className="w-full resize-none rounded-2xl border p-3 text-sm outline-none"
                style={{
                  background: "var(--wk-bg)",
                  borderColor: "var(--wk-border)",
                  color: "var(--wk-text)",
                }}
              />
            </label>

            {error && <p className="text-xs font-bold text-red-500">{error}</p>}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("actions")}
                className="rounded-full px-4 py-3 text-sm font-black cursor-pointer"
                style={{ background: "var(--wk-surface-raised)", color: "var(--wk-text)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !draft.trim()}
                className="rounded-full px-4 py-3 text-sm font-black cursor-pointer disabled:opacity-60"
                style={{ background: "var(--wk-brand)", color: "var(--wk-brand-on)" }}
              >
                {saving ? "Saving..." : "Save edit"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {contextUrl !== "#" && (
              <Link
                to={contextUrl}
                onClick={onClose}
                className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-black"
                style={{ background: "var(--wk-surface-raised)", color: "var(--wk-text)" }}
              >
                <span className="inline-flex items-center gap-2">
                  <i className="ri-arrow-right-up-line" /> View context
                </span>
                <i className="ri-arrow-right-s-line" />
              </Link>
            )}

            <button
              type="button"
              onClick={() => editable && setMode("edit")}
              disabled={!editable}
              className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-black cursor-pointer disabled:cursor-not-allowed disabled:opacity-45"
              style={{ background: "var(--wk-surface-raised)", color: "var(--wk-text)" }}
            >
              <span className="inline-flex items-center gap-2">
                <i className="ri-pencil-line" /> Edit comment
              </span>
              <span className="text-[11px]" style={{ color: "var(--wk-text-faint)" }}>
                {editable ? editWindowLabel(comment) : "Closed"}
              </span>
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-black cursor-pointer disabled:opacity-60"
              style={{ background: "rgba(239, 68, 68, 0.12)", color: "rgb(239, 68, 68)" }}
            >
              <span className="inline-flex items-center gap-2">
                <i className="ri-delete-bin-line" /> Delete comment
              </span>
              <span>{deleting ? "Deleting..." : "Anytime"}</span>
            </button>

            {error && <p className="px-1 pt-2 text-xs font-bold text-red-500">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Image-led profile entity cards ─── */
function MobileEntityArtwork({
  imageUrl,
  title,
  type,
  tall = false,
  iconName,
  typeLabel,
}: {
  imageUrl: string;
  title: string;
  type: string;
  tall?: boolean;
  iconName?: string;
  typeLabel?: string;
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
          <i className={`${iconName ?? iconForTargetType(type)} text-3xl`} />
          <span className="text-2xl font-black tracking-[-0.04em]">{initials}</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/18 to-transparent" />
      <div className="absolute left-3 top-3 rounded-full bg-black/35 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white/85 backdrop-blur-md">
        {typeLabel ?? entityLabel(type)}
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
          const entitySlug = recordText(save, ["entity_slug"]);
          const title = entityTitle(save);
          const imageUrl = entityImage(save);
          const createdAt = entityCreatedAt(save);

          return (
            <Link
              key={String(save.id)}
              to={entityUrl || "#"}
              className="group block min-w-0 cursor-pointer"
            >
              {entityType === "playlist" && entitySlug ? (
                <div
                  className="aspect-square overflow-hidden rounded-[22px]"
                  style={{ background: "var(--wk-surface-raised)" }}
                >
                  <PlaylistCoverPresentation
                    src={imageUrl || null}
                    altText={title}
                    slug={entitySlug}
                    title={title}
                    loading="lazy"
                  />
                </div>
              ) : (
                <MobileEntityArtwork imageUrl={imageUrl} title={title} type={entityType} />
              )}
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
}: { follows: FollowingPresentationItem[]; loading: boolean; error: string | null; onRetry: () => void }) {
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
        subtitle="Follow people and artists to build your circle and your Following feed."
        action={{ label: "Find artists", to: "/artists" }}
      />
    );
  }

  const [lead, ...rest] = follows;

  const renderFollowCard = (follow: FollowingPresentationItem, featured = false) => {
    const typeLabel = followingTargetLabel(follow.targetType);

    return (
      <Link
        key={follow.followId}
        to={follow.canonicalPath}
        className={`group block min-w-0 cursor-pointer ${featured ? "col-span-2" : ""}`}
      >
        <div className="relative">
          <MobileEntityArtwork
            imageUrl={follow.imageUrl ?? ""}
            title={follow.title}
            type={follow.targetType}
            tall={featured}
            iconName={followingTargetIcon(follow.targetType)}
            typeLabel={typeLabel}
          />
          {featured && (
            <div className="absolute bottom-4 left-4 right-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/65">
                Recently followed
              </p>
              <h3 className="mt-1 text-2xl font-black tracking-[-0.05em] leading-none text-white">
                {follow.title}
              </h3>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/65">
                {typeLabel}{follow.createdAt ? ` · ${timeAgo(follow.createdAt)}` : ""}
              </p>
            </div>
          )}
        </div>

        {!featured && (
          <div className="pt-2 px-1">
            <div className="text-[13px] font-black leading-tight line-clamp-2" style={{ color: "var(--wk-text)" }}>
              {follow.title}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--wk-text-faint)" }}>
              <span>{typeLabel}</span>
              {follow.createdAt && (
                <>
                  <span>·</span>
                  <span>{timeAgo(follow.createdAt)}</span>
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
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] mb-1" style={{ color: "var(--wk-brand)" }}>
            Your circle
          </p>
          <p className="text-[12px] leading-relaxed" style={{ color: "var(--wk-text-muted)" }}>
            People and artists you follow shape your Following feed. Your full relationship list stays here.
          </p>
        </div>
        <Link
          to="/following"
          className="shrink-0 rounded-full border px-3 py-2 text-[10px] font-black"
          style={{ borderColor: "var(--wk-border)", color: "var(--wk-text)" }}
        >
          Open feed
        </Link>
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