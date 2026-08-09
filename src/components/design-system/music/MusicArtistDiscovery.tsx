import {
  useMemo,
  useState,
} from "react";
import {
  Link,
} from "react-router-dom";

import {
  WkIcon,
} from "@/components/design-system/Icon";
import {
  Ch19GradientImage,
} from "@/components/media/Ch19GradientImage";

export interface MusicArtistDiscoveryTrack {
  id: string;
  title: string;
  position: number;
  anchorId: string;
  artworkUrl: string | null;
}

export interface MusicArtistDiscoveryArtist {
  artistId: string;
  slug: string | null;
  name: string;
  imageUrl: string | null;
  tracks: MusicArtistDiscoveryTrack[];
  followed?: boolean;
  followPending?: boolean;
}

interface MusicArtistDiscoveryProps {
  artists: MusicArtistDiscoveryArtist[];
  eyebrow?: string;
  heading: string;
  contextLabel: string;
  onJumpTo: (
    anchorId: string,
  ) => void;
  onFollow: (
    artist: MusicArtistDiscoveryArtist,
  ) => void;
}

function ArtistCircle({
  artist,
  selected,
  onSelect,
}: {
  artist: MusicArtistDiscoveryArtist;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onSelect
      }
      aria-pressed={
        selected
      }
      className={[
        "flex w-[78px] shrink-0 cursor-pointer flex-col items-center gap-2 rounded-xl p-1.5 text-center transition-all",
        selected
          ? "bg-[var(--wk-brand-soft)] opacity-100"
          : "opacity-75 hover:bg-[var(--wk-surface-raised)] hover:opacity-100",
      ].join(
        " ",
      )}
    >
      <div
        className={[
          "h-[68px] w-[68px] overflow-hidden rounded-full border-2 bg-[var(--wk-surface-raised)] transition-colors",
          selected
            ? "border-[var(--wk-brand)]"
            : "border-[var(--wk-border)]",
        ].join(
          " ",
        )}
      >
        {
          artist.imageUrl
            ? (
                <img
                  src={
                    artist.imageUrl
                  }
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover object-top"
                />
              )
            : (
                <Ch19GradientImage
                  slug={
                    artist.slug ??
                    artist.artistId
                  }
                  name={
                    artist.name
                  }
                />
              )
        }
      </div>

      <div className="w-full">
        <div className="truncate text-[11px] font-extrabold text-[var(--wk-text)]">
          {
            artist.name
          }
        </div>

        {
          artist.tracks.length > 1
            ? (
                <div className="mt-0.5 text-[9px] font-bold text-[var(--wk-brand)]">
                  {
                    artist.tracks.length
                  } tracks
                </div>
              )
            : null
        }
      </div>
    </button>
  );
}

