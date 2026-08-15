import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  WkIcon,
} from "@/components/design-system/Icon";
import {
  MetaTags,
} from "@/components/seo/MetaTags";
import {
  useAuthUser,
} from "@/hooks/useAuthUser";
import {
  useEntityActions,
} from "@/hooks/useCommunityActions";
import {
  listMagazineArticles,
  type MagazineArticle,
} from "@/services/magazineArticles";
import {
  getProfileByUsername,
  getPublicPersonCommunityActivity,
  getUserSaves,
  type CommunityComment,
  type CommunityProfile,
} from "@/services/community";
import {
  getVerticalColor,
} from "@/services/authorProfiles";
import {
  getPersonFollowState,
  getPublicPerson,
  getPublicPersonSocialSummary,
  listPublicPersonWork,
  type PublicPerson,
  type PublicPersonWork,
} from "@/services/people/personPublicService";

type SortMode =
  | "latest"
  | "oldest"
  | "longest";

type PersonProfileTab =
  | "articles"
  | "playlists"
  | "comments"
  | "replies"
  | "saves";

type WorkPresentation = {
  work: PublicPersonWork;
  article: MagazineArticle | null;
  section: string;
  date: string;
  readingTime: number;
  imageUrl: string | null;
  summary: string | null;
  isPlaylist: boolean;
};

type WorkRow = {
  items: WorkPresentation[];
  pattern:
    | "three-up"
    | "split"
    | "full-bleed";
};

type PersonSavedItem = {
  id: string;
  entityType: string;
  entityUrl: string | null;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
};

function normalizePersonSavedItem(
  value: unknown,
): PersonSavedItem | null {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const row =
    value as Record<
      string,
      unknown
    >;

  const id =
    typeof row.id === "string"
      ? row.id
      : "";

  const title =
    typeof row.title === "string"
      ? row.title
      : "";

  if (!id || !title) {
    return null;
  }

  return {
    id,
    entityType:
      typeof row.entity_type ===
      "string"
        ? row.entity_type
        : "Saved",
    entityUrl:
      typeof row.entity_url ===
      "string"
        ? row.entity_url
        : null,
    title,
    subtitle:
      typeof row.subtitle ===
      "string"
        ? row.subtitle
        : null,
    imageUrl:
      typeof row.image_url ===
      "string"
        ? row.image_url
        : null,
  };
}

function savedItemTypeLabel(
  value: string,
): string {
  const labels:
    Record<string, string> = {
      article: "Article",
      artist: "Artist",
      track: "Track",
      release: "Release",
      label: "Label",
      genre: "Genre",
      chart: "Chart",
      chart_edition: "Chart",
      field_guide: "Guide",
      magazine_issue: "Magazine",
      briefing_issue: "Briefing",
      playlist: "Playlist",
      person: "Person",
      profile: "Profile",
      post: "Post",
      artist_update: "Post",
    };

  return (
    labels[value] ??
    "Saved"
  );
}

const WORK_PAGE_SIZE = 50;
const MAX_WORK_PAGES = 10;
const BATCH_SIZE = 8;
const LOAD_MORE = 6;
const FEATURED_COUNT = 5;

const SORT_OPTIONS: {
  mode: SortMode;
  label: string;
  icon: string;
}[] = [
  {
    mode: "latest",
    label: "Latest",
    icon: "ri-arrow-down-line",
  },
  {
    mode: "oldest",
    label: "Oldest",
    icon: "ri-arrow-up-line",
  },
  {
    mode: "longest",
    label: "Longest",
    icon: "ri-time-line",
  },
];

function initials(
  name: string,
): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(
      (part) =>
        part.charAt(0).toUpperCase(),
    )
    .join("");
}

function formatCount(
  count: number,
): string {
  return new Intl.NumberFormat(
    "en",
    {
      notation:
        count >= 10_000
          ? "compact"
          : "standard",
      maximumFractionDigits: 1,
    },
  ).format(count);
}

function formatPublishedDate(
  value: string,
): string {
  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  ).format(date);
}

