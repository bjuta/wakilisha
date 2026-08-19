import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  Link,
  useParams,
} from "react-router-dom";
import {
  WkIcon,
} from "@/components/design-system/Icon";
import {
  MetaTags,
} from "@/components/seo/MetaTags";
import {
  SchemaOrg,
} from "@/components/seo/SchemaOrg";
import {
  getVerticalColor,
} from "@/services/authorProfiles";
import {
  listMagazineArticles,
  type MagazineArticle,
} from "@/services/magazineArticles";
import {
  getPublicOrganization,
  listAllPublicOrganizationWork,
  type PublicOrganization,
  type PublicOrganizationWork,
} from "@/services/organizations/organizationPublicService";

type SortMode =
  | "latest"
  | "oldest"
  | "longest";

type OrganizationCapabilityDefinition = {
  id: string;
  label: string;
  resourceKind: string;
};

type OrganizationCapability =
  OrganizationCapabilityDefinition & {
    count: number;
    items: PublicOrganizationWork[];
  };

type WorkPresentation = {
  work: PublicOrganizationWork;
  article: MagazineArticle | null;
  section: string;
  date: string;
  readingTime: number;
  imageUrl: string | null;
  summary: string | null;
};

type WorkRow = {
  items: WorkPresentation[];
  pattern:
    | "three-up"
    | "split"
    | "full-bleed";
};

const ORGANIZATION_CAPABILITIES:
  Record<
    string,
    OrganizationCapabilityDefinition
  > = {
    article: {
      id: "articles",
      label: "Articles",
      resourceKind: "article",
    },
  };

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

const BATCH_SIZE = 8;
const LOAD_MORE = 6;
const FEATURED_COUNT = 5;

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

