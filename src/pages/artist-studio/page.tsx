import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  Link,
  useSearchParams,
} from "react-router-dom";
import {
  MetaTags,
} from "@/components/seo/MetaTags";
import {
  ArtistClaimSheet,
} from "@/components/artists/ArtistClaimSheet";
import {
  NewArtistClaimSheet,
} from "@/components/artists/NewArtistClaimSheet";
import {
  useAuthUser,
} from "@/hooks/useAuthUser";
import {
  acceptArtistRepresentation,
  getArtistRepresentationState,
  type ArtistRepresentationState,
} from "@/services/artists/claimedArtist";
import {
  searchArtistStudioRegistry,
  type ArtistStudioRegistryCandidate,
} from "@/services/artists/artistStudioRegistry";
import {
  createNewArtistClaimFlowId,
} from "@/services/artists/newArtistClaimDraft";

const SITE_URL =
  "https://wakilisha.africa";

const HERO_IMAGE =
  "/assets/artist-studio/kenyan-creative-community.webp";

type CandidateAuthorityMap =
  Record<
    string,
    ArtistRepresentationState | null
  >;

function hasStudioPermission(
  state:
    ArtistRepresentationState | null,
) {
  const representation =
    state?.representation;

  if (
    representation?.status !==
    "active"
  ) {
    return false;
  }

  return Object.values(
    representation.permissions,
  ).some(Boolean);
}

function CandidateCard({
  candidate,
  authority,
  authorityLoading,
  authLoading,
  signedIn,
  onClaim,
  onAcceptInvitation,
}: {
  candidate:
    ArtistStudioRegistryCandidate;
  authority:
    ArtistRepresentationState | null;
  authorityLoading: boolean;
  authLoading: boolean;
  signedIn: boolean;
  onClaim: () => void;
  onAcceptInvitation:
    () => void;
}) {
  const representation =
    authority?.representation;
  const pendingClaim =
    authority?.latestClaim?.status ===
    "pending";
  const canManage =
    hasStudioPermission(
      authority,
    );
  const pendingInvitation =
    representation?.status ===
    "pending";
  const canClaim =
    !signedIn ||
    authority?.canClaim ===
      true;
  const representedWithoutScope =
    representation?.status ===
      "active" &&
    !canManage;

  const secondary =
    candidate.registryState ===
    "active"
      ? [
          candidate.artistType,
          candidate.country,
        ]
          .filter(Boolean)
          .join(" · ")
      : [
          candidate.artistType,
          candidate.country,
          "Already in the Registry",
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[var(--wk-surface-raised)]">
          {candidate.imageUrl ? (
            <img
              src={
                candidate.imageUrl
              }
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-[18px] font-black text-[var(--wk-brand)]">
              {candidate.displayName
                .slice(0, 1)
                .toUpperCase()}
            </span>
          )}
        </div>

        <div className="min-w-0">
          {candidate.publicPath ? (
            <Link
              to={
                candidate.publicPath
              }
              className="truncate text-[16px] font-black tracking-[-0.02em] text-[var(--wk-text)] transition-colors hover:text-[var(--wk-brand)]"
            >
              {candidate.displayName}
            </Link>
          ) : (
            <div className="truncate text-[16px] font-black tracking-[-0.02em] text-[var(--wk-text)]">
              {candidate.displayName}
            </div>
          )}

          <div className="mt-1 text-[11px] font-semibold text-[var(--wk-text-muted)]">
            {secondary ||
              "WAKILISHA Registry"}
          </div>
        </div>
      </div>

      <div className="shrink-0">
        {authorityLoading ||
        authLoading ? (
          <span className="text-[11px] font-bold text-[var(--wk-text-faint)]">
            Checking access…
          </span>
        ) : canManage ? (
          <Link
            to={`/artists/${candidate.slug}/manage`}
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--wk-brand)] px-4 text-[12px] font-black text-[var(--wk-brand-on)]"
          >
            Manage this Artist
          </Link>
        ) : pendingInvitation ? (
          <button
            type="button"
            onClick={
              onAcceptInvitation
            }
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--wk-brand)] px-4 text-[12px] font-black text-[var(--wk-brand-on)]"
          >
            Accept Invitation
          </button>
        ) : pendingClaim ? (
          <span className="inline-flex min-h-10 items-center rounded-full bg-[var(--wk-brand-soft)] px-4 text-[11px] font-black text-[var(--wk-brand)]">
            Claim under review
          </span>
        ) : representedWithoutScope ? (
          <span className="inline-flex min-h-10 items-center rounded-full border border-[var(--wk-border)] px-4 text-[11px] font-black text-[var(--wk-text-muted)]">
            No Studio access
          </span>
        ) : canClaim ? (
          <button
            type="button"
            onClick={onClaim}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 text-[12px] font-black text-[var(--wk-text)] transition-colors hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]"
          >
            Claim this Artist
          </button>
        ) : null}
      </div>
    </article>
  );
}

