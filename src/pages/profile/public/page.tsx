import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import {
  getProfileByUsername,
  getUserComments,
  hydrateCommentsWithUserState,
} from "@/services/community";
import type { CommunityProfile, CommunityComment } from "@/services/community";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    setError(null);
    getProfileByUsername(username)
      .then((p) => {
        setProfile(p);
        if (p) {
          setCommentsLoading(true);
          getUserComments(p.userId, 20)
            .then((raw) => hydrateCommentsWithUserState(raw))
            .then((hydrated) => setComments(hydrated))
            .catch(() => {})
            .finally(() => setCommentsLoading(false));
        }
      })
      .catch(() => setError("Failed to load profile"))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--wk-bg)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--wk-text-muted)]">
          <i className="ri-loader-4-line animate-spin text-[20px]" />
          <span className="text-sm font-bold">Loading profile...</span>
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="min-h-screen bg-[var(--wk-bg)] flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <WkIcon name="UserX" size={40} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
          <h1 className="text-xl font-black text-[var(--wk-text)] mb-2">Profile not found</h1>
          <p className="text-sm text-[var(--wk-text-muted)] mb-6">
            {error || `No public profile found for @${username}. This user may not exist or has set their profile to private.`}
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-sm font-bold hover:opacity-90 transition-opacity"
          >
            Back to WAKILISHA
          </Link>
        </div>
      </main>
    );
  }

  const avatarUrl = profile.avatarUrl;
  const coverUrl = profile.coverUrl;
  const displayName = profile.displayName || profile.username;
  const initial = displayName[0]?.toUpperCase() || "U";
  const visibleCommentCount = Math.max(profile.commentCount || 0, comments.length);

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      {/* Hero cover */}
      <div className="w-full h-[clamp(180px,24vw,320px)] bg-[linear-gradient(135deg,#1a3a0a,#2a5a1a)] relative overflow-hidden">
        {coverUrl && (
          <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/30" />
      </div>

      <div className="max-w-[860px] mx-auto px-6 md:px-8 pb-16">
        {/* Profile header */}
        <div className="flex flex-col sm:flex-row gap-5 items-start -mt-14 relative z-10 mb-8">
          <div className="w-[100px] h-[100px] rounded-full border-[4px] border-[var(--wk-bg)] overflow-hidden bg-[var(--wk-surface-raised)] shrink-0 shadow-md">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[32px] font-black bg-[var(--wk-surface-raised)] text-[var(--wk-brand)]">
                {initial}
              </div>
            )}
          </div>
          <div className="pt-14 sm:pt-16 flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-[28px] font-black text-[var(--wk-text)] leading-none">{displayName}</h1>
              {profile.trustLevel >= 3 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)] text-[10px] font-black uppercase tracking-wider">
                  <i className="ri-verified-badge-line text-[12px]" /> Trusted
                </span>
              )}
            </div>
            <div className="text-sm font-bold text-[var(--wk-text-muted)] mb-3">@{profile.username}</div>
            {profile.bio && (
              <p className="text-[14px] leading-relaxed text-[var(--wk-text-soft)] max-w-[56ch] mb-3">{profile.bio}</p>
            )}
            <div className="flex items-center gap-4 flex-wrap text-[12px] text-[var(--wk-text-muted)]">
              {profile.country && (
                <span className="flex items-center gap-1">
                  <i className="ri-map-pin-line text-[13px]" /> {profile.country}{profile.city ? `, ${profile.city}` : ""}
                </span>
              )}
              <span className="flex items-center gap-1">
                <i className="ri-calendar-line text-[13px]" /> Joined {timeAgo(profile.createdAt)}
              </span>
              <span className="flex items-center gap-1">
                <i className="ri-star-line text-[13px]" /> Rep {profile.reputationScore}
              </span>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-8 flex-wrap pb-6 mb-6 border-b border-[var(--wk-border)]">
          <div className="flex flex-col gap-1">
            <span className="text-[22px] font-black text-[var(--wk-text)] tabular-nums">{visibleCommentCount}</span>
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--wk-text-faint)]">Comments</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[22px] font-black text-[var(--wk-text)] tabular-nums">{profile.contributionCount}</span>
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--wk-text-faint)]">Contributions</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[22px] font-black text-[var(--wk-text)] tabular-nums">{profile.reputationScore}</span>
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--wk-text-faint)]">Reputation</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[22px] font-black text-[var(--wk-text)] tabular-nums">{comments.length}</span>
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--wk-text-faint)]">Recent</span>
          </div>
        </div>

        {/* Comments section */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-6 h-6 rounded-md bg-[var(--wk-brand-soft)] flex items-center justify-center">
              <i className="ri-chat-3-line text-[12px] text-[var(--wk-brand)]" />
            </div>
            <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
              Recent Comments
            </h2>
          </div>

          {commentsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse border border-[var(--wk-border)] rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-20 rounded bg-[var(--wk-surface-raised)]" />
                    <div className="h-3 w-12 rounded bg-[var(--wk-surface-raised)]" />
                  </div>
                  <div className="h-4 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-[var(--wk-border)] rounded-2xl">
              <WkIcon name="MessageCircle" size={28} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
              <p className="text-sm font-bold text-[var(--wk-text-muted)]">No public comments yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {comments.map((c) => (
                <div key={c.id} className="border border-[var(--wk-border)] rounded-xl p-4 hover:border-[var(--wk-border-2)] transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] text-[var(--wk-text-faint)]">{timeAgo(c.createdAt)}</span>
                    {c.isEditorPick && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]">
                        Editor Pick
                      </span>
                    )}
                  </div>
                  <p className="text-[14px] leading-relaxed text-[var(--wk-text-soft)] whitespace-pre-wrap break-words line-clamp-4">
                    {c.bodyMarkdown}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-[11px] text-[var(--wk-text-muted)]">
                    <span className="flex items-center gap-1">
                      <i className="ri-arrow-up-line text-[12px]" /> {c.upvoteCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="ri-chat-3-line text-[12px]" /> {c.replyCount} {c.replyCount === 1 ? "reply" : "replies"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-[var(--wk-border)] text-center">
          <Link
            to="/profile"
            className="inline-flex items-center gap-2 text-xs font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] transition-colors"
          >
            <i className="ri-arrow-left-line" /> Back to your profile
          </Link>
        </div>
      </div>
    </main>
  );
}