import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Link,
  useParams,
} from "react-router-dom";
import {
  WkIcon,
} from "@/components/design-system/Icon";
import {
  PublicPersonalPlaylistsSection,
} from "@/components/playlists/PublicPersonalPlaylistsSection";
import {
  useAuthUser,
} from "@/hooks/useAuthUser";
import {
  useEntityActions,
} from "@/hooks/useCommunityActions";
import {
  getProfileByUsername,
  getPublicPersonCommunityActivity,
} from "@/services/community";
import type {
  CommunityComment,
  CommunityProfile,
} from "@/services/community";
import {
  getPersonFollowState,
  getPublicPerson,
  getPublicPersonSocialSummary,
  type PublicPerson,
} from "@/services/people/personPublicService";

type PublicProfileTab =
  | "comments"
  | "replies";

function timeAgo(
  dateStr: string,
): string {
  const seconds =
    Math.floor(
      (
        Date.now() -
        new Date(
          dateStr,
        ).getTime()
      ) /
        1000,
    );

  if (seconds < 60) {
    return "just now";
  }

  const minutes =
    Math.floor(
      seconds / 60,
    );

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours =
    Math.floor(
      minutes / 60,
    );

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days =
    Math.floor(
      hours / 24,
    );

  if (days < 7) {
    return `${days}d ago`;
  }

  return new Date(
    dateStr,
  ).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );
}

function ActivityList({
  items,
  emptyTitle,
}: {
  items: CommunityComment[];
  emptyTitle: string;
}) {
  if (items.length === 0) {
    return (
      <div className="py-12 text-center border border-dashed border-[var(--wk-border)] rounded-2xl">
        <WkIcon
          name="MessageCircle"
          size={28}
          className="mx-auto mb-3 text-[var(--wk-text-faint)]"
        />
        <p className="text-sm font-bold text-[var(--wk-text-muted)]">
          {emptyTitle}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map(
        (comment) => {
          const contextUrl =
            comment.threadEntityUrl &&
            comment.threadEntityUrl.startsWith("/")
              ? comment.threadEntityUrl
              : null;

          return (
            <article
              key={comment.id}
              className="border border-[var(--wk-border)] rounded-xl p-4 hover:border-[var(--wk-border-2)] transition-colors"
            >
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[11px] text-[var(--wk-text-faint)]">
                  {timeAgo(
                    comment.createdAt,
                  )}
                </span>

                {comment.isEditorPick ? (
                  <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--wk-warning-soft)] text-[var(--wk-warning)]">
                    Editor Pick
                  </span>
                ) : null}

                {comment.threadTitle ? (
                  <>
                    <span className="text-[var(--wk-border-strong)]">
                      &middot;
                    </span>

                    {contextUrl ? (
                      <Link
                        to={contextUrl}
                        className="text-[11px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-brand)] transition-colors"
                      >
                        {comment.threadTitle}
                      </Link>
                    ) : (
                      <span className="text-[11px] font-bold text-[var(--wk-text-muted)]">
                        {comment.threadTitle}
                      </span>
                    )}
                  </>
                ) : null}
              </div>

              <p className="text-[14px] leading-relaxed text-[var(--wk-text-soft)] whitespace-pre-wrap break-words line-clamp-4">
                {comment.bodyMarkdown}
              </p>

              <div className="flex items-center gap-4 mt-2 text-[11px] text-[var(--wk-text-muted)]">
                <span className="flex items-center gap-1">
                  <WkIcon
                    name="ArrowUp"
                    size={12}
                  />
                  {comment.upvoteCount}
                </span>

                <span className="flex items-center gap-1">
                  <WkIcon
                    name="MessageCircle"
                    size={12}
                  />
                  {comment.replyCount}{" "}
                  {comment.replyCount ===
                  1
                    ? "reply"
                    : "replies"}
                </span>
              </div>
            </article>
          );
        },
      )}
    </div>
  );
}