export function MusicArtistDiscovery({
  artists,
  eyebrow = "Discover",
  heading,
  contextLabel,
  onJumpTo,
  onFollow,
}: MusicArtistDiscoveryProps) {
  const [
    selectedArtistId,
    setSelectedArtistId,
  ] =
    useState<string | null>(
      null,
    );

  const selected =
    useMemo(
      () =>
        artists.find(
          (
            artist,
          ) =>
            artist.artistId ===
            selectedArtistId,
        ) ??
        null,
      [
        artists,
        selectedArtistId,
      ],
    );

  if (
    artists.length === 0
  ) {
    return null;
  }

  return (
    <section className="wk-container-wide px-5 pb-10 md:px-6 md:pb-14">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <div className="wk-eyebrow mb-1.5">
              {
                eyebrow
              }
            </div>

            <h2 className="wk-h-section">
              {
                heading
              }
            </h2>

            <p className="mt-1 text-[13px] text-[var(--wk-text-muted)]">
              {
                artists.length
              } artist{
                artists.length === 1
                  ? ""
                  : "s"
              } across this Playlist
            </p>
          </div>

          {
            selected
              ? (
                  <button
                    type="button"
                    onClick={
                      () =>
                        setSelectedArtistId(
                          null,
                        )
                    }
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--wk-text-faint)] transition-colors hover:text-[var(--wk-text)]"
                  >
                    <WkIcon
                      name="X"
                      size={
                        13
                      }
                    />
                    Clear
                  </button>
                )
              : null
          }
        </div>

        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 scrollbar-hide sm:gap-4">
          {
            artists.map(
              (
                artist,
              ) => (
                <ArtistCircle
                  key={
                    artist.artistId
                  }
                  artist={
                    artist
                  }
                  selected={
                    selectedArtistId ===
                    artist.artistId
                  }
                  onSelect={
                    () =>
                      setSelectedArtistId(
                        (
                          current,
                        ) =>
                          current ===
                          artist.artistId
                            ? null
                            : artist.artistId,
                      )
                  }
                />
              ),
            )
          }
        </div>

        <div
          style={{
            display:
              "grid",
            gridTemplateRows:
              selected
                ? "1fr"
                : "0fr",
            transition:
              "grid-template-rows 220ms ease",
          }}
        >
          <div className="overflow-hidden">
            {
              selected
                ? (
                    <div className="mt-4 rounded-2xl border border-[var(--wk-brand)]/20 bg-[var(--wk-surface)] p-4 md:p-5">
                      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-[var(--wk-brand)]/30 bg-[var(--wk-surface-raised)]">
                            {
                              selected.imageUrl
                                ? (
                                    <img
                                      src={
                                        selected.imageUrl
                                      }
                                      alt=""
                                      className="h-full w-full object-cover object-top"
                                    />
                                  )
                                : (
                                    <Ch19GradientImage
                                      slug={
                                        selected.slug ??
                                        selected.artistId
                                      }
                                      name={
                                        selected.name
                                      }
                                    />
                                  )
                            }
                          </div>

                          <div className="min-w-0">
                            {
                              selected.slug
                                ? (
                                    <Link
                                      to={
                                        `/artists/${selected.slug}`
                                      }
                                      className="truncate text-[17px] font-black text-[var(--wk-text)] transition-colors hover:text-[var(--wk-brand)]"
                                    >
                                      {
                                        selected.name
                                      }
                                    </Link>
                                  )
                                : (
                                    <div className="truncate text-[17px] font-black text-[var(--wk-text)]">
                                      {
                                        selected.name
                                      }
                                    </div>
                                  )
                            }

                            <div className="mt-0.5 text-[11px] text-[var(--wk-text-muted)]">
                              {
                                selected.tracks.length
                              } track{
                                selected.tracks.length === 1
                                  ? ""
                                  : "s"
                              } in {
                                contextLabel
                              }
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={
                              () =>
                                onFollow(
                                  selected,
                                )
                            }
                            disabled={
                              selected.followPending
                            }
                            aria-pressed={
                              selected.followed
                            }
                            className={[
                              "wk-button",
                              selected.followed
                                ? "wk-button-soft"
                                : "wk-button-primary",
                            ].join(
                              " ",
                            )}
                          >
                            <WkIcon
                              name={
                                selected.followed
                                  ? "UserCheck"
                                  : "UserPlus"
                              }
                              size={
                                14
                              }
                            />
                            {
                              selected.followPending
                                ? "Updating..."
                                : selected.followed
                                  ? "Following"
                                  : "Follow"
                            }
                          </button>

                          {
                            selected.slug
                              ? (
                                  <Link
                                    to={
                                      `/artists/${selected.slug}`
                                    }
                                    className="wk-button wk-button-soft"
                                  >
                                    Artist page
                                    <WkIcon
                                      name="ArrowUpRight"
                                      size={
                                        12
                                      }
                                    />
                                  </Link>
                                )
                              : null
                          }
                        </div>
                      </div>

                      <div className="mt-4 space-y-1 border-t border-[var(--wk-border)] pt-3">
                        {
                          selected.tracks.map(
                            (
                              track,
                            ) => (
                              <div
                                key={
                                  track.id
                                }
                                className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--wk-surface-raised)]"
                              >
                                <div className="w-7 shrink-0 text-right text-[12px] font-black tabular-nums text-[var(--wk-text-faint)]">
                                  {
                                    String(
                                      track.position,
                                    ).padStart(
                                      2,
                                      "0",
                                    )
                                  }
                                </div>

                                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]">
                                  {
                                    track.artworkUrl
                                      ? (
                                          <img
                                            src={
                                              track.artworkUrl
                                            }
                                            alt=""
                                            loading="lazy"
                                            className="h-full w-full object-cover"
                                          />
                                        )
                                      : (
                                          <Ch19GradientImage
                                            slug={
                                              track.id
                                            }
                                            name={
                                              track.title
                                            }
                                          />
                                        )
                                  }
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-[13px] font-bold text-[var(--wk-text)]">
                                    {
                                      track.title
                                    }
                                  </div>

                                  <div className="text-[10px] text-[var(--wk-text-faint)]">
                                    Track {
                                      track.position
                                    }
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={
                                    () =>
                                      onJumpTo(
                                        track.anchorId,
                                      )
                                  }
                                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--wk-brand)] px-2.5 py-1 text-[10px] font-bold text-[var(--wk-brand-on)] transition-opacity hover:opacity-75"
                                >
                                  Jump
                                  <WkIcon
                                    name="ArrowDown"
                                    size={
                                      10
                                    }
                                  />
                                </button>
                              </div>
                            ),
                          )
                        }
                      </div>
                    </div>
                  )
                : null
            }
          </div>
        </div>
      </div>
    </section>
  );
}