function canonicalArticleSlug(
  path: string,
): string | null {
  const match =
    /^\/magazine\/([^/?#]+)$/.exec(
      path,
    );

  return match?.[1] ?? null;
}

function roleLabels(
  work: PublicPersonWork,
): string[] {
  return work.roles
    .slice()
    .sort(
      (a, b) =>
        a.displayOrder -
        b.displayOrder,
    )
    .map(
      (role) =>
        role.label,
    )
    .filter(
      (
        label,
        index,
        values,
      ) =>
        values.indexOf(label) ===
        index,
    );
}

function workEyebrow(
  item: WorkPresentation,
): string {
  if (!item.isPlaylist) {
    return item.section;
  }

  const roles =
    roleLabels(
      item.work,
    );

  return [
    "Playlist",
    ...roles,
  ].join(" · ");
}

function workMeta(
  item: WorkPresentation,
): string[] {
  return [
    item.readingTime > 0
      ? `${item.readingTime} min`
      : null,
    item.date || null,
  ].filter(
    (
      value,
    ): value is string =>
      Boolean(value),
  );
}

async function listAllPublicPersonWork(
  personId: string,
): Promise<PublicPersonWork[]> {
  const all: PublicPersonWork[] = [];
  let cursor:
    | {
      publishedAt: string;
      resourceId: string;
    }
    | undefined;

  for (
    let page = 0;
    page < MAX_WORK_PAGES;
    page += 1
  ) {
    const batch =
      await listPublicPersonWork(
        personId,
        {
          limit:
            WORK_PAGE_SIZE,
          cursor,
        },
      );

    const existing =
      new Set(
        all.map(
          (item) =>
            item.resourceId,
        ),
      );

    all.push(
      ...batch.filter(
        (item) =>
          !existing.has(
            item.resourceId,
          ),
      ),
    );

    if (
      batch.length <
      WORK_PAGE_SIZE
    ) {
      break;
    }

    const last =
      batch[
        batch.length - 1
      ];

    if (!last) {
      break;
    }

    cursor = {
      publishedAt:
        last.publishedAt,
      resourceId:
        last.resourceId,
    };
  }

  return all;
}

function MediumWorkCard({
  item,
}: {
  item: WorkPresentation;
}) {
  const color =
    item.isPlaylist
      ? "var(--wk-brand)"
      : getVerticalColor(
          item.section,
        );

  const meta =
    workMeta(item);

  return (
    <Link
      to={item.work.canonicalPath}
      className="group border border-[var(--wk-border)] rounded-2xl overflow-hidden bg-[var(--wk-surface)] hover:-translate-y-0.5 hover:border-[var(--wk-border-2)] transition-all duration-200 flex flex-col h-full"
    >
      <div
        className={
          item.isPlaylist
            ? "aspect-square overflow-hidden bg-[var(--wk-surface-raised)]"
            : "aspect-[16/10] overflow-hidden bg-[var(--wk-surface-raised)]"
        }
      >
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            className={
              item.isPlaylist
                ? "w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-500"
                : "w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
            }
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--wk-text-muted)]">
            <WkIcon
              name={
                item.isPlaylist
                  ? "ListMusic"
                  : "FileText"
              }
              size={30}
            />
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        <span
          className="author-profile-card-section"
          style={{
            color,
          }}
        >
          {workEyebrow(
            item,
          )}
        </span>

        <h3 className="font-black text-[15px] leading-[1.16] tracking-[-0.02em] text-[var(--wk-text)] line-clamp-2 mb-2 group-hover:text-[var(--wk-brand)] transition-colors">
          {item.work.title}
        </h3>

        {item.summary ? (
          <p className="font-normal text-xs leading-[1.45] text-[var(--wk-text-soft)] line-clamp-2 mb-3">
            {item.summary}
          </p>
        ) : null}

        {meta.length > 0 ? (
          <div className="mt-auto flex items-center gap-2 text-[11px] font-semibold text-[var(--wk-text-muted)]">
            {meta.map(
              (
                value,
                index,
              ) => (
                <span
                  key={`${value}-${index}`}
                  className="contents"
                >
                  {index > 0 ? (
                    <span className="text-[var(--wk-border-strong)]">
                      &middot;
                    </span>
                  ) : null}
                  <span>
                    {value}
                  </span>
                </span>
              ),
            )}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

function FeatureWorkCard({
  item,
  wide = false,
}: {
  item: WorkPresentation;
  wide?: boolean;
}) {
  const color =
    getVerticalColor(
      item.section,
    );

  const meta =
    workMeta(item);

  return (
    <Link
      to={item.work.canonicalPath}
      className={`group border border-[var(--wk-border)] rounded-2xl overflow-hidden bg-[var(--wk-surface)] hover:-translate-y-0.5 hover:border-[var(--wk-border-2)] transition-all duration-200 grid grid-cols-1 sm:grid-cols-[1.2fr_1fr] h-full ${
        wide
          ? "sm:grid-cols-[5fr_4fr]"
          : ""
      }`}
    >
      <div className="overflow-hidden bg-[var(--wk-surface-raised)] min-h-[160px] sm:min-h-0">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
          />
        ) : (
          <div className="flex h-full min-h-[180px] items-center justify-center text-[var(--wk-text-muted)]">
            <WkIcon
              name="FileText"
              size={30}
            />
          </div>
        )}
      </div>

      <div
        className={`flex flex-col justify-center ${
          wide
            ? "p-5 sm:p-7 md:p-9"
            : "p-5 sm:p-6"
        }`}
      >
        <span
          className="author-profile-card-section"
          style={{
            color,
          }}
        >
          {item.section}
        </span>

        <h3
          className={`font-black tracking-[-0.03em] text-[var(--wk-text)] mb-2.5 group-hover:text-[var(--wk-brand)] transition-colors ${
            wide
              ? "text-lg leading-[1.12] sm:text-[22px] sm:leading-[1.10] md:text-[26px]"
              : "text-base leading-[1.18] sm:text-[17px] sm:leading-[1.15]"
          }`}
        >
          {item.work.title}
        </h3>

        {item.summary ? (
          <p
            className={`font-normal text-[var(--wk-text-soft)] line-clamp-2 ${
              wide
                ? "text-xs leading-[1.5] sm:text-sm sm:leading-[1.55] mb-3 sm:mb-4"
                : "text-[11px] leading-[1.5] sm:text-xs sm:leading-[1.5] mb-2 sm:mb-3"
            }`}
          >
            {item.summary}
          </p>
        ) : null}

        {meta.length > 0 ? (
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--wk-text-muted)]">
            {meta.map(
              (
                value,
                index,
              ) => (
                <span
                  key={`${value}-${index}`}
                  className="contents"
                >
                  {index > 0 ? (
                    <span className="text-[var(--wk-border-strong)]">
                      &middot;
                    </span>
                  ) : null}
                  <span>
                    {value}
                  </span>
                </span>
              ),
            )}
          </div>
        ) : null}
      </div>
    </Link>
  );
}