export default function PublicProfilePage() {
  const {
    username,
  } =
    useParams<{
      username: string;
    }>();

  const authUser =
    useAuthUser();

  const {
    setFollow,
    loading:
      followMutationLoading,
  } =
    useEntityActions();

  const [
    profile,
    setProfile,
  ] =
    useState<CommunityProfile | null>(
      null,
    );

  const [
    person,
    setPerson,
  ] =
    useState<PublicPerson | null>(
      null,
    );

  const [
    comments,
    setComments,
  ] =
    useState<CommunityComment[]>(
      [],
    );

  const [
    replies,
    setReplies,
  ] =
    useState<CommunityComment[]>(
      [],
    );

  const [
    followerCount,
    setFollowerCount,
  ] =
    useState(0);

  const [
    followed,
    setFollowed,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    followStateLoading,
    setFollowStateLoading,
  ] =
    useState(false);

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<PublicProfileTab>(
      "comments",
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    followError,
    setFollowError,
  ] =
    useState<string | null>(
      null,
    );

  useEffect(
    () => {
      let alive = true;

      if (!username) {
        setLoading(false);
        return () => {
          alive = false;
        };
      }

      setLoading(true);
      setError(null);
      setFollowError(null);
      setComments([]);
      setReplies([]);
      setFollowerCount(0);
      setActiveTab("comments");

      const load =
        async () => {
          try {
            const [
              loadedProfile,
              loadedPerson,
            ] =
              await Promise.all([
                getProfileByUsername(
                  username,
                ),
                getPublicPerson(
                  username,
                ),
              ]);

            if (!alive) {
              return;
            }

            if (
              !loadedProfile ||
              !loadedPerson
            ) {
              setProfile(null);
              setPerson(null);
              setError(
                "Profile not found",
              );
              return;
            }

            setProfile(
              loadedProfile,
            );

            setPerson(
              loadedPerson,
            );

            const [
              loadedComments,
              loadedReplies,
              social,
            ] =
              await Promise.all([
                getPublicPersonCommunityActivity(
                  loadedPerson.personId,
                  "comment",
                  20,
                ).catch(
                  () => [],
                ),
                getPublicPersonCommunityActivity(
                  loadedPerson.personId,
                  "reply",
                  20,
                ).catch(
                  () => [],
                ),
                getPublicPersonSocialSummary(
                  loadedPerson.personId,
                ).catch(
                  () => null,
                ),
              ]);

            if (!alive) {
              return;
            }

            setComments(
              loadedComments,
            );

            setReplies(
              loadedReplies,
            );

            setFollowerCount(
              social?.followerCount ??
                0,
            );
          } catch (
            loadError
          ) {
            if (!alive) {
              return;
            }

            setError(
              loadError instanceof Error
                ? loadError.message
                : "Failed to load profile",
            );
          } finally {
            if (alive) {
              setLoading(false);
            }
          }
        };

      void load();

      return () => {
        alive = false;
      };
    },
    [
      username,
    ],
  );

  useEffect(
    () => {
      let alive = true;

      if (
        !person ||
        authUser.loading
      ) {
        return () => {
          alive = false;
        };
      }

      if (!authUser.id) {
        setFollowed(false);
        setFollowStateLoading(false);

        return () => {
          alive = false;
        };
      }

      setFollowStateLoading(true);

      getPersonFollowState(
        person.personId,
      )
        .then(
          (state) => {
            if (alive) {
              setFollowed(
                state.followed,
              );
            }
          },
        )
        .catch(
          () => {
            if (alive) {
              setFollowed(false);
            }
          },
        )
        .finally(
          () => {
            if (alive) {
              setFollowStateLoading(
                false,
              );
            }
          },
        );

      return () => {
        alive = false;
      };
    },
    [
      authUser.id,
      authUser.loading,
      person,
    ],
  );

  const handleFollow =
    useCallback(
      async () => {
        if (
          !person ||
          !username
        ) {
          return;
        }

        setFollowError(null);

        try {
          const result =
            await setFollow(
              "person",
              person.personId,
              username,
              !followed,
            );

          if (!result) {
            return;
          }

          if (
            result.followed !==
            followed
          ) {
            setFollowerCount(
              (current) =>
                Math.max(
                  0,
                  current +
                    (
                      result.followed
                        ? 1
                        : -1
                    ),
                ),
            );
          }

          setFollowed(
            result.followed,
          );
        } catch (
          mutationError
        ) {
          setFollowError(
            mutationError instanceof Error
              ? mutationError.message
              : "Could not update Follow state",
          );
        }
      },
      [
        followed,
        person,
        setFollow,
        username,
      ],
    );

  if (loading) {
    return (
      <main className="profile-dt-shell">
        <section className="profile-dt-hero">
          <div className="profile-dt-cover animate-pulse" />
        </section>

        <div className="profile-dt-content">
          <div className="profile-dt-header animate-pulse">
            <div className="profile-dt-avatar-wrap">
              <div className="profile-dt-avatar" />
            </div>

            <div className="profile-dt-header-main">
              <div className="h-9 w-56 rounded bg-[var(--wk-surface-raised)]" />
              <div className="mt-3 h-4 w-28 rounded bg-[var(--wk-surface-raised)]" />
              <div className="mt-4 h-16 max-w-xl rounded bg-[var(--wk-surface-raised)]" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (
    error ||
    !profile ||
    !person
  ) {
    return (
      <main className="min-h-screen bg-[var(--wk-bg)] flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <WkIcon
            name="UserX"
            size={40}
            className="mx-auto mb-4 text-[var(--wk-text-faint)]"
          />

          <h1 className="text-xl font-black text-[var(--wk-text)] mb-2">
            Profile not found
          </h1>

          <p className="text-sm text-[var(--wk-text-muted)] mb-6">
            {error ||
              `No public profile found for @${username}.`}
          </p>

          <Link
            to="/"
            className="profile-dt-btn-edit"
          >
            Back to WAKILISHA
          </Link>
        </div>
      </main>
    );
  }

  const avatarUrl =
    profile.avatarUrl ||
    person.avatarUrl;

  const coverUrl =
    profile.coverUrl ||
    person.coverUrl;

  const displayName =
    profile.displayName ||
    person.displayName ||
    profile.username;

  const initial =
    displayName[0]
      ?.toUpperCase() ||
    "U";

  const visibleCommentCount =
    Math.max(
      profile.commentCount ||
        0,
      comments.length,
    );

  const isOwner =
    Boolean(
      authUser.id &&
        authUser.id ===
          profile.userId,
    );

  return (
    <main className="profile-dt-shell">
      <section className="profile-dt-hero">
        <div className="profile-dt-cover">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt=""
            />
          ) : null}
        </div>
      </section>

      <div className="profile-dt-content">
        <div className="profile-dt-header">
          <div className="profile-dt-avatar-wrap">
            <div className="profile-dt-avatar">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[28px] font-black bg-[var(--wk-surface)] text-[var(--wk-brand)]">
                  {initial}
                </div>
              )}
            </div>

            {profile.trustLevel >=
            3 ? (
              <div className="profile-dt-badge">
                <WkIcon
                  name="Check"
                  size={12}
                />
              </div>
            ) : null}
          </div>

          <div className="profile-dt-header-main">
            <div className="profile-dt-header-top">
              <div className="profile-dt-header-info">
                <h1 className="profile-dt-name">
                  {displayName}
                </h1>

                <div className="profile-dt-handle">
                  @{profile.username}

                  {person.publicRoles.length >
                  0 ? (
                    <span className="profile-dt-role">
                      <WkIcon
                        name="Briefcase"
                        size={13}
                      />
                      {person.publicRoles
                        .map(
                          (role) =>
                            role.label,
                        )
                        .join(
                          " · ",
                        )}
                    </span>
                  ) : profile.reputationScore >
                    0 ? (
                    <span className="profile-dt-role">
                      Rep{" "}
                      {
                        profile.reputationScore
                      }
                    </span>
                  ) : null}
                </div>

                {profile.bio ||
                person.bio ? (
                  <p className="profile-dt-bio">
                    {profile.bio ||
                      person.bio}
                  </p>
                ) : null}

                <div className="mt-3 flex items-center gap-4 flex-wrap text-[12px] text-[var(--wk-text-muted)]">
                  {profile.country ? (
                    <span className="flex items-center gap-1.5">
                      <WkIcon
                        name="MapPin"
                        size={13}
                      />
                      {
                        profile.country
                      }
                      {profile.city
                        ? `, ${profile.city}`
                        : ""}
                    </span>
                  ) : person.location ? (
                    <span className="flex items-center gap-1.5">
                      <WkIcon
                        name="MapPin"
                        size={13}
                      />
                      {
                        person.location
                      }
                    </span>
                  ) : null}

                  <span className="flex items-center gap-1.5">
                    <WkIcon
                      name="Calendar"
                      size={13}
                    />
                    Joined{" "}
                    {timeAgo(
                      profile.createdAt,
                    )}
                  </span>
                </div>
              </div>

              <div className="profile-dt-header-actions">
                {isOwner ? (
                  <>
                    <Link
                      to="/settings"
                      className="profile-dt-btn-edit"
                    >
                      <WkIcon
                        name="Pencil"
                        size={14}
                      />
                      Edit profile
                    </Link>

                    <Link
                      to="/profile"
                      className="profile-dt-btn-ghost"
                    >
                      <WkIcon
                        name="User"
                        size={14}
                      />
                      Your account
                    </Link>
                  </>
                ) : authUser.id ? (
                  <button
                    type="button"
                    disabled={
                      followMutationLoading ||
                      followStateLoading
                    }
                    onClick={
                      handleFollow
                    }
                    className={
                      followed
                        ? "profile-dt-btn-ghost disabled:opacity-60"
                        : "profile-dt-btn-edit disabled:opacity-60"
                    }
                  >
                    <WkIcon
                      name={
                        followed
                          ? "UserCheck"
                          : "UserPlus"
                      }
                      size={14}
                    />
                    {followed
                      ? "Following"
                      : "Follow"}
                  </button>
                ) : (
                  <Link
                    to="/auth"
                    className="profile-dt-btn-edit"
                  >
                    <WkIcon
                      name="UserPlus"
                      size={14}
                    />
                    Follow
                  </Link>
                )}
              </div>
            </div>

            {followError ? (
              <p className="mb-4 text-sm font-semibold text-red-500">
                {
                  followError
                }
              </p>
            ) : null}

            <div className="profile-dt-stats">
              <div className="profile-dt-stat">
                <div className="profile-dt-stat-val">
                  {visibleCommentCount}
                </div>
                <div className="profile-dt-stat-lbl">
                  Comments
                </div>
              </div>

              <div className="profile-dt-stat">
                <div className="profile-dt-stat-val">
                  {
                    profile.contributionCount
                  }
                </div>
                <div className="profile-dt-stat-lbl">
                  Contributions
                </div>
              </div>

              <div className="profile-dt-stat">
                <div className="profile-dt-stat-val">
                  {
                    followerCount
                  }
                </div>
                <div className="profile-dt-stat-lbl">
                  {followerCount ===
                  1
                    ? "Follower"
                    : "Followers"}
                </div>
              </div>

              <div className="profile-dt-stat">
                <div className="profile-dt-stat-val">
                  {
                    profile.reputationScore
                  }
                </div>
                <div className="profile-dt-stat-lbl">
                  Reputation
                </div>
              </div>
            </div>
          </div>
        </div>

        <PublicPersonalPlaylistsSection
          username={profile.username}
        />

        <nav
          className="profile-dt-tabbar"
          aria-label="Profile content"
        >
          <button
            type="button"
            className={`profile-dt-tab ${
              activeTab ===
              "comments"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActiveTab(
                "comments",
              )
            }
          >
            Comments
          </button>

          <button
            type="button"
            className={`profile-dt-tab ${
              activeTab ===
              "replies"
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActiveTab(
                "replies",
              )
            }
          >
            Replies
          </button>
        </nav>

        <div className="profile-dt-body">
          <div className="profile-dt-section-head">
            <div className="profile-dt-section-kicker">
              Community
            </div>
            <h2 className="profile-dt-section-title">
              {activeTab ===
              "comments"
                ? "Recent comments"
                : `Replies by ${displayName.split(/\s+/)[0] || displayName}`}
            </h2>
          </div>

          <ActivityList
            items={
              activeTab ===
              "comments"
                ? comments
                : replies
            }
            emptyTitle={
              activeTab ===
              "comments"
                ? "No public comments yet"
                : "No public replies yet"
            }
          />
        </div>
      </div>
    </main>
  );
}
