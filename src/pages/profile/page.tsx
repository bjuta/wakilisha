import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useTheme } from "@/components/design-system/theme/ThemeProvider";
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

function getCoverColor(): string {
  try { return localStorage.getItem("wk-cover-color") || "#1a3a0a"; } catch { return "#1a3a0a"; }
}
function coverGradientStyle(): string {
  const c = getCoverColor();
  const n = parseInt(c.replace("#", ""), 16);
  const r = Math.min(255, (n >> 16) + 30);
  const g = Math.min(255, ((n >> 8) & 0xFF) + 30);
  const b = Math.min(255, (n & 0xFF) + 30);
  const brighter = `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  return `linear-gradient(135deg, ${c}, ${brighter})`;
}

type Tab = "Comments" | "Replies" | "Saves" | "Following" | "Account";
const tabs: Tab[] = ["Comments", "Replies", "Saves", "Following", "Account"];

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function entityLabel(type: string): string {
  const map: Record<string, string> = {
    article: "Article", artist: "Artist", track: "Track", release: "Release",
    label: "Label", genre: "Genre", chart: "Chart", chart_edition: "Chart Edition",
    field_guide: "Guide", magazine_issue: "Issue", briefing_issue: "Briefing",
    profile: "Profile", comment: "Comment",
  };
  return map[type] || type;
}

export default function ProfilePage() {
  const { theme, toggle } = useTheme();
  const authUser = useAuthUser();
  const navigate = useNavigate();
  const [showThemeSheet, setShowThemeSheet] = useState(false);
  const [tab, setTab] = useState<Tab>("Comments");

  const isSignedIn = !authUser.loading && !!authUser.id;
  const userId = authUser.id;
  const userDisplayName = authUser.name || authUser.email?.split("@")[0] || "Reader";
  const userEmail = authUser.email || "";
  const userInitial = userDisplayName[0]?.toUpperCase() || "W";

  // Community profile
  const [commProfile, setCommProfile] = useState<CommunityProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Tab data
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [replies, setReplies] = useState<CommunityComment[]>([]);
  const [saves, setSaves] = useState<Record<string, unknown>[]>([]);
  const [follows, setFollows] = useState<Record<string, unknown>[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState<string | null>(null);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // Load community profile on mount
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

  // Load tab data
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
        setTabError(e instanceof Error ? e.message : "Failed to load data");
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
  const statsSaveCount = saves.length || 0;
  const statsFollowCount = follows.length || 0;
  const profileUsername =
    commProfile?.username && commProfile.username !== "undefined"
      ? commProfile.username
      : "";
  const profileCoverUrl = commProfile?.coverUrl || null;

  return (
    <main className="profile-dt-shell">
      {/* Hero */}
      <section className="profile-dt-hero">
        <div className="profile-dt-cover" style={{ background: profileCoverUrl ? undefined : coverGradientStyle() }}>
          {profileCoverUrl ? (
            <img src={profileCoverUrl} alt="" />
          ) : (
            <div className="h-full w-full" style={{ background: coverGradientStyle() }} />
          )}
        </div>
      </section>

      {/* Profile header */}
      <div className="profile-dt-content">
        <div className="profile-dt-header">
          <div className="profile-dt-avatar-wrap">
            <div className="profile-dt-avatar">
              {authUser.avatarUrl ? (
                <img src={authUser.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[28px] font-black bg-[var(--wk-surface)] text-[var(--wk-brand)]">
                  {userInitial}
                </div>
              )}
            </div>
            {isSignedIn && (
              <div className="profile-dt-badge">
                <WkIcon name="Check" size={12} />
              </div>
            )}
          </div>

          <div className="profile-dt-header-main">
            <div className="profile-dt-header-top">
              <div className="profile-dt-header-info">
                {authUser.loading ? (
                  <>
                    <div className="h-[36px] w-48 rounded bg-[var(--wk-surface-raised)] animate-pulse mb-[6px]" />
                    <div className="h-[18px] w-32 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                  </>
                ) : (
                  <>
                    <h1 className="profile-dt-name">
                      {isSignedIn ? userDisplayName : "WAKILISHA Reader"}
                    </h1>
                    <div className="profile-dt-handle">
                      {commProfile ? (
                        <>
                          @{commProfile.username}
                          <span className="profile-dt-role">
                            <WkIcon name="User" size={13} /> {commProfile.reputationScore > 0 ? `Rep ${commProfile.reputationScore}` : "Reader"}
                          </span>
                        </>
                      ) : (
                        isSignedIn ? userEmail : "Sign in to customize your profile"
                      )}
                    </div>
                    <p className="profile-dt-bio">
                      {commProfile?.bio || (
                        isSignedIn
                          ? "Your profile saves reading history, followed artists, and chart preferences across devices."
                          : "Sign in to track your reading, follow artists, and personalize your charts experience."
                      )}
                    </p>
                  </>
                )}
              </div>
              <div className="profile-dt-header-actions">
                {isSignedIn ? (
                  <>
                    {profileUsername && (
                      <Link to={`/u/${profileUsername}`} className="profile-dt-btn-ghost whitespace-nowrap">
                        <WkIcon name="ExternalLink" size={14} /> Public profile
                      </Link>
                    )}
                    <Link to="/settings" className="profile-dt-btn-edit whitespace-nowrap">
                      <WkIcon name="Pencil" size={14} /> Edit profile
                    </Link>
                  </>
                ) : (
                  <Link to="/auth" className="profile-dt-btn-edit whitespace-nowrap">
                    <WkIcon name="LogIn" size={14} /> Sign in
                  </Link>
                )}
                <Link to="/search" className="profile-dt-btn-ghost whitespace-nowrap">
                  <WkIcon name="Search" size={14} /> Discover
                </Link>
              </div>
            </div>

            <div className="profile-dt-stats">
              <div className="profile-dt-stat">
                <div className="profile-dt-stat-val">{statsCommentCount}</div>
                <div className="profile-dt-stat-lbl">Comments</div>
              </div>
              <div className="profile-dt-stat">
                <div className="profile-dt-stat-val">{statsSaveCount}</div>
                <div className="profile-dt-stat-lbl">Saves</div>
              </div>
              <div className="profile-dt-stat">
                <div className="profile-dt-stat-val">{statsFollowCount}</div>
                <div className="profile-dt-stat-lbl">Following</div>
              </div>
              <div className="profile-dt-stat">
                <div className="profile-dt-stat-val">
                  {commProfile ? commProfile.reputationScore : "—"}
                </div>
                <div className="profile-dt-stat-lbl">Reputation</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <nav className="profile-dt-tabbar" aria-label="Profile content tabs">
          {tabs.map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`profile-dt-tab ${tab === item ? "active" : ""} cursor-pointer`}
            >
              {item}
            </button>
          ))}
        </nav>

        {/* Tab content */}
        <div className="profile-dt-body">
          {!isSignedIn && tab !== "Account" ? (
            <div className="py-16 text-center border border-dashed border-[var(--wk-border)] rounded-2xl">
              <WkIcon name="MessageCircle" size={32} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
              <p className="font-bold text-sm text-[var(--wk-text-muted)] mb-3">
                Sign in to see your community activity
              </p>
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 text-xs font-bold text-[var(--wk-brand)] hover:underline"
              >
                Sign in <i className="ri-arrow-right-line" />
              </Link>
            </div>
          ) : tab === "Comments" ? (
            <CommentsTab comments={comments} loading={tabLoading} error={tabError} onRetry={() => loadTabData("Comments")} />
          ) : tab === "Replies" ? (
            <RepliesTab replies={replies} loading={tabLoading} error={tabError} onRetry={() => loadTabData("Replies")} />
          ) : tab === "Saves" ? (
            <SavesTab saves={saves} loading={tabLoading} error={tabError} onRetry={() => loadTabData("Saves")} />
          ) : tab === "Following" ? (
            <FollowingTab follows={follows} loading={tabLoading} error={tabError} onRetry={() => loadTabData("Following")} />
          ) : (
            <AccountTab
              theme={theme}
              isSignedIn={isSignedIn}
              userEmail={userEmail}
              onToggleTheme={() => setShowThemeSheet(true)}
              onSignOut={handleSignOut}
            />
          )}
        </div>
      </div>

      {/* Theme sheet */}
      {showThemeSheet && (
        <>
          <div className="profile-dt-backdrop" onClick={() => setShowThemeSheet(false)} />
          <div className="profile-dt-sheet">
            <div className="profile-dt-sheet-handle" />
            <div className="profile-dt-sheet-title">Appearance</div>
            <button
              onClick={() => {
                if (theme !== "light") toggle();
                setShowThemeSheet(false);
              }}
              className={`profile-dt-theme-option cursor-pointer ${
                theme === "light" ? "profile-dt-theme-option-active" : ""
              }`}
            >
              <WkIcon name="Sun" size={18} />
              <div className="profile-dt-theme-option-label">Light</div>
              {theme === "light" && <WkIcon name="Check" size={17} />}
            </button>
            <button
              onClick={() => {
                if (theme !== "dark") toggle();
                setShowThemeSheet(false);
              }}
              className={`profile-dt-theme-option cursor-pointer ${
                theme === "dark" ? "profile-dt-theme-option-active" : ""
              }`}
            >
              <WkIcon name="Moon" size={18} />
              <div className="profile-dt-theme-option-label">Dark</div>
              {theme === "dark" && <WkIcon name="Check" size={17} />}
            </button>
          </div>
        </>
      )}
    </main>
  );
}

/* ─── Comments Tab ─── */
function CommentsTab({
  comments,
  loading,
  error,
  onRetry,
}: {
  comments: CommunityComment[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse border border-[var(--wk-border)] rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[var(--wk-surface-raised)]" />
              <div className="h-3 w-24 rounded bg-[var(--wk-surface-raised)]" />
              <div className="h-3 w-16 rounded bg-[var(--wk-surface-raised)]" />
            </div>
            <div className="h-4 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
            <div className="h-3 w-1/2 rounded bg-[var(--wk-surface-raised)]" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <WkIcon name="AlertTriangle" size={24} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
        <p className="font-bold text-sm text-[var(--wk-text-muted)] mb-3">{error}</p>
        <button onClick={onRetry} className="text-xs font-bold text-[var(--wk-brand)] hover:underline cursor-pointer">
          Try again
        </button>
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="py-16 text-center border border-dashed border-[var(--wk-border)] rounded-2xl">
        <WkIcon name="MessageCircle" size={32} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
        <p className="font-bold text-sm text-[var(--wk-text-muted)] mb-3">No comments yet</p>
        <Link to="/magazine" className="inline-flex items-center gap-2 text-xs font-bold text-[var(--wk-brand)] hover:underline">
          Browse articles to join the conversation <i className="ri-arrow-right-line" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {comments.map((c) => (
        <div key={c.id} className="border border-[var(--wk-border)] rounded-xl p-4 hover:border-[var(--wk-border-2)] transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] text-[var(--wk-text-faint)]">{timeAgo(c.createdAt)}</span>
            {c.isEditorPick && (
              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]">Editor Pick</span>
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
  );
}

/* ─── Replies Tab ─── */
function RepliesTab({
  replies,
  loading,
  error,
  onRetry,
}: {
  replies: CommunityComment[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse border border-[var(--wk-border)] rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[var(--wk-surface-raised)]" />
              <div className="h-3 w-20 rounded bg-[var(--wk-surface-raised)]" />
            </div>
            <div className="h-4 w-2/3 rounded bg-[var(--wk-surface-raised)]" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <WkIcon name="AlertTriangle" size={24} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
        <p className="font-bold text-sm text-[var(--wk-text-muted)] mb-3">{error}</p>
        <button onClick={onRetry} className="text-xs font-bold text-[var(--wk-brand)] hover:underline cursor-pointer">
          Try again
        </button>
      </div>
    );
  }

  if (replies.length === 0) {
    return (
      <div className="py-16 text-center border border-dashed border-[var(--wk-border)] rounded-2xl">
        <WkIcon name="Reply" size={32} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
        <p className="font-bold text-sm text-[var(--wk-text-muted)] mb-3">No replies yet</p>
        <p className="text-xs text-[var(--wk-text-faint)] max-w-xs mx-auto">
          When someone replies to your comments, they'll show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {replies.map((r) => (
        <div key={r.id} className="border border-[var(--wk-border)] rounded-xl p-4 hover:border-[var(--wk-border-2)] transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full bg-[var(--wk-surface-raised)] flex items-center justify-center overflow-hidden shrink-0">
              {r.author?.avatarUrl ? (
                <img src={r.author.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <i className="ri-user-line text-[9px] text-[var(--wk-text-faint)]" />
              )}
            </div>
            <span className="text-[12px] font-bold text-[var(--wk-text)]">
              {r.author?.displayName || r.author?.username || "Anonymous"}
            </span>
            <span className="text-[11px] text-[var(--wk-text-faint)]">replied {timeAgo(r.createdAt)}</span>
          </div>
          <p className="text-[14px] leading-relaxed text-[var(--wk-text-soft)] whitespace-pre-wrap break-words line-clamp-3">
            {r.bodyMarkdown}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ─── Saves Tab ─── */
function SavesTab({
  saves,
  loading,
  error,
  onRetry,
}: {
  saves: Record<string, unknown>[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse border border-[var(--wk-border)] rounded-xl overflow-hidden">
            <div className="aspect-[16/10] bg-[var(--wk-surface-raised)]" />
            <div className="p-4 space-y-2">
              <div className="h-3 w-16 rounded bg-[var(--wk-surface-raised)]" />
              <div className="h-4 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <WkIcon name="AlertTriangle" size={24} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
        <p className="font-bold text-sm text-[var(--wk-text-muted)] mb-3">{error}</p>
        <button onClick={onRetry} className="text-xs font-bold text-[var(--wk-brand)] hover:underline cursor-pointer">
          Try again
        </button>
      </div>
    );
  }

  if (saves.length === 0) {
    return (
      <div className="py-16 text-center border border-dashed border-[var(--wk-border)] rounded-2xl">
        <WkIcon name="Bookmark" size={32} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
        <p className="font-bold text-sm text-[var(--wk-text-muted)] mb-3">No saved items yet</p>
        <Link to="/magazine" className="inline-flex items-center gap-2 text-xs font-bold text-[var(--wk-brand)] hover:underline">
          Browse magazine to save stories <i className="ri-arrow-right-line" />
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {saves.map((s) => {
        const save = s as Record<string, unknown>;
        const entityUrl = String(save.entity_url || "");
        const title = String(save.title || "Untitled");
        const subtitle = save.subtitle ? String(save.subtitle) : null;
        const imageUrl = save.image_url ? String(save.image_url) : null;
        const entityType = String(save.entity_type || "");
        const createdAt = String(save.created_at || "");

        return (
          <Link
            key={String(save.id)}
            to={entityUrl || "#"}
            className="block border border-[var(--wk-border)] rounded-xl overflow-hidden bg-[var(--wk-surface)] hover:border-[var(--wk-border-2)] hover:translate-y-[-2px] transition-all"
          >
            <div className="aspect-[16/10] overflow-hidden bg-[var(--wk-surface-raised)]">
              {imageUrl ? (
                <img src={imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[var(--wk-text-faint)]">
                  <i className="ri-bookmark-line text-[28px]" />
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="text-[9px] font-black uppercase tracking-wider text-[var(--wk-brand)] mb-2">
                {entityLabel(entityType)}
              </div>
              <div className="font-bold text-[14px] leading-tight text-[var(--wk-text)] line-clamp-2 mb-1">
                {title}
              </div>
              {subtitle && (
                <div className="text-[11px] text-[var(--wk-text-muted)] line-clamp-1">{subtitle}</div>
              )}
              <div className="text-[10px] text-[var(--wk-text-faint)] mt-2">{timeAgo(createdAt)}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/* ─── Following Tab ─── */
function FollowingTab({
  follows,
  loading,
  error,
  onRetry,
}: {
  follows: Record<string, unknown>[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse flex items-center gap-3 border border-[var(--wk-border)] rounded-xl p-4">
            <div className="w-10 h-10 rounded-lg bg-[var(--wk-surface-raised)]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-32 rounded bg-[var(--wk-surface-raised)]" />
              <div className="h-3 w-20 rounded bg-[var(--wk-surface-raised)]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <WkIcon name="AlertTriangle" size={24} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
        <p className="font-bold text-sm text-[var(--wk-text-muted)] mb-3">{error}</p>
        <button onClick={onRetry} className="text-xs font-bold text-[var(--wk-brand)] hover:underline cursor-pointer">
          Try again
        </button>
      </div>
    );
  }

  if (follows.length === 0) {
    return (
      <div className="py-16 text-center border border-dashed border-[var(--wk-border)] rounded-2xl">
        <WkIcon name="UserPlus" size={32} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
        <p className="font-bold text-sm text-[var(--wk-text-muted)] mb-3">Not following anything yet</p>
        <p className="text-xs text-[var(--wk-text-faint)] max-w-xs mx-auto">
          Follow articles, artists, and charts to stay updated.
        </p>
      </div>
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
            className="flex items-center gap-3 border border-[var(--wk-border)] rounded-xl p-4 hover:border-[var(--wk-border-2)] transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-[var(--wk-surface-raised)] flex items-center justify-center shrink-0">
              <i className={`${iconForTargetType(targetType)} text-[16px] text-[var(--wk-text-muted)]`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[13px] text-[var(--wk-text)] truncate">
                {targetSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[var(--wk-text-muted)]">
                <span>{entityLabel(targetType)}</span>
                <span>·</span>
                <span>{timeAgo(createdAt)}</span>
              </div>
            </div>
            <i className="ri-arrow-right-s-line text-[var(--wk-text-faint)]" />
          </Link>
        );
      })}
    </div>
  );
}

function iconForTargetType(type: string): string {
  const map: Record<string, string> = {
    article: "ri-article-line",
    artist: "ri-mic-line",
    track: "ri-music-line",
    release: "ri-disc-line",
    label: "ri-building-line",
    genre: "ri-price-tag-3-line",
    chart: "ri-bar-chart-line",
    chart_edition: "ri-bar-chart-line",
    field_guide: "ri-book-open-line",
    magazine_issue: "ri-pages-line",
    profile: "ri-user-line",
  };
  return map[type] || "ri-link";
}

/* ─── Account Tab ─── */
function AccountTab({
  theme,
  isSignedIn,
  userEmail,
  onToggleTheme,
  onSignOut,
}: {
  theme: string;
  isSignedIn: boolean;
  userEmail: string;
  onToggleTheme: () => void;
  onSignOut: () => void;
}) {
  return (
    <div>
      <div className="profile-dt-section-head">
        <div className="profile-dt-section-kicker">Settings</div>
        <h2 className="profile-dt-section-title">Account settings</h2>
      </div>
      <div className="profile-dt-settings-grid">
        <div className="profile-dt-settings-col">
          <div className="profile-dt-settings-group">
            <div className="profile-dt-settings-group-title">Preferences</div>
            <button onClick={onToggleTheme} className="profile-dt-settings-row cursor-pointer">
              <div className="profile-dt-settings-icon">
                <WkIcon name={theme === "dark" ? "Moon" : "Sun"} size={18} />
              </div>
              <div className="profile-dt-settings-row-text">
                <div className="profile-dt-settings-label">Appearance</div>
                <div className="profile-dt-settings-sub">
                  Dark mode is {theme === "dark" ? "on" : "off"}
                </div>
              </div>
              <WkIcon name="ChevronRight" size={16} />
            </button>
            <Link to="/settings" className="profile-dt-settings-row">
              <div className="profile-dt-settings-icon">
                <WkIcon name="Settings" size={18} />
              </div>
              <div className="profile-dt-settings-row-text">
                <div className="profile-dt-settings-label">Full settings</div>
                <div className="profile-dt-settings-sub">Privacy, playback, notifications</div>
              </div>
              <WkIcon name="ChevronRight" size={16} />
            </Link>
          </div>
          <div className="profile-dt-settings-group">
            <div className="profile-dt-settings-group-title">Account</div>
            {isSignedIn ? (
              <button onClick={onSignOut} className="profile-dt-settings-row cursor-pointer">
                <div className="profile-dt-settings-icon">
                  <WkIcon name="LogOut" size={18} />
                </div>
                <div className="profile-dt-settings-row-text">
                  <div className="profile-dt-settings-label">Sign out</div>
                  <div className="profile-dt-settings-sub">{userEmail}</div>
                </div>
                <WkIcon name="ChevronRight" size={16} />
              </button>
            ) : (
              <Link to="/auth" className="profile-dt-settings-row">
                <div className="profile-dt-settings-icon">
                  <WkIcon name="LogIn" size={18} />
                </div>
                <div className="profile-dt-settings-row-text">
                  <div className="profile-dt-settings-label">Sign in</div>
                  <div className="profile-dt-settings-sub">Sync profile and saves</div>
                </div>
                <WkIcon name="ChevronRight" size={16} />
              </Link>
            )}
          </div>
        </div>
        <div className="profile-dt-settings-col">
          <div className="profile-dt-settings-group">
            <div className="profile-dt-settings-group-title">Profile info</div>
            <div className="profile-dt-settings-info">
              <div className="profile-dt-info-row">
                <WkIcon name="AtSign" size={15} />
                <span>{isSignedIn ? userEmail : "Sign in to see profile details"}</span>
              </div>
              <div className="profile-dt-info-row">
                <WkIcon name="Globe" size={15} />
                <span>wakilisha.africa</span>
              </div>
              <div className="profile-dt-info-row">
                <WkIcon name="User" size={15} />
                <span>{isSignedIn ? "Contributor profile" : "Reader profile"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}