const VALUE_CARDS = [
  {
    icon: "ri-user-smile-line",
    title: "Manage Your Profile",
    preview: "profile",
  },
  {
    icon: "ri-broadcast-line",
    title: "Publish Updates",
    preview: "updates",
  },
  {
    icon: "ri-music-2-line",
    title: "Submit Your Music",
    preview: "music",
  },
  {
    icon: "ri-line-chart-line",
    title: "See Your Momentum",
    preview: "insights",
  },
] as const;

function ValuePreview({
  kind,
}: {
  kind:
    (typeof VALUE_CARDS)[number]["preview"];
}) {
  if (kind === "profile") {
    return (
      <div className="mt-5 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
            <i className="ri-user-line" />
          </span>
          <div className="flex-1 space-y-1.5">
            <div className="h-2 w-20 rounded-full bg-[var(--wk-text)]/70" />
            <div className="h-1.5 w-28 rounded-full bg-[var(--wk-divider)]" />
          </div>
          <i className="ri-edit-line text-[var(--wk-text-muted)]" />
        </div>
      </div>
    );
  }

  if (kind === "updates") {
    return (
      <div className="mt-5 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3">
        <div className="text-[10px] font-black text-[var(--wk-text)]">
          New Update
        </div>
        <div className="mt-2 h-1.5 w-4/5 rounded-full bg-[var(--wk-divider)]" />
        <div className="mt-1.5 h-1.5 w-3/5 rounded-full bg-[var(--wk-divider)]" />
        <div className="mt-3 text-[9px] font-black text-[var(--wk-brand)]">
          Published
        </div>
      </div>
    );
  }

  if (kind === "music") {
    return (
      <div className="mt-5 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--wk-surface-raised)]">
            <i className="ri-play-fill" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black text-[var(--wk-text)]">
              New Track
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--wk-divider)]">
              <div className="h-full w-2/5 rounded-full bg-[var(--wk-brand)]" />
            </div>
          </div>
        </div>
        <div className="mt-3 text-[9px] font-black text-[var(--wk-brand)]">
          Submitted
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3">
      <div className="flex items-end gap-1.5">
        {[28, 42, 34, 58, 49, 76, 68, 92].map(
          (height, index) => (
            <span
              key={index}
              className="flex-1 rounded-t-sm bg-[var(--wk-brand)]/80"
              style={{
                height,
              }}
            />
          ),
        )}
      </div>
      <div className="mt-3 text-[9px] font-black text-[var(--wk-text-muted)]">
        Views · Plays · Shares
      </div>
    </div>
  );
}

export default function ArtistStudioPage() {
  const authUser =
    useAuthUser();
  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();
  const initialQuery =
    searchParams.get("q") ?? "";
  const [query, setQuery] =
    useState(initialQuery);
  const [
    submittedQuery,
    setSubmittedQuery,
  ] = useState(initialQuery);
  const [
    searchCommitted,
    setSearchCommitted,
  ] = useState(
    initialQuery.trim().length >= 2,
  );
  const [
    candidates,
    setCandidates,
  ] = useState<
    ArtistStudioRegistryCandidate[]
  >([]);
  const [
    searching,
    setSearching,
  ] = useState(false);
  const [
    searchError,
    setSearchError,
  ] = useState("");
  const [
    candidateAuthority,
    setCandidateAuthority,
  ] =
    useState<CandidateAuthorityMap>({});
  const [
    authorityLoading,
    setAuthorityLoading,
  ] = useState(false);
  const [
    claimCandidate,
    setClaimCandidate,
  ] =
    useState<ArtistStudioRegistryCandidate | null>(
      null,
    );
  const [
    newArtistOpen,
    setNewArtistOpen,
  ] = useState(
    () =>
      searchParams.get("new") ===
      "1",
  );
  const [
    newArtistFlowId,
    setNewArtistFlowId,
  ] = useState(
    () =>
      searchParams.get("flow") ??
      "",
  );
  const [
    actionMessage,
    setActionMessage,
  ] = useState("");

  const claimId =
    searchParams.get("claim");

  useEffect(() => {
    const shouldOpen =
      searchParams.get("new") ===
      "1";
    const flowId =
      searchParams.get("flow");

    if (
      shouldOpen &&
      flowId
    ) {
      setNewArtistFlowId(
        flowId,
      );
      setNewArtistOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (
      submittedQuery.trim().length <
      2
    ) {
      setCandidates([]);
      setSearchError("");
      return;
    }

    let active = true;
    setSearching(true);
    setSearchError("");

    const timer =
      window.setTimeout(() => {
        searchArtistStudioRegistry(
          submittedQuery,
          8,
        )
          .then((items) => {
            if (!active) return;
            setCandidates(items);
          })
          .catch((error) => {
            if (!active) return;
            setCandidates([]);
            setSearchError(
              error instanceof Error
                ? error.message
                : "Could not search the Registry.",
            );
          })
          .finally(() => {
            if (active) {
              setSearching(false);
            }
          });
      }, 160);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [submittedQuery]);

  useEffect(() => {
    let active = true;

    if (
      authUser.loading ||
      !authUser.id ||
      candidates.length === 0
    ) {
      setCandidateAuthority({});
      setAuthorityLoading(false);
      return () => {
        active = false;
      };
    }

    setAuthorityLoading(true);

    Promise.all(
      candidates.map(
        async (candidate) => {
          try {
            return [
              candidate.artistId,
              await getArtistRepresentationState(
                candidate.artistId,
              ),
            ] as const;
          } catch {
            return [
              candidate.artistId,
              null,
            ] as const;
          }
        },
      ),
    )
      .then((entries) => {
        if (!active) return;
        setCandidateAuthority(
          Object.fromEntries(
            entries,
          ),
        );
      })
      .finally(() => {
        if (active) {
          setAuthorityLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    authUser.id,
    authUser.loading,
    candidates,
  ]);

  useEffect(() => {
    if (!claimId) return;

    const candidate =
      candidates.find(
        (item) =>
          item.artistId ===
          claimId,
      );

    if (candidate) {
      setClaimCandidate(
        candidate,
      );
    }
  }, [
    candidates,
    claimId,
  ]);

  const strongMatch =
    useMemo(
      () =>
        candidates.some(
          (candidate) =>
            candidate.matchTier ===
              "exact" ||
            candidate.matchTier ===
              "strong",
        ),
      [candidates],
    );

  function handleArtistSearchInput(
    value: string,
  ) {
    setQuery(value);
    setSearchError("");
    setActionMessage("");
    setSearchCommitted(false);

    const clean =
      value.trim();

    if (clean.length < 2) {
      setSubmittedQuery("");
      setCandidates([]);
      return;
    }

    setSubmittedQuery(clean);
  }

  function commitSearch(
    event?: FormEvent,
  ) {
    event?.preventDefault();

    const clean =
      query.trim();

    if (clean.length < 2) {
      setSearchError(
        "Enter at least two characters.",
      );
      return;
    }

    setSearchCommitted(true);
    setSubmittedQuery(clean);
    setSearchParams(
      (current) => {
        const next =
          new URLSearchParams(
            current,
          );

        next.set("q", clean);
        next.delete("claim");

        return next;
      },
      {
        replace: true,
      },
    );
  }

  function openClaim(
    candidate:
      ArtistStudioRegistryCandidate,
  ) {
    setActionMessage("");
    setClaimCandidate(
      candidate,
    );
    setSearchParams(
      (current) => {
        const next =
          new URLSearchParams(
            current,
          );

        next.set(
          "q",
          submittedQuery,
        );
        next.set(
          "claim",
          candidate.artistId,
        );

        return next;
      },
      {
        replace: true,
      },
    );
  }

  function closeClaim() {
    setClaimCandidate(null);
    setSearchParams(
      (current) => {
        const next =
          new URLSearchParams(
            current,
          );

        next.delete("claim");
        return next;
      },
      {
        replace: true,
      },
    );
  }

  function openNewArtist() {
    const flowId =
      newArtistFlowId ||
      createNewArtistClaimFlowId();

    setNewArtistFlowId(
      flowId,
    );
    setNewArtistOpen(true);
    setClaimCandidate(null);

    setSearchParams(
      (current) => {
        const next =
          new URLSearchParams(
            current,
          );

        next.set(
          "q",
          submittedQuery,
        );
        next.delete("claim");
        next.set("new", "1");
        next.set(
          "flow",
          flowId,
        );

        return next;
      },
      {
        replace: true,
      },
    );
  }

  function closeNewArtist(
    clearFlow = false,
  ) {
    setNewArtistOpen(false);

    setSearchParams(
      (current) => {
        const next =
          new URLSearchParams(
            current,
          );

        next.delete("new");

        if (clearFlow) {
          next.delete("flow");
        }

        return next;
      },
      {
        replace: true,
      },
    );

    if (clearFlow) {
      setNewArtistFlowId("");
    }
  }

  async function acceptInvitation(
    candidate:
      ArtistStudioRegistryCandidate,
  ) {
    const representation =
      candidateAuthority[
        candidate.artistId
      ]?.representation;

    if (
      representation?.status !==
      "pending"
    ) {
      return;
    }

    setActionMessage("");

    try {
      await acceptArtistRepresentation(
        representation.id,
      );

      const state =
        await getArtistRepresentationState(
          candidate.artistId,
        );

      setCandidateAuthority(
        (current) => ({
          ...current,
          [candidate.artistId]:
            state,
        }),
      );
    } catch (error) {
      setActionMessage(
        error instanceof Error
          ? error.message
          : "We could not accept this invitation.",
      );
    }
  }

  const canOfferNew =
    submittedQuery.trim().length >=
      2 &&
    !searching &&
    !searchError;

  return (
    <>
      <MetaTags
        title="Artist Studio | WAKILISHA"
        description="Find your Artist in the WAKILISHA Registry, claim your profile, submit music, and manage your Artist presence."
        url={`${SITE_URL}/artist-studio`}
      />

      <main className="pb-16 lg:pb-24">
        <section
          className="relative overflow-hidden bg-[#11120f] text-white"
          style={{
            backgroundImage:
              `linear-gradient(90deg, rgba(7,8,6,.96) 0%, rgba(7,8,6,.82) 42%, rgba(7,8,6,.28) 76%, rgba(7,8,6,.42) 100%), url("${HERO_IMAGE}")`,
            backgroundPosition:
              "center",
            backgroundSize:
              "cover",
          }}
        >
          <div className="mx-auto flex min-h-[470px] w-full max-w-7xl items-end px-4 py-9 sm:px-6 sm:py-12 lg:min-h-[520px] lg:items-center lg:px-10">
            <div className="w-full max-w-2xl">
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)]">
                Artist Studio
              </div>

              <h1 className="mt-3 max-w-xl text-[42px] font-black leading-[0.96] tracking-[-0.055em] text-white sm:text-[56px] lg:text-[66px]">
                Your music.
                <br />
                Your place.
              </h1>

              <p className="mt-4 max-w-lg text-[15px] font-medium leading-6 text-white/78 sm:text-[17px]">
                Find your Artist on WAKILISHA. Claim it, add music, and keep your profile current.
              </p>

              <form
                onSubmit={
                  commitSearch
                }
                className="mt-7"
              >
                <div className="flex min-h-14 items-center gap-3 rounded-2xl bg-white px-4 shadow-2xl shadow-black/20 sm:min-h-16 sm:rounded-full sm:px-5">
                  <i className="ri-search-line text-[20px] text-black/45" />
                  <input
                    value={query}
                    onChange={(event) =>
                      handleArtistSearchInput(
                        event.target.value,
                      )
                    }
                    placeholder="Find your Artist"
                    aria-label="Find your Artist"
                    className="min-w-0 flex-1 bg-transparent text-[15px] font-bold text-black outline-none placeholder:font-semibold placeholder:text-black/40 sm:text-[16px]"
                  />
                  <button
                    type="submit"
                    className="hidden min-h-10 shrink-0 rounded-full bg-[var(--wk-brand)] px-5 text-[12px] font-black text-[var(--wk-brand-on)] sm:inline-flex sm:items-center"
                  >
                    Search the Registry
                  </button>
                </div>

                {query.trim().length >=
                  2 &&
                !searchCommitted ? (
                  <div className="mt-2 max-h-[420px] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[var(--wk-surface)] p-2 text-[var(--wk-text)] shadow-2xl">
                    {searching ? (
                      <div className="px-3 py-4 text-[12px] font-semibold text-[var(--wk-text-muted)]">
                        Searching the Registry…
                      </div>
                    ) : searchError ? (
                      <div className="px-3 py-4 text-[12px] text-red-700">
                        {searchError}
                      </div>
                    ) : candidates.length >
                      0 ? (
                      <div className="grid gap-2">
                        {candidates
                          .slice(0, 6)
                          .map(
                            (candidate) => (
                              <CandidateCard
                                key={
                                  candidate.artistId
                                }
                                candidate={
                                  candidate
                                }
                                authority={
                                  candidateAuthority[
                                    candidate
                                      .artistId
                                  ] ??
                                  null
                                }
                                authorityLoading={
                                  authorityLoading
                                }
                                authLoading={
                                  authUser.loading
                                }
                                signedIn={Boolean(
                                  authUser.id,
                                )}
                                onClaim={() =>
                                  openClaim(
                                    candidate,
                                  )
                                }
                                onAcceptInvitation={() =>
                                  void acceptInvitation(
                                    candidate,
                                  )
                                }
                              />
                            ),
                          )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={openNewArtist}
                        className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-4 text-left hover:bg-[var(--wk-surface-raised)]"
                      >
                        <span>
                          <span className="block text-[13px] font-black text-[var(--wk-text)]">
                            No close Registry match
                          </span>
                          <span className="mt-1 block text-[11px] text-[var(--wk-text-muted)]">
                            Propose this Artist as a new Registry entry.
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] font-black text-[var(--wk-brand)]">
                          Add New Artist
                        </span>
                      </button>
                    )}
                  </div>
                ) : null}

                <button
                  type="submit"
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--wk-brand)] px-5 text-[12px] font-black text-[var(--wk-brand-on)] sm:hidden"
                >
                  Search the Registry
                </button>
              </form>
            </div>
          </div>
        </section>

        {searchCommitted &&
        (submittedQuery ||
          searching ||
          searchError) ? (
          <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
                  Registry Search
                </div>
                <h2 className="mt-1 text-[24px] font-black tracking-[-0.035em] text-[var(--wk-text)]">
                  {submittedQuery
                    ? `Results for “${submittedQuery}”`
                    : "Find Your Artist"}
                </h2>
              </div>

              {canOfferNew &&
              candidates.length >
                0 ? (
                <button
                  type="button"
                  onClick={openNewArtist}
                  className="text-[11px] font-black text-[var(--wk-text-muted)] transition-colors hover:text-[var(--wk-brand)]"
                >
                  None of These Are Me
                </button>
              ) : null}
            </div>

            {actionMessage ? (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-semibold text-red-800">
                {actionMessage}
              </div>
            ) : null}

            {searching ? (
              <div
                className="mt-5 grid gap-3"
                aria-busy="true"
                aria-label="Searching the Registry"
              >
                {[0, 1, 2].map(
                  (item) => (
                    <div
                      key={item}
                      className="h-20 animate-pulse rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]"
                    />
                  ),
                )}
              </div>
            ) : null}

            {!searching &&
            searchError ? (
              <div className="mt-5 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 text-[13px] text-[var(--wk-text-muted)]">
                {searchError}
              </div>
            ) : null}

            {!searching &&
            !searchError &&
            candidates.length >
              0 ? (
              <div className="mt-5 grid gap-3">
                {candidates.map(
                  (candidate) => (
                    <CandidateCard
                      key={
                        candidate.artistId
                      }
                      candidate={
                        candidate
                      }
                      authority={
                        candidateAuthority[
                          candidate.artistId
                        ] ?? null
                      }
                      authorityLoading={
                        authorityLoading
                      }
                      authLoading={
                        authUser.loading
                      }
                      signedIn={
                        Boolean(
                          authUser.id,
                        )
                      }
                      onClaim={() =>
                        openClaim(
                          candidate,
                        )
                      }
                      onAcceptInvitation={() =>
                        void acceptInvitation(
                          candidate,
                        )
                      }
                    />
                  ),
                )}
              </div>
            ) : null}

            {canOfferNew &&
            candidates.length ===
              0 ? (
              <div className="mt-5 flex flex-col gap-4 rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-[16px] font-black text-[var(--wk-text)]">
                    No close Registry match
                  </h3>
                  <p className="mt-1 text-[12px] leading-5 text-[var(--wk-text-muted)]">
                    If this Artist is missing, you can propose a new Registry entry.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openNewArtist}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--wk-brand)] px-5 text-[12px] font-black text-[var(--wk-brand-on)]"
                >
                  Add New Artist
                </button>
              </div>
            ) : null}

            {strongMatch &&
            canOfferNew ? (
              <p className="mt-4 text-[10px] font-semibold leading-5 text-[var(--wk-text-faint)]">
                We found a close Registry match. Check it before proposing another Artist.
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {VALUE_CARDS.map(
              (card) => (
                <article
                  key={card.title}
                  className="rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
                    <i
                      className={`${card.icon} text-[18px]`}
                    />
                  </span>
                  <h2 className="mt-4 text-[16px] font-black tracking-[-0.02em] text-[var(--wk-text)]">
                    {card.title}
                  </h2>
                  <ValuePreview
                    kind={
                      card.preview
                    }
                  />
                </article>
              ),
            )}
          </div>

          <div className="mt-10 border-t border-[var(--wk-divider)] pt-7">
            <div className="text-[11px] font-black text-[var(--wk-brand)]">
              How It Works
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {[
                [
                  "1",
                  "Find Your Artist",
                  "Search before anything else.",
                ],
                [
                  "2",
                  "Claim and Verify",
                  "Tell us how you’re connected.",
                ],
                [
                  "3",
                  "Use Artist Studio",
                  "Work within your approved access.",
                ],
              ].map(
                ([
                  number,
                  title,
                  body,
                ]) => (
                  <div
                    key={number}
                    className="flex items-start gap-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--wk-brand-soft)] text-[13px] font-black text-[var(--wk-brand)]">
                      {number}
                    </span>
                    <div>
                      <h3 className="text-[13px] font-black text-[var(--wk-text)]">
                        {title}
                      </h3>
                      <p className="mt-1 text-[11px] leading-5 text-[var(--wk-text-muted)]">
                        {body}
                      </p>
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>

          <div className="mt-10 overflow-hidden rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-brand-soft)]">
            <div className="grid gap-0 md:grid-cols-[1.05fr_.95fr]">
              <div
                className="min-h-[220px] bg-[#151711]"
                style={{
                  backgroundImage:
                    `linear-gradient(90deg, rgba(11,12,9,.2), rgba(11,12,9,.38)), url("${HERO_IMAGE}")`,
                  backgroundPosition:
                    "center 58%",
                  backgroundSize:
                    "cover",
                }}
              />
              <div className="flex flex-col justify-center p-6 sm:p-8">
                <div className="text-[22px] font-black leading-tight tracking-[-0.035em] text-[var(--wk-text)]">
                  Built around the people doing the work.
                </div>
                <p className="mt-3 max-w-md text-[13px] leading-6 text-[var(--wk-text-muted)]">
                  Your Registry identity, your approved team, your music, and your audience tools meet in one place.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {[
                    "Profile",
                    "Music",
                    "Updates",
                    "Team",
                    "Insights",
                  ].map(
                    (item) => (
                      <span
                        key={item}
                        className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)]/65 px-3 py-1.5 text-[10px] font-black text-[var(--wk-text-muted)]"
                      >
                        {item}
                      </span>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {claimCandidate ? (
        <ArtistClaimSheet
          open
          artistId={
            claimCandidate.artistId
          }
          artistSlug={
            claimCandidate.slug
          }
          artistName={
            claimCandidate.displayName
          }
          userId={
            authUser.id ||
            undefined
          }
          authLoading={
            authUser.loading
          }
          returnTo={`/artist-studio?q=${encodeURIComponent(
            submittedQuery,
          )}&claim=${encodeURIComponent(
            claimCandidate.artistId,
          )}`}
          onClose={
            closeClaim
          }
          onSubmitted={async () => {
            const state =
              await getArtistRepresentationState(
                claimCandidate.artistId,
              );

            setCandidateAuthority(
              (current) => ({
                ...current,
                [claimCandidate.artistId]:
                  state,
              }),
            );
            closeClaim();
          }}
        />
      ) : null}

      {newArtistOpen &&
      newArtistFlowId ? (
        <NewArtistClaimSheet
          open
          flowId={
            newArtistFlowId
          }
          initialName={
            submittedQuery
          }
          userId={
            authUser.id ||
            undefined
          }
          authLoading={
            authUser.loading
          }
          returnTo={`/artist-studio?q=${encodeURIComponent(
            submittedQuery,
          )}&new=1&flow=${encodeURIComponent(
            newArtistFlowId,
          )}`}
          onClose={() =>
            closeNewArtist(
              false,
            )
          }
          onSubmitted={() => {
            setActionMessage(
              "Your Artist claim is under review.",
            );
            closeNewArtist(
              true,
            );
          }}
        />
      ) : null}
    </>
  );
}