function activityTimeAgo(
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

function PersonCommunityActivityList({
  items,
  emptyTitle,
  emptyBody,
}: {
  items: CommunityComment[];
  emptyTitle: string;
  emptyBody: string;
}) {
  if (items.length === 0) {
    return (
      <div className="py-14 text-center border border-dashed border-[var(--wk-border)] rounded-2xl">
        <WkIcon
          name="MessageCircle"
          size={30}
          className="mx-auto mb-4 text-[var(--wk-text-faint)]"
        />
        <p className="text-sm font-black text-[var(--wk-text)] mb-2">
          {emptyTitle}
        </p>
        <p className="text-xs leading-relaxed text-[var(--wk-text-muted)] max-w-sm mx-auto">
          {emptyBody}
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
              className="border border-[var(--wk-border)] rounded-xl p-4 sm:p-5 bg-[var(--wk-surface)] hover:border-[var(--wk-border-2)] transition-colors"
            >
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[11px] text-[var(--wk-text-faint)]">
                  {activityTimeAgo(
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
                        className="text-[11px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-brand)] transition-colors line-clamp-1"
                      >
                        {comment.threadTitle}
                      </Link>
                    ) : (
                      <span className="text-[11px] font-bold text-[var(--wk-text-muted)] line-clamp-1">
                        {comment.threadTitle}
                      </span>
                    )}
                  </>
                ) : null}
              </div>

              <p className="text-[14px] leading-relaxed text-[var(--wk-text-soft)] whitespace-pre-wrap break-words">
                {comment.bodyMarkdown}
              </p>

              <div className="flex items-center gap-4 mt-3 text-[11px] text-[var(--wk-text-muted)]">
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
                  {comment.replyCount === 1
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

export default function PersonDetailPage() {
  const {
    slug = "",
  } =
    useParams<{
      slug: string;
    }>();

  const navigate =
    useNavigate();

  const location =
    useLocation();

  const authUser =
    useAuthUser();

  const {
    setFollow,
    loading:
      followMutationLoading,
  } =
    useEntityActions();

  const [
    person,
    setPerson,
  ] =
    useState<PublicPerson | null>(
      null,
    );

  const [
    workViews,
    setWorkViews,
  ] =
    useState<WorkPresentation[]>(
      [],
    );

  const [
    communityProfile,
    setCommunityProfile,
  ] =
    useState<CommunityProfile | null>(
      null,
    );

  const [
    publicComments,
    setPublicComments,
  ] =
    useState<CommunityComment[]>(
      [],
    );

  const [
    publicReplies,
    setPublicReplies,
  ] =
    useState<CommunityComment[]>(
      [],
    );

  const [
    ownerSaves,
    setOwnerSaves,
  ] =
    useState<PersonSavedItem[]>(
      [],
    );

  const [
    ownerSavesLoading,
    setOwnerSavesLoading,
  ] =
    useState(false);

  const [
    ownerSavesLoaded,
    setOwnerSavesLoaded,
  ] =
    useState(false);

  const [
    activeProfileTab,
    setActiveProfileTab,
  ] =
    useState<PersonProfileTab>(
      "articles",
    );

  const [
    followerCount,
    setFollowerCount,
  ] =
    useState(0);

  const [
    followingCount,
    setFollowingCount,
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

  const [
    activeCategory,
    setActiveCategory,
  ] =
    useState("all");

  const [
    sortMode,
    setSortMode,
  ] =
    useState<SortMode>(
      "latest",
    );

  const [
    visibleCount,
    setVisibleCount,
  ] =
    useState(
      BATCH_SIZE,
    );

  const [
    sortOpen,
    setSortOpen,
  ] =
    useState(false);

  const sortWrapRef =
    useRef<HTMLDivElement>(
      null,
    );

  const sentinelRef =
    useRef<HTMLDivElement>(
      null,
    );

  useEffect(
    () => {
      let alive = true;

      const load =
        async () => {
          setLoading(true);
          setError(null);
          setFollowError(null);
          setWorkViews([]);
          setCommunityProfile(null);
          setPublicComments([]);
          setPublicReplies([]);
          setOwnerSaves([]);
          setOwnerSavesLoaded(false);
          setFollowerCount(0);
          setFollowingCount(0);
          setActiveProfileTab("articles");

          try {
            const loadedPerson =
              await getPublicPerson(
                slug,
              );

            if (!alive) {
              return;
            }

            if (!loadedPerson) {
              setPerson(null);
              setError(
                "Profile not found",
              );
              return;
            }

            if (
              loadedPerson.redirectTo &&
              loadedPerson.redirectTo !==
                location.pathname
            ) {
              navigate(
                loadedPerson.redirectTo,
                {
                  replace: true,
                },
              );
              return;
            }

            setPerson(
              loadedPerson,
            );

            const [
              loadedWork,
              social,
              magazineArticles,
              loadedCommunityProfile,
              loadedComments,
              loadedReplies,
            ] =
              await Promise.all([
                listAllPublicPersonWork(
                  loadedPerson.personId,
                ),
                getPublicPersonSocialSummary(
                  loadedPerson.personId,
                ).catch(
                  () => null,
                ),
                listMagazineArticles(
                  500,
                ).catch(
                  () => [],
                ),
                loadedPerson.username
                  ? getProfileByUsername(
                      loadedPerson.username,
                    ).catch(
                      () => null,
                    )
                  : Promise.resolve(
                      null,
                    ),
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
              ]);

            if (!alive) {
              return;
            }

            const governedArticleSlugs =
              new Set(
                loadedWork
                  .filter(
                    (work) =>
                      work.resourceKind ===
                      "article",
                  )
                  .map(
                    (work) =>
                      canonicalArticleSlug(
                        work.canonicalPath,
                      ),
                  )
                  .filter(
                    (
                      value,
                    ): value is string =>
                      Boolean(value),
                  ),
              );

            const articleBySlug =
              new Map(
                magazineArticles
                  .filter(
                    (article) =>
                      governedArticleSlugs.has(
                        article.slug,
                      ),
                  )
                  .map(
                    (article) => [
                      article.slug,
                      article,
                    ] as const,
                  ),
              );

            const presentations =
              loadedWork.map(
                (
                  work,
                ): WorkPresentation => {
                  const articleSlug =
                    work.resourceKind ===
                    "article"
                      ? canonicalArticleSlug(
                          work.canonicalPath,
                        )
                      : null;

                  const article =
                    articleSlug
                      ? articleBySlug.get(
                          articleSlug,
                        ) ??
                        null
                      : null;

                  const isPlaylist =
                    work.resourceKind ===
                    "playlist";

                  return {
                    work,
                    article,
                    section:
                      isPlaylist
                        ? "Playlists"
                        : article?.section ||
                          "Article",
                    date:
                      article?.date ||
                      formatPublishedDate(
                        work.publishedAt,
                      ),
                    readingTime:
                      article?.readingTime ??
                      0,
                    imageUrl:
                      article?.heroUrl ||
                      work.imageUrl,
                    summary:
                      article?.dek ||
                      work.summary,
                    isPlaylist,
                  };
                },
              );

            setWorkViews(
              presentations,
            );

            setCommunityProfile(
              loadedCommunityProfile,
            );

            setPublicComments(
              loadedComments,
            );

            setPublicReplies(
              loadedReplies,
            );

            setActiveProfileTab(
              presentations.some(
                (item) =>
                  !item.isPlaylist,
              )
                ? "articles"
                : presentations.some(
                      (item) =>
                        item.isPlaylist,
                    )
                  ? "playlists"
                  : loadedCommunityProfile
                    ? "comments"
                    : "articles",
            );

            setFollowerCount(
              social?.followerCount ??
                0,
            );

            setFollowingCount(
              social?.followingCount ??
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
      location.pathname,
      navigate,
      slug,
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

  useEffect(
    () => {
      let alive = true;

      if (
        activeProfileTab !==
          "saves" ||
        ownerSavesLoaded ||
        authUser.loading ||
        !authUser.id ||
        !communityProfile ||
        communityProfile.userId !==
          authUser.id
      ) {
        return () => {
          alive = false;
        };
      }

      setOwnerSavesLoading(
        true,
      );

      getUserSaves(
        authUser.id,
      )
        .then(
          (rows) => {
            if (!alive) {
              return;
            }

            setOwnerSaves(
              rows
                .map(
                  normalizePersonSavedItem,
                )
                .filter(
                  (
                    item,
                  ): item is PersonSavedItem =>
                    Boolean(item),
                ),
            );

            setOwnerSavesLoaded(
              true,
            );
          },
        )
        .catch(
          () => {
            if (alive) {
              setOwnerSaves(
                [],
              );
              setOwnerSavesLoaded(
                true,
              );
            }
          },
        )
        .finally(
          () => {
            if (alive) {
              setOwnerSavesLoading(
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
      activeProfileTab,
      authUser.id,
      authUser.loading,
      communityProfile,
      ownerSavesLoaded,
    ],
  );

  useEffect(
    () => {
      if (!sortOpen) {
        return;
      }

      const handler =
        (
          event: MouseEvent,
        ) => {
          if (
            sortWrapRef.current &&
            !sortWrapRef.current.contains(
              event.target as Node,
            )
          ) {
            setSortOpen(false);
          }
        };

      document.addEventListener(
        "mousedown",
        handler,
      );

      return () =>
        document.removeEventListener(
          "mousedown",
          handler,
        );
    },
    [
      sortOpen,
    ],
  );

  const personSlug =
    useMemo(
      () => {
        if (!person) {
          return slug;
        }

        const parts =
          person.canonicalPath
            .split("/")
            .filter(Boolean);

        return (
          parts[
            parts.length - 1
          ] ??
          slug
        );
      },
      [
        person,
        slug,
      ],
    );

  const publicRoleLabels =
    useMemo(
      () =>
        person?.publicRoles
          .map(
            (role) =>
              role.label,
          )
          .filter(
            (
              label,
              index,
              values,
            ) =>
              values.indexOf(label) ===
              index,
          ) ??
        [],
      [
        person,
      ],
    );

  const {
    sections,
    sectionCounts,
  } =
    useMemo(
      () => {
        const counts:
          Record<
            string,
            number
          > = {};

        for (
          const item of
          workViews
        ) {
          counts[
            item.section
          ] =
            (
              counts[
                item.section
              ] ??
              0
            ) + 1;
        }

        const sorted =
          Object.entries(
            counts,
          ).sort(
            (
              left,
              right,
            ) =>
              right[1] -
              left[1],
          );

        return {
          sections:
            sorted.map(
              ([name]) =>
                name,
            ),
          sectionCounts:
            counts,
        };
      },
      [
        workViews,
      ],
    );

  const filteredWork =
    useMemo(
      () => {
        const tabWork =
          activeProfileTab ===
          "playlists"
            ? workViews.filter(
                (item) =>
                  item.isPlaylist,
              )
            : workViews.filter(
                (item) =>
                  !item.isPlaylist,
              );

        const filtered =
          activeCategory ===
          "all"
            ? tabWork
            : tabWork.filter(
                (item) =>
                  item.section ===
                  activeCategory,
              );

        if (
          sortMode ===
          "oldest"
        ) {
          return [
            ...filtered,
          ].sort(
            (
              left,
              right,
            ) =>
              new Date(
                left.work.publishedAt,
              ).getTime() -
              new Date(
                right.work.publishedAt,
              ).getTime(),
          );
        }

        if (
          sortMode ===
          "longest"
        ) {
          return [
            ...filtered,
          ].sort(
            (
              left,
              right,
            ) =>
              right.readingTime -
                left.readingTime ||
              new Date(
                right.work.publishedAt,
              ).getTime() -
                new Date(
                  left.work.publishedAt,
                ).getTime(),
          );
        }

        return [
          ...filtered,
        ].sort(
          (
            left,
            right,
          ) =>
            new Date(
              right.work.publishedAt,
            ).getTime() -
            new Date(
              left.work.publishedAt,
            ).getTime(),
        );
      },
      [
        activeCategory,
        activeProfileTab,
        sortMode,
        workViews,
      ],
    );

  const articleWork =
    useMemo(
      () =>
        workViews.filter(
          (item) =>
            !item.isPlaylist,
        ),
      [
        workViews,
      ],
    );

  const articleSections =
    useMemo(
      () =>
        Array.from(
          new Set(
            articleWork.map(
              (item) =>
                item.section,
            ),
          ),
        ).sort(
          (left, right) =>
            (sectionCounts[right] ?? 0) -
              (sectionCounts[left] ?? 0) ||
            left.localeCompare(
              right,
            ),
        ),
      [
        articleWork,
        sectionCounts,
      ],
    );



  const areas =
    useMemo(
      () =>
        articleSections.slice(
          0,
          6,
        ),
      [
        articleSections,
      ],
    );

  const featuredArticles =
    useMemo(
      () =>
        filteredWork
          .filter(
            (item) =>
              !item.isPlaylist,
          )
          .slice(
            0,
            FEATURED_COUNT,
          ),
      [
        filteredWork,
      ],
    );

  const hasFeatured =
    featuredArticles.length >=
    3;

  const featuredIds =
    useMemo(
      () =>
        new Set(
          hasFeatured
            ? featuredArticles.map(
                (item) =>
                  item.work.resourceId,
              )
            : [],
        ),
      [
        featuredArticles,
        hasFeatured,
      ],
    );

  const gridWork =
    useMemo(
      () =>
        hasFeatured
          ? filteredWork.filter(
              (item) =>
                !featuredIds.has(
                  item.work.resourceId,
                ),
            )
          : filteredWork,
      [
        featuredIds,
        filteredWork,
        hasFeatured,
      ],
    );

  const carouselItems =
    useMemo(
      () => {
        if (
          !hasFeatured ||
          featuredArticles.length <=
            1
        ) {
          return [];
        }

        const items =
          featuredArticles.slice(
            1,
          );

        return [
          ...items,
          ...items,
        ];
      },
      [
        featuredArticles,
        hasFeatured,
      ],
    );

  useEffect(
    () => {
      setVisibleCount(
        BATCH_SIZE,
      );
    },
    [
      activeCategory,
      sortMode,
    ],
  );

  const visibleWork =
    useMemo(
      () =>
        gridWork.slice(
          0,
          visibleCount,
        ),
      [
        gridWork,
        visibleCount,
      ],
    );

  const rows =
    useMemo(
      () => {
        const result:
          WorkRow[] = [];

        let index = 0;
        let rowIndex = 0;

        while (
          index <
          visibleWork.length
        ) {
          const current =
            visibleWork[
              index
            ];

          const cycle =
            rowIndex % 4;

          let pattern:
            WorkRow["pattern"];
          let consume:
            number;

          if (
            current?.isPlaylist
          ) {
            pattern =
              "three-up";
            consume = 3;
          } else if (
            cycle === 0
          ) {
            pattern =
              "three-up";
            consume = 3;
          } else if (
            cycle === 2
          ) {
            pattern =
              "full-bleed";
            consume = 1;
          } else {
            pattern =
              "split";
            consume = 2;
          }

          const items =
            visibleWork.slice(
              index,
              index + consume,
            );

          if (
            items.length === 0
          ) {
            break;
          }

          result.push({
            items,
            pattern,
          });

          index +=
            consume;
          rowIndex += 1;
        }

        return result;
      },
      [
        visibleWork,
      ],
    );

  const hasMore =
    visibleCount <
    gridWork.length;

  useEffect(
    () => {
      const sentinel =
        sentinelRef.current;

      if (
        !sentinel ||
        !hasMore
      ) {
        return;
      }

      const observer =
        new IntersectionObserver(
          (
            entries,
          ) => {
            if (
              entries[0]
                ?.isIntersecting
            ) {
              setVisibleCount(
                (current) =>
                  Math.min(
                    current +
                      LOAD_MORE,
                    gridWork.length,
                  ),
              );
            }
          },
          {
            rootMargin:
              "300px",
          },
        );

      observer.observe(
        sentinel,
      );

      return () =>
        observer.disconnect();
    },
    [
      gridWork.length,
      hasMore,
    ],
  );

  const handleFollow =
    useCallback(
      async () => {
        if (!person) {
          return;
        }

        setFollowError(null);

        try {
          const next =
            !followed;

          const result =
            await setFollow(
              "person",
              person.personId,
              personSlug,
              next,
            );

          if (!result) {
            return;
          }

          setFollowed(
            result.followed,
          );

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
        personSlug,
        setFollow,
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
              <div className="mt-3 h-4 w-40 rounded bg-[var(--wk-surface-raised)]" />
              <div className="mt-4 h-16 max-w-xl rounded bg-[var(--wk-surface-raised)]" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (
    error ||
    !person
  ) {
    return (
      <main className="profile-dt-shell">
        <div className="profile-dt-content py-20 text-center">
          <WkIcon
            name="UserRoundX"
            size={40}
            className="mx-auto mb-4 text-[var(--wk-text-faint)]"
          />

          <h1 className="text-xl font-black text-[var(--wk-text)] mb-2">
            Profile not found
          </h1>

          <p className="text-sm text-[var(--wk-text-muted)] mb-6">
            This profile is not available on WAKILISHA.
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

  const firstName =
    person.displayName
      .split(/\s+/)[0] ||
    person.displayName;

  const description =
    person.bio ??
    `${person.displayName} on WAKILISHA.`;

  const canonicalUrl =
    typeof window !==
    "undefined"
      ? `${window.location.origin}${person.canonicalPath}`
      : person.canonicalPath;

  const playlistCount =
    workViews.filter(
      (item) =>
        item.isPlaylist,
    ).length;

  const isOwner =
    Boolean(
      authUser.id &&
        communityProfile?.userId ===
          authUser.id,
    );

  const hasCommunityProfile =
    Boolean(
      communityProfile &&
        person.username,
    );

  const profileTabs:
    {
      id: PersonProfileTab;
      label: string;
      count?: number;
    }[] = [];

  if (articleWork.length > 0) {
    profileTabs.push({
      id: "articles",
      label: "Articles",
      count:
        articleWork.length,
    });
  }

  if (playlistCount > 0) {
    profileTabs.push({
      id: "playlists",
      label:
        playlistCount === 1
          ? "Playlist"
          : "Playlists",
      count:
        playlistCount,
    });
  }

  if (hasCommunityProfile) {
    profileTabs.push(
      {
        id: "comments",
        label: "Comments",
        count:
          Math.max(
            communityProfile?.commentCount ??
              0,
            publicComments.length,
          ),
      },
      {
        id: "replies",
        label: "Replies",
        count:
          publicReplies.length,
      },
    );
  }

  if (isOwner) {
    profileTabs.push({
      id: "saves",
      label: "Bookmarks",
      count:
        ownerSavesLoaded
          ? ownerSaves.length
          : undefined,
    });
  }

  return (
    <>
      <MetaTags
        title={
          person.displayName
        }
        description={
          description
        }
        imageUrl={
          person.avatarUrl ??
          person.coverUrl ??
          undefined
        }
        url={canonicalUrl}
        type="website"
      />

      <main className="profile-dt-shell">
        <section className="profile-dt-hero">
          <div className="profile-dt-cover">
            {person.coverUrl ? (
              <img
                src={
                  person.coverUrl
                }
                alt=""
              />
            ) : null}
          </div>
        </section>

        <div className="profile-dt-content">
          <div className="profile-dt-header">
            <div className="profile-dt-avatar-wrap">
              <div className="profile-dt-avatar">
                {person.avatarUrl ? (
                  <img
                    src={
                      person.avatarUrl
                    }
                    alt={
                      person.displayName
                    }
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[28px] font-black bg-[var(--wk-surface)] text-[var(--wk-brand)]">
                    {initials(
                      person.displayName,
                    )}
                  </div>
                )}
              </div>

              {communityProfile &&
              communityProfile.trustLevel >=
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
                    {
                      person.displayName
                    }
                  </h1>

                  <div className="profile-dt-handle">
                    {person.username ? (
                      <Link
                        to={`/u/${person.username}`}
                        className="hover:text-[var(--wk-text)] transition-colors"
                      >
                        @{person.username}
                      </Link>
                    ) : null}

                    {publicRoleLabels.length >
                    0 ? (
                      <span className="profile-dt-role">
                        <WkIcon
                          name="Briefcase"
                          size={13}
                        />
                        {publicRoleLabels.join(
                          " · ",
                        )}
                      </span>
                    ) : null}
                  </div>

                  {person.bio ? (
                    <p className="profile-dt-bio">
                      {person.bio}
                    </p>
                  ) : null}

                  {person.location ? (
                    <div className="mt-3 flex items-center gap-1.5 text-[12px] text-[var(--wk-text-muted)]">
                      <WkIcon
                        name="MapPin"
                        size={13}
                      />
                      {
                        person.location
                      }
                    </div>
                  ) : null}
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
                    {formatCount(
                      followingCount,
                    )}
                  </div>
                  <div className="profile-dt-stat-lbl">
                    Following
                  </div>
                </div>

                <div className="profile-dt-stat">
                  <div className="profile-dt-stat-val">
                    {formatCount(
                      followerCount,
                    )}
                  </div>
                  <div className="profile-dt-stat-lbl">
                    {followerCount ===
                    1
                      ? "Follower"
                      : "Followers"}
                  </div>
                </div>
              </div>

              {areas.length >
              0 ? (
                <div className="author-profile-hero-areas mt-5 mb-0">
                  <span className="author-profile-hero-areas-label">
                    Areas of Focus
                  </span>

                  <div className="author-profile-hero-areas-tags">
                    {areas.map(
                      (area) => (
                        <span
                          key={
                            area
                          }
                          className="author-profile-hero-area-tag"
                          style={
                            {
                              "--area-color":
                                getVerticalColor(
                                  area,
                                ),
                            } as CSSProperties
                          }
                        >
                          {area}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {profileTabs.length >
          0 ? (
            <nav
              className="profile-dt-tabbar"
              aria-label="Person profile content"
            >
              {profileTabs.map(
                (tab) => (
                  <button
                    type="button"
                    key={
                      tab.id
                    }
                    className={`profile-dt-tab ${
                      activeProfileTab ===
                      tab.id
                        ? "active"
                        : ""
                    }`}
                    onClick={() => {
                      setActiveProfileTab(
                        tab.id,
                      );
                      setActiveCategory(
                        "all",
                      );
                    }}
                  >
                    {
                      tab.label
                    }
                    {typeof tab.count ===
                    "number" ? (
                      <span className="ml-1.5 text-[10px] opacity-70">
                        {
                          tab.count
                        }
                      </span>
                    ) : null}
                  </button>
                ),
              )}
            </nav>
          ) : null}

          {(activeProfileTab ===
            "articles" ||
            activeProfileTab ===
              "playlists") &&
          workViews.length >
            0 ? (
            <>
          {(activeProfileTab ===
            "articles"
              ? articleWork.length
              : playlistCount) > 0 ? (
            <>
              {hasFeatured &&
              featuredArticles.length >
                0 ? (
                <div className="author-profile-featured-wrap">
                  <Link
                    to={
                      featuredArticles[0]
                        .work
                        .canonicalPath
                    }
                    className="author-profile-featured-hero group"
                  >
                    <div className="author-profile-featured-hero-image">
                      {featuredArticles[0]
                        .imageUrl ? (
                        <img
                          src={
                            featuredArticles[0]
                              .imageUrl ??
                            ""
                          }
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]">
                          <WkIcon
                            name="FileText"
                            size={36}
                          />
                        </div>
                      )}
                    </div>

                    <div className="author-profile-featured-hero-overlay">
                      <div className="author-profile-featured-hero-eye">
                        Featured Story
                      </div>

                      <h2 className="author-profile-featured-hero-title">
                        {
                          featuredArticles[0]
                            .work
                            .title
                        }
                      </h2>

                      {featuredArticles[0]
                        .summary ? (
                        <p className="author-profile-featured-hero-dek">
                          {
                            featuredArticles[0]
                              .summary
                          }
                        </p>
                      ) : null}

                      <div className="author-profile-featured-hero-row">
                        <span
                          style={{
                            color:
                              getVerticalColor(
                                featuredArticles[0]
                                  .section,
                              ),
                          }}
                        >
                          {
                            featuredArticles[0]
                              .section
                          }
                        </span>

                        {workMeta(
                          featuredArticles[0],
                        ).map(
                          (
                            value,
                          ) => (
                            <span
                              key={
                                value
                              }
                              className="contents"
                            >
                              <span>
                                &middot;
                              </span>
                              <span>
                                {
                                  value
                                }
                              </span>
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  </Link>

                  {carouselItems.length >
                  0 ? (
                    <div className="author-profile-carousel-wrap">
                      <div className="author-profile-carousel-label">
                        <span>
                          More from{" "}
                          {
                            firstName
                          }
                        </span>
                        <span className="author-profile-carousel-label-line" />
                      </div>

                      <div className="author-profile-carousel-track-wrap">
                        <div className="author-profile-carousel-track">
                          {carouselItems.map(
                            (
                              item,
                              index,
                            ) => (
                              <Link
                                key={`carousel-${item.work.resourceId}-${index}`}
                                to={
                                  item
                                    .work
                                    .canonicalPath
                                }
                                className="author-profile-carousel-card group"
                              >
                                <div className="author-profile-carousel-card-image">
                                  {item.imageUrl ? (
                                    <img
                                      src={
                                        item.imageUrl
                                      }
                                      alt=""
                                      loading="lazy"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full items-center justify-center bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]">
                                      <WkIcon
                                        name="FileText"
                                        size={24}
                                      />
                                    </div>
                                  )}
                                </div>

                                <div className="author-profile-carousel-card-body">
                                  <span
                                    className="author-profile-card-section"
                                    style={{
                                      color:
                                        getVerticalColor(
                                          item.section,
                                        ),
                                    }}
                                  >
                                    {
                                      item.section
                                    }
                                  </span>

                                  <h3 className="author-profile-carousel-card-title">
                                    {
                                      item
                                        .work
                                        .title
                                    }
                                  </h3>

                                  {item.summary ? (
                                    <p className="author-profile-carousel-card-dek">
                                      {
                                        item.summary
                                      }
                                    </p>
                                  ) : null}

                                  <div className="author-profile-card-meta">
                                    {workMeta(
                                      item,
                                    ).map(
                                      (
                                        value,
                                        metaIndex,
                                      ) => (
                                        <span
                                          key={`${value}-${metaIndex}`}
                                          className="contents"
                                        >
                                          {metaIndex >
                                          0 ? (
                                            <span className="author-profile-card-meta-sep">
                                              &middot;
                                            </span>
                                          ) : null}
                                          <span>
                                            {
                                              value
                                            }
                                          </span>
                                        </span>
                                      ),
                                    )}
                                  </div>
                                </div>
                              </Link>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div
                className={`author-profile-filter-bar ${
                  activeProfileTab ===
                  "articles"
                    ? "person-article-filter-bar"
                    : ""
                }`}
              >
                {activeProfileTab ===
                "articles" ? (
                  <div className="author-profile-filter-pills person-article-filter-pills">
                    <button
                      type="button"
                      className={`author-profile-filter-pill ${
                        activeCategory ===
                        "all"
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setActiveCategory(
                          "all",
                        )
                      }
                    >
                      All
                      <span className="author-profile-filter-pill-count">
                        {
                          articleWork.length
                        }
                      </span>
                    </button>

                    {articleSections.map(
                      (section) => (
                      <button
                        type="button"
                        key={
                          section
                        }
                        className={`author-profile-filter-pill ${
                          activeCategory ===
                          section
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          setActiveCategory(
                            activeCategory ===
                              section
                              ? "all"
                              : section,
                          )
                        }
                        style={
                          activeCategory ===
                          section
                            ? {}
                            : {
                                "--pill-color":
                                  section ===
                                  "Playlists"
                                    ? "var(--wk-brand)"
                                    : getVerticalColor(
                                        section,
                                      ),
                              } as CSSProperties
                        }
                      >
                        {
                          section
                        }
                        <span className="author-profile-filter-pill-count">
                          {
                            sectionCounts[
                              section
                            ]
                          }
                        </span>
                      </button>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="author-profile-filter-pills">
                    <span className="text-[11px] font-bold text-[var(--wk-text-muted)]">
                      {playlistCount === 1
                        ? "1 published playlist"
                        : `${playlistCount} published playlists`}
                    </span>
                  </div>
                )}

                <div
                  className={`author-profile-sort-wrap ${
                    activeProfileTab ===
                    "articles"
                      ? "person-article-sort-wrap"
                      : ""
                  }`}
                  ref={
                    sortWrapRef
                  }
                >
                  <button
                    type="button"
                    className={`author-profile-sort-trigger ${
                      sortOpen
                        ? "open"
                        : ""
                    }`}
                    onClick={() =>
                      setSortOpen(
                        (current) =>
                          !current,
                      )
                    }
                  >
                    <i
                      className={`${
                        SORT_OPTIONS.find(
                          (option) =>
                            option.mode ===
                            sortMode,
                        )?.icon ??
                        "ri-arrow-down-line"
                      } text-xs`}
                    />
                    <span>
                      {
                        SORT_OPTIONS.find(
                          (option) =>
                            option.mode ===
                            sortMode,
                        )?.label ??
                        "Sort"
                      }
                    </span>
                    <i className="ri-arrow-down-s-line text-xs author-profile-sort-chevron" />
                  </button>

                  {sortOpen ? (
                    <div className="author-profile-sort-dropdown">
                      {SORT_OPTIONS.map(
                        (
                          option,
                        ) => (
                          <button
                            type="button"
                            key={
                              option.mode
                            }
                            className={`author-profile-sort-option ${
                              sortMode ===
                              option.mode
                                ? "active"
                                : ""
                            }`}
                            onClick={() => {
                              setSortMode(
                                option.mode,
                              );
                              setSortOpen(
                                false,
                              );
                            }}
                          >
                            <i
                              className={`${option.icon} text-sm`}
                            />
                            <span>
                              {
                                option.label
                              }
                            </span>

                            {sortMode ===
                            option.mode ? (
                              <i className="ri-check-line text-sm author-profile-sort-check" />
                            ) : null}
                          </button>
                        ),
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              {filteredWork.length ===
              0 ? (
                <div className="author-profile-empty">
                  <WkIcon
                    name="SearchX"
                    size={32}
                  />
                  <div className="author-profile-empty-title">
                    {activeProfileTab ===
                    "playlists"
                      ? "No published playlists yet"
                      : `No articles in ${activeCategory}`}
                  </div>
                  <div className="author-profile-empty-sub">
                    {activeProfileTab ===
                    "playlists"
                      ? `${firstName} has no published playlists yet.`
                      : `Choose another area to see more from ${firstName}.`}
                  </div>
                  <button
                    type="button"
                    className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--wk-surface-raised)] px-4 py-2 text-sm font-bold text-[var(--wk-text)] hover:bg-[var(--wk-surface)] transition-colors cursor-pointer"
                    onClick={() =>
                      setActiveCategory(
                        "all",
                      )
                    }
                  >
                    <WkIcon
                      name="RotateCw"
                      size={14}
                    />
                    Show All
                  </button>
                </div>
              ) : null}

              {filteredWork.length >
                0 &&
              gridWork.length >
                0 &&
              rows.length > 0 ? (
                <div className="flex flex-col gap-6 sm:gap-8 lg:gap-10">
                  {rows.map(
                    (
                      row,
                      rowIndex,
                    ) => {
                      const needsSectionBreak =
                        rowIndex >
                          0 &&
                        rowIndex %
                          3 ===
                          0;

                      const sectionBreak =
                        needsSectionBreak ? (
                          <div
                            key={`section-break-${rowIndex}`}
                            className="flex items-center gap-4 my-9 sm:my-11"
                          >
                            <span className="flex-1 h-px bg-[var(--wk-divider)]" />
                            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.18em] text-[var(--wk-text-faint)] whitespace-nowrap">
                              {rowIndex <=
                              4
                                ? "More Stories"
                                : "Continuing"}
                            </span>
                            <span className="flex-1 h-px bg-[var(--wk-divider)]" />
                          </div>
                        ) : null;

                      let rowElement:
                        React.ReactNode;

                      if (
                        row.pattern ===
                          "full-bleed" &&
                        row.items[0] &&
                        !row.items[0]
                          .isPlaylist
                      ) {
                        rowElement = (
                          <FeatureWorkCard
                            key={`row-${rowIndex}`}
                            item={
                              row
                                .items[0]
                            }
                            wide
                          />
                        );
                      } else if (
                        row.pattern ===
                        "split"
                      ) {
                        if (
                          row.items
                            .length <
                            2 ||
                          row.items[0]
                            ?.isPlaylist
                        ) {
                          rowElement = (
                            <div
                              key={`row-${rowIndex}`}
                              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
                            >
                              {row.items.map(
                                (
                                  item,
                                ) => (
                                  <MediumWorkCard
                                    key={
                                      item
                                        .work
                                        .resourceId
                                    }
                                    item={
                                      item
                                    }
                                  />
                                ),
                              )}
                            </div>
                          );
                        } else {
                          rowElement = (
                            <div
                              key={`row-${rowIndex}`}
                              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
                            >
                              <div className="sm:col-span-2">
                                <FeatureWorkCard
                                  item={
                                    row
                                      .items[0]
                                  }
                                />
                              </div>

                              {row.items[1] ? (
                                <div className="sm:col-span-2 lg:col-span-1">
                                  <MediumWorkCard
                                    item={
                                      row
                                        .items[1]
                                    }
                                  />
                                </div>
                              ) : null}
                            </div>
                          );
                        }
                      } else {
                        rowElement = (
                          <div
                            key={`row-${rowIndex}`}
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
                          >
                            {row.items.map(
                              (
                                item,
                              ) => (
                                <MediumWorkCard
                                  key={
                                    item
                                      .work
                                      .resourceId
                                  }
                                  item={
                                    item
                                  }
                                />
                              ),
                            )}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={`row-wrap-${rowIndex}`}
                          className="flex flex-col"
                        >
                          {
                            sectionBreak
                          }
                          {
                            rowElement
                          }
                        </div>
                      );
                    },
                  )}
                </div>
              ) : null}

              {gridWork.length >
              0 ? (
                <div
                  ref={
                    sentinelRef
                  }
                  className="author-profile-sentinel"
                >
                  {hasMore ? (
                    <div className="author-profile-sentinel-loading">
                      <div className="author-profile-sentinel-spinner" />
                      <span>
                        {activeProfileTab ===
                        "playlists"
                          ? "Loading more playlists..."
                          : "Loading more articles..."}
                      </span>
                    </div>
                  ) : visibleCount >
                    BATCH_SIZE ? (
                    <>
                      <span className="author-profile-sentinel-line" />
                      <span className="author-profile-sentinel-text">
                        All{" "}
                        {
                          gridWork.length
                        }{" "}
                        {activeProfileTab ===
                        "playlists"
                          ? gridWork.length ===
                            1
                            ? "playlist"
                            : "playlists"
                          : gridWork.length ===
                              1
                            ? "article"
                            : "articles"}{" "}
                        loaded
                      </span>
                      <span className="author-profile-sentinel-line" />
                    </>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <div className="author-profile-empty mt-8">
              <WkIcon
                name="FileX"
                size={36}
              />
              <div className="author-profile-empty-title">
                {activeProfileTab ===
                "playlists"
                  ? "No published playlists yet"
                  : "No published articles yet"}
              </div>
              <div className="author-profile-empty-sub">
                Check back for new work from{" "}
                {firstName}.
              </div>
            </div>
          )}

          {activeProfileTab ===
            "articles" &&
          articleWork.length >
            0 ? (
            <section className="author-profile-explore">
              <p className="author-profile-explore-text">
                {firstName} is part of WAKILISHA’s cultural memory work, documenting and interpreting East African creative life.
              </p>

              <div className="author-profile-explore-links">
                <Link
                  to="/magazine"
                  className="author-profile-explore-link"
                >
                  <WkIcon
                    name="BookOpen"
                    size={15}
                  />
                  All Stories
                </Link>

                <Link
                  to="/guides"
                  className="author-profile-explore-link"
                >
                  <WkIcon
                    name="Compass"
                    size={15}
                  />
                  Guides
                </Link>

                <Link
                  to="/artists"
                  className="author-profile-explore-link"
                >
                  <WkIcon
                    name="Users"
                    size={15}
                  />
                  Artists
                </Link>
              </div>
            </section>
          ) : null}

            </>
          ) : activeProfileTab ===
              "comments" &&
            hasCommunityProfile ? (
            <div className="profile-dt-body">
              <div className="profile-dt-section-head">
                <div className="profile-dt-section-kicker">
                  Community
                </div>
                <h2 className="profile-dt-section-title">
                  Recent comments
                </h2>
              </div>

              <PersonCommunityActivityList
                items={
                  publicComments
                }
                emptyTitle="No public comments yet"
                emptyBody={`${firstName} has not posted a public comment yet.`}
              />
            </div>
          ) : activeProfileTab ===
              "replies" &&
            hasCommunityProfile ? (
            <div className="profile-dt-body">
              <div className="profile-dt-section-head">
                <div className="profile-dt-section-kicker">
                  Community
                </div>
                <h2 className="profile-dt-section-title">
                  Replies by{" "}
                  {
                    firstName
                  }
                </h2>
              </div>

              <PersonCommunityActivityList
                items={
                  publicReplies
                }
                emptyTitle="No public replies yet"
                emptyBody={`${firstName} has not posted a public reply yet.`}
              />
            </div>
          ) : activeProfileTab ===
              "saves" &&
            isOwner ? (
            <div className="profile-dt-body">
              <div className="profile-dt-section-head">
                <div className="profile-dt-section-kicker">
                  Bookmarks
                </div>
                <h2 className="profile-dt-section-title">
                  Your bookmarks
                </h2>
              </div>

              {ownerSavesLoading ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {Array.from({
                    length: 4,
                  }).map(
                    (
                      _,
                      index,
                    ) => (
                      <div
                        key={index}
                        className="h-28 animate-pulse rounded-2xl bg-[var(--wk-surface-raised)]"
                      />
                    ),
                  )}
                </div>
              ) : ownerSaves.length >
                0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {ownerSaves.map(
                    (saved) => {
                      const content = (
                        <>
                          {saved.imageUrl ? (
                            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
                              <img
                                src={
                                  saved.imageUrl
                                }
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ) : null}

                          <div className="min-w-0 flex-1">
                            <div className="mb-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">
                              {savedItemTypeLabel(
                                saved.entityType,
                              )}
                            </div>
                            <div className="text-sm font-black leading-snug text-[var(--wk-text)]">
                              {
                                saved.title
                              }
                            </div>
                            {saved.subtitle ? (
                              <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--wk-text-muted)]">
                                {
                                  saved.subtitle
                                }
                              </div>
                            ) : null}
                          </div>
                        </>
                      );

                      return saved.entityUrl ? (
                        <Link
                          key={
                            saved.id
                          }
                          to={
                            saved.entityUrl
                          }
                          className="flex gap-4 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 transition-colors hover:border-[var(--wk-border-2)]"
                        >
                          {content}
                        </Link>
                      ) : (
                        <div
                          key={
                            saved.id
                          }
                          className="flex gap-4 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4"
                        >
                          {content}
                        </div>
                      );
                    },
                  )}
                </div>
              ) : (
                <div className="py-12 text-center border border-dashed border-[var(--wk-border)] rounded-2xl">
                  <WkIcon
                    name="Bookmark"
                    size={28}
                    className="mx-auto mb-3 text-[var(--wk-text-faint)]"
                  />
                  <p className="text-sm font-bold text-[var(--wk-text-muted)]">
                    Nothing bookmarked yet.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="profile-dt-body">
              <div className="py-14 text-center border border-dashed border-[var(--wk-border)] rounded-2xl">
                <WkIcon
                  name="User"
                  size={30}
                  className="mx-auto mb-4 text-[var(--wk-text-faint)]"
                />
                <p className="text-sm font-black text-[var(--wk-text)] mb-2">
                  Profile ready
                </p>
                <p className="text-xs leading-relaxed text-[var(--wk-text-muted)] max-w-sm mx-auto">
                  Public work and community activity will appear here as this profile grows.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