function canonicalArticleSlug(
  path: string,
): string | null {
  const match =
    /^\/magazine\/([^/?#]+)$/.exec(
      path,
    );

  return match?.[1] ?? null;
}

function formatPublishedDate(
  value: string,
): string {
  const date =
    new Date(value);

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

function buildCapabilities(
  work: PublicOrganizationWork[],
): OrganizationCapability[] {
  const byKind =
    new Map<
      string,
      PublicOrganizationWork[]
    >();

  for (const item of work) {
    const existing =
      byKind.get(
        item.resourceKind,
      ) ?? [];

    existing.push(item);

    byKind.set(
      item.resourceKind,
      existing,
    );
  }

  return Array.from(
    byKind.entries(),
  ).flatMap(
    ([resourceKind, items]) => {
      const definition =
        ORGANIZATION_CAPABILITIES[
          resourceKind
        ];

      if (!definition) {
        return [];
      }

      return [{
        ...definition,
        count: items.length,
        items,
      }];
    },
  );
}

function MediumWorkCard({
  item,
}: {
  item: WorkPresentation;
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
      className="group border border-[var(--wk-border)] rounded-2xl overflow-hidden bg-[var(--wk-surface)] hover:-translate-y-0.5 hover:border-[var(--wk-border-2)] transition-all duration-200 flex flex-col h-full"
    >
      <div className="aspect-[16/10] overflow-hidden bg-[var(--wk-surface-raised)]">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--wk-text-muted)]">
            <WkIcon
              name="FileText"
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
          {item.section}
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

export default function OrganizationDetailPage() {
  const {
    slug = "",
  } =
    useParams<{
      slug: string;
    }>();

  const [
    organization,
    setOrganization,
  ] =
    useState<
      PublicOrganization
      | null
    >(null);

  const [
    work,
    setWork,
  ] =
    useState<
      PublicOrganizationWork[]
    >([]);

  const [
    workViews,
    setWorkViews,
  ] =
    useState<
      WorkPresentation[]
    >([]);

  const [
    activeTab,
    setActiveTab,
  ] =
    useState("");

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
    sortOpen,
    setSortOpen,
  ] =
    useState(false);

  const [
    visibleCount,
    setVisibleCount,
  ] =
    useState(
      BATCH_SIZE,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<
      string
      | null
    >(null);

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
          setOrganization(null);
          setWork([]);
          setWorkViews([]);
          setActiveTab("");
          setActiveCategory(
            "all",
          );

          try {
            const loadedOrganization =
              await getPublicOrganization(
                slug,
              );

            if (!alive) {
              return;
            }

            if (
              !loadedOrganization
            ) {
              setError(
                "Organization not found",
              );
              return;
            }

            setOrganization(
              loadedOrganization,
            );

            const [
              loadedWork,
              magazineArticles,
            ] =
              await Promise.all([
                listAllPublicOrganizationWork(
                  loadedOrganization
                    .organizationId,
                ),
                listMagazineArticles(
                  500,
                ).catch(
                  () => [],
                ),
              ]);

            if (!alive) {
              return;
            }

            setWork(
              loadedWork,
            );

            const governedArticleSlugs =
              new Set(
                loadedWork
                  .filter(
                    (item) =>
                      item.resourceKind ===
                      "article",
                  )
                  .map(
                    (item) =>
                      canonicalArticleSlug(
                        item.canonicalPath,
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
              loadedWork
                .filter(
                  (item) =>
                    item.resourceKind ===
                    "article",
                )
                .map(
                  (
                    item,
                  ): WorkPresentation => {
                    const articleSlug =
                      canonicalArticleSlug(
                        item.canonicalPath,
                      );

                    const article =
                      articleSlug
                        ? articleBySlug.get(
                            articleSlug,
                          ) ??
                          null
                        : null;

                    return {
                      work:
                        item,
                      article,
                      section:
                        article?.section ||
                        "Article",
                      date:
                        article?.date ||
                        formatPublishedDate(
                          item.publishedAt,
                        ),
                      readingTime:
                        article?.readingTime ??
                        0,
                      imageUrl:
                        article?.heroUrl ||
                        item.imageUrl,
                      summary:
                        article?.dek ||
                        item.summary,
                    };
                  },
                );

            setWorkViews(
              presentations,
            );

            const loadedCapabilities =
              buildCapabilities(
                loadedWork,
              );

            setActiveTab(
              loadedCapabilities[0]
                ?.id ?? "",
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
                : "Failed to load Organization",
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
      slug,
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

  const capabilities =
    useMemo(
      () =>
        buildCapabilities(
          work,
        ),
      [
        work,
      ],
    );

  const activeCapability =
    useMemo(
      () =>
        capabilities.find(
          (capability) =>
            capability.id ===
            activeTab,
        ) ??
        capabilities[0] ??
        null,
      [
        activeTab,
        capabilities,
      ],
    );

  const typeLabels =
    useMemo(
      () =>
        organization?.organizationTypes
          .slice()
          .sort(
            (
              left,
              right,
            ) =>
              left.displayOrder -
              right.displayOrder,
          )
          .map(
            (type) =>
              type.label,
          ) ?? [],
      [
        organization,
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
        const filtered =
          activeCategory ===
          "all"
            ? workViews
            : workViews.filter(
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
        sortMode,
        workViews,
      ],
    );

  const featuredArticles =
    useMemo(
      () =>
        filteredWork.slice(
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
      activeTab,
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
          const cycle =
            rowIndex % 4;

          let pattern:
            WorkRow["pattern"];

          let consume:
            number;

          if (
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
    !organization
  ) {
    return (
      <main className="profile-dt-shell">
        <div className="profile-dt-content py-20 text-center">
          <WkIcon
            name="Briefcase"
            size={40}
            className="mx-auto mb-4 text-[var(--wk-text-faint)]"
          />

          <h1 className="text-xl font-black text-[var(--wk-text)] mb-2">
            Organization not found
          </h1>

          <p className="text-sm text-[var(--wk-text-muted)] mb-6">
            This Organization is not available on WAKILISHA.
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

  const canonicalUrl =
    typeof window !==
      "undefined"
      ? `${window.location.origin}${organization.canonicalPath}`
      : organization.canonicalPath;

  const description =
    organization.description ??
    `${organization.displayName} on WAKILISHA.`;

  return (
    <>
      <MetaTags
        title={
          organization.displayName
        }
        description={
          description
        }
        imageUrl={
          organization.logoUrl ??
          organization.coverUrl ??
          undefined
        }
        url={canonicalUrl}
        type="website"
      />

      <SchemaOrg
        data={{
          "@type":
            "Organization",
          name:
            organization.displayName,
          url:
            canonicalUrl,
          description:
            organization.description ??
            undefined,
          logo:
            organization.logoUrl ??
            undefined,
          sameAs:
            organization.websiteUrl
              ? [
                  organization.websiteUrl,
                ]
              : undefined,
        }}
      />

      <main className="profile-dt-shell">
        <section className="profile-dt-hero">
          <div className="profile-dt-cover">
            {organization.coverUrl ? (
              <img
                src={
                  organization.coverUrl
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
                {organization.logoUrl ? (
                  <img
                    src={
                      organization.logoUrl
                    }
                    alt={
                      organization.displayName
                    }
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[28px] font-black bg-[var(--wk-surface)] text-[var(--wk-brand)]">
                    {initials(
                      organization.displayName,
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="profile-dt-header-main">
              <div className="profile-dt-header-top">
                <div className="profile-dt-header-info">
                  <h1 className="profile-dt-name">
                    {
                      organization.displayName
                    }
                  </h1>

                  {typeLabels.length >
                  0 ? (
                    <div className="profile-dt-handle">
                      <span className="profile-dt-role">
                        {typeLabels.join(
                          " · ",
                        )}
                      </span>
                    </div>
                  ) : null}

                  {organization.description ? (
                    <p className="profile-dt-bio">
                      {
                        organization.description
                      }
                    </p>
                  ) : null}

                  {organization.location ? (
                    <div className="mt-3 flex items-center gap-1.5 text-[12px] text-[var(--wk-text-muted)]">
                      <WkIcon
                        name="MapPin"
                        size={13}
                      />
                      {
                        organization.location
                      }
                    </div>
                  ) : null}
                </div>

                <div className="profile-dt-header-actions">
                  {organization.websiteUrl ? (
                    <a
                      href={
                        organization.websiteUrl
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="profile-dt-btn-ghost"
                    >
                      Website
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {capabilities.length >
          0 ? (
            <nav
              className="profile-dt-tabbar"
              aria-label="Organization profile content"
            >
              {capabilities.map(
                (
                  capability,
                ) => (
                  <button
                    type="button"
                    key={
                      capability.id
                    }
                    className={`profile-dt-tab ${
                      activeCapability
                        ?.id ===
                      capability.id
                        ? "active"
                        : ""
                    }`}
                    onClick={() => {
                      setActiveTab(
                        capability.id,
                      );
                      setActiveCategory(
                        "all",
                      );
                    }}
                  >
                    {
                      capability.label
                    }
                    <span className="ml-1.5 text-[10px] opacity-70">
                      {
                        capability.count
                      }
                    </span>
                  </button>
                ),
              )}
            </nav>
          ) : null}

          {activeCapability
            ?.resourceKind ===
            "article" &&
          workViews.length >
            0 ? (
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
                            organization.displayName
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

              <div className="author-profile-filter-bar person-article-filter-bar">
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
                        workViews.length
                      }
                    </span>
                  </button>

                  {sections.map(
                    (
                      section,
                    ) => (
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
                                  getVerticalColor(
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

                <div
                  className="author-profile-sort-wrap person-article-sort-wrap"
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
                        (
                          current,
                        ) =>
                          !current,
                      )
                    }
                  >
                    <i
                      className={`${
                        SORT_OPTIONS.find(
                          (
                            option,
                          ) =>
                            option.mode ===
                            sortMode,
                        )?.icon ??
                        "ri-arrow-down-line"
                      } text-xs`}
                    />
                    <span>
                      {
                        SORT_OPTIONS.find(
                          (
                            option,
                          ) =>
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
                    No articles in{" "}
                    {
                      activeCategory
                    }
                  </div>
                  <div className="author-profile-empty-sub">
                    Choose another area to see more from{" "}
                    {
                      organization.displayName
                    }.
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

              {gridWork.length >
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
                        row.items[0]
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
                          2
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
                        Loading more articles...
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
                        {gridWork.length ===
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
          ) : activeCapability ? (
            <div className="author-profile-empty mt-8">
              <WkIcon
                name="FileX"
                size={36}
              />
              <div className="author-profile-empty-title">
                Nothing published here yet
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}
