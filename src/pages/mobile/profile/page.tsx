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

type Tab = "Comments" | "Replies" | "Saves" | "Following" | "Account";
const tabs: Tab[] = ["Comments", "Replies", "Saves", "Following", "Account"];

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

  const [tab, setTab] = useState<Tab>("Comments");
  const [coverColor] = useState(() => getCoverColor());

  const isSignedIn = !authUser.loading && !!authUser.id;
  const userId = authUser.id;
  const userDisplayName = authUser.name || authUser.email?.split("@")[0] || "Reader";
  const userEmail = authUser.email || "";
  const userInitial = userDisplayName[0]?.toUpperCase() || "W";

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
    if (tab !== "Account") loadTabData(tab);
  }, [tab, loadTabData]);

  const statsCommentCount = Math.max(commProfile?.commentCount ?? 0, comments.length);
  const statsSaveCount = saves.length;
  const statsFollowCount = follows.length;
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
            {authUser.avatarUrl ? (
              <img src={authUser.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[32px] font-black" style={{ color: "var(--wk-brand)" }}>
                {userInitial}
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
                {isSignedIn ? userDisplayName : "WAKILISHA Reader"}
              </h1>
              <p className="text-[13px] font-semibold mt-0.5" style={{ color: "var(--wk-text-muted)" }}>
                {commProfile?.username ? `@${commProfile.username}` : (isSignedIn ? userEmail : "Sign in to customize")}
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
              {commProfile?.username && (
                <Link
                  to={`/u/${commProfile.username}`}
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

/* ─── Saves Tab (Mobile — IG 3-column grid) ─── */
function MobileSavesTab({
  saves, loading, error, onRetry,
}: { saves: Record<string, unknown>[]; loading: boolean; error: string | null; onRetry: () => void }) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-sm animate-pulse" style={{ background: "var(--wk-surface-raised)" }} />
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
        action={{ label: "Browse magazine", to: "/magazine" }}
      />
    );
  }
  return (
    <div className="grid grid-cols-3 gap-1">
      {saves.map((s) => {
        const save = s as Record<string, unknown>;
        const entityUrl = String(save.entity_url || "#");
        const imageUrl = save.image_url ? String(save.image_url) : null;
        const title = String(save.title || "");
        const entityType = String(save.entity_type || "");

        return (
          <Link
            key={String(save.id)}
            to={entityUrl || "#"}
            className="block aspect-square rounded-sm overflow-hidden relative group cursor-pointer"
            style={{ background: "var(--wk-surface-raised)" }}
          >
            {imageUrl ? (
              <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
                <i className="ri-bookmark-line text-xl" style={{ color: "var(--wk-text-faint)" }} />
                <span className="text-[8px] font-black uppercase tracking-wider text-center leading-tight" style={{ color: "var(--wk-text-faint)" }}>
                  {entityLabel(entityType)}
                </span>
              </div>
            )}
            {/* Overlay on tap */}
            <div className="absolute inset-0 bg-black/0 group-active:bg-black/30 transition-colors flex items-end p-2">
              <span className="text-[9px] font-bold text-white opacity-0 group-active:opacity-100 line-clamp-2">{title}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/* ─── Following Tab (Mobile) ─── */
function MobileFollowingTab({
  follows, loading, error, onRetry,
}: { follows: Record<string, unknown>[]; loading: boolean; error: string | null; onRetry: () => void }) {
  if (loading) return <MobileSkeletonList count={5} />;
  if (error) return <MobileErrorState message={error} onRetry={onRetry} />;
  if (follows.length === 0) {
    return (
      <MobileEmptyState
        icon="ri-user-add-line"
        title="Not following yet"
        subtitle="Follow articles, artists, and charts to stay updated."
      />
    );
  }
  return (
    <div className="space-y-1">
      {follows.map((f) => {
        const follow = f as Record<string, unknown>;
        const targetType = String(follow.target_type || "");
        const targetSlug = String(follow.target_slug || "");
        const createdAt = String(follow.created_at || "");
        const urlMap: Record<string, string> = {
          article: `/magazine/${targetSlug}`,
          artist: `/artists/${targetSlug}`,
          track: `/tracks/${targetSlug}`,
          release: `/releases/${targetSlug}`,
          label: `/labels/${targetSlug}`,
          genre: `/genres/${targetSlug}`,
          chart: `/charts/${targetSlug}`,
          chart_edition: `/charts/${targetSlug}`,
          field_guide: `/guides/${targetSlug}`,
          magazine_issue: `/magazine/issue/${targetSlug}`,
        };
        return (
          <Link
            key={String(follow.id)}
            to={urlMap[targetType] || "#"}
            className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer"
            style={{ borderColor: "var(--wk-border)", background: "var(--wk-surface)" }}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--wk-surface-raised)" }}>
              <i className={`${iconForTargetType(targetType)} text-sm`} style={{ color: "var(--wk-text-muted)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold truncate" style={{ color: "var(--wk-text)" }}>
                {targetSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </div>
              <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--wk-text-muted)" }}>
                <span>{entityLabel(targetType)}</span>
                <span>·</span>
                <span>{timeAgo(createdAt)}</span>
              </div>
            </div>
            <i className="ri-arrow-right-s-line" style={{ color: "var(--wk-text-faint)" }} />
          </Link>
        );
      })}
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