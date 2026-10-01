import {
  useEffect,
  useRef,
  useState,
} from "react";
import { Sheet } from "@/components/design-system/primitives/Sheet";
import { WkButton } from "@/components/design-system/primitives/Button";
import { WkIcon } from "@/components/design-system/Icon";
import {
  createMusicCreditInvitation,
  createMyMusicCreditAttestation,
  getMusicCreditTrackById,
  getPublicTrackProvenanceById,
  listMusicCreditTracks,
  searchMusicCreditPeople,
  searchMusicCreditTracks,
  type MusicCreditPersonCandidate,
  type MusicCreditTrackCandidate,
} from "@/services/musicProvenance";

const RECORDING_ROLES = [
  ["primary_performer", "Primary performer"],
  ["featured_performer", "Featured performer"],
  ["performer", "Performer"],
  ["producer", "Producer"],
  ["recording_engineer", "Recording engineer"],
  ["mixing_engineer", "Mixing engineer"],
  ["mastering_engineer", "Mastering engineer"],
  ["session_musician", "Session musician"],
  ["conductor", "Conductor"],
  ["vocalist", "Vocalist"],
  ["instrumentalist", "Instrumentalist"],
] as const;

const WORK_ROLES = [
  ["composer", "Composer"],
  ["lyricist", "Lyricist"],
  ["songwriter", "Songwriter"],
  ["arranger", "Arranger"],
  ["adaptor", "Adaptor"],
  ["translator", "Translator"],
] as const;

type CreditLayer = "recording" | "work";
type ContributorMode = "self" | "person" | "unlisted";

function makeIdempotencyKey(): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : String(Date.now()) + "-" + Math.random().toString(16).slice(2);
  return "music-credit:" + id;
}

function TrackResult({
  track,
  selected,
  onSelect,
}: {
  track: MusicCreditTrackCandidate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={[
        "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
        selected
          ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)]"
          : "border-[var(--wk-border)] bg-[var(--wk-bg)] hover:bg-[var(--wk-surface-raised)]",
      ].join(" ")}
    >
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
        {track.artworkUrl ? (
          <img
            src={track.artworkUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[var(--wk-brand)]">
            <WkIcon name="Music" size={18} />
          </span>
        )}
      </div>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-black text-[var(--wk-text)]">
          {track.title}
        </span>
        <span className="mt-0.5 block truncate text-[11px] font-semibold text-[var(--wk-text-muted)]">
          {track.artist}
        </span>
      </span>
      {selected ? (
        <WkIcon name="CheckCircle" size={18} className="text-[var(--wk-brand)]" />
      ) : null}
    </button>
  );
}

export function ClaimComposer({
  open,
  onClose,
  initialTrackId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initialTrackId?: string | null;
  onSaved?: () => void | Promise<void>;
}) {
  const [tracks, setTracks] =
    useState<MusicCreditTrackCandidate[]>([]);
  const [tracksLoading, setTracksLoading] =
    useState(false);
  const [trackQuery, setTrackQuery] = useState("");
  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [selectedTrack, setSelectedTrack] =
    useState<MusicCreditTrackCandidate | null>(null);
  const [layer, setLayer] = useState<CreditLayer>("recording");
  const [selectedWorkId, setSelectedWorkId] = useState("");
  const [linkedWorks, setLinkedWorks] = useState<Array<{ id: string; title: string }>>([]);
  const [loadingWorks, setLoadingWorks] = useState(false);
  const [roleKey, setRoleKey] = useState<string>("producer");
  const [instrument, setInstrument] = useState("");
  const [detail, setDetail] = useState("");
  const [contributorMode, setContributorMode] =
    useState<ContributorMode>("self");
  const [personQuery, setPersonQuery] = useState("");
  const [people, setPeople] = useState<MusicCreditPersonCandidate[]>([]);
  const [selectedPerson, setSelectedPerson] =
    useState<MusicCreditPersonCandidate | null>(null);
  const [unlistedName, setUnlistedName] = useState("");
  const [askForConfirmation, setAskForConfirmation] = useState(true);
  const [searchingPeople, setSearchingPeople] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] =
    useState<{ type: "success" | "error"; text: string } | null>(null);
  const [sharePath, setSharePath] = useState<string | null>(null);
  const trackSearchSequence = useRef(0);
  const personSearchSequence = useRef(0);

  useEffect(() => {
    if (!open) return;

    const requestId =
      ++trackSearchSequence.current;
    const requestedTrackId =
      initialTrackId?.trim() || "";

    setMessage(null);
    setSharePath(null);
    setLayer("recording");
    setRoleKey("producer");
    setInstrument("");
    setDetail("");
    setContributorMode("self");
    setPersonQuery("");
    setPeople([]);
    setSelectedPerson(null);
    setUnlistedName("");
    setAskForConfirmation(true);
    setSelectedWorkId("");
    setTrackQuery("");
    setTracks([]);
    setSelectedTrack(null);
    setSelectedTrackId(
      requestedTrackId,
    );
    setTracksLoading(true);

    const loadTracks = requestedTrackId
      ? getMusicCreditTrackById(
          requestedTrackId,
        ).then((track) => {
          if (
            trackSearchSequence.current !==
            requestId
          ) {
            return;
          }

          if (track) {
            setSelectedTrack(track);
            setSelectedTrackId(track.id);
            setTrackQuery(track.title);
            setTracks([track]);
          } else {
            setSelectedTrackId("");
            return listMusicCreditTracks().then(
              (items) => {
                if (
                  trackSearchSequence.current ===
                  requestId
                ) {
                  setTracks(items);
                }
              },
            );
          }
        })
      : listMusicCreditTracks().then(
          (items) => {
            if (
              trackSearchSequence.current ===
              requestId
            ) {
              setTracks(items);
            }
          },
        );

    void loadTracks
      .catch(() => {
        if (
          trackSearchSequence.current ===
          requestId
        ) {
          setTracks([]);
        }
      })
      .finally(() => {
        if (
          trackSearchSequence.current ===
          requestId
        ) {
          setTracksLoading(false);
        }
      });

    return () => {
      if (
        trackSearchSequence.current ===
        requestId
      ) {
        trackSearchSequence.current += 1;
      }
    };
  }, [initialTrackId, open]);

  useEffect(() => {
    if (!open) return;

    const needle = trackQuery.trim();

    if (
      selectedTrack &&
      needle === selectedTrack.title
    ) {
      setTracks([selectedTrack]);
      setTracksLoading(false);
      return;
    }

    if (!needle) return;

    const requestId =
      ++trackSearchSequence.current;
    setTracksLoading(true);

    const timer = window.setTimeout(() => {
      void searchMusicCreditTracks(
        needle,
      )
        .then((items) => {
          if (
            trackSearchSequence.current ===
            requestId
          ) {
            setTracks(items);
          }
        })
        .catch(() => {
          if (
            trackSearchSequence.current ===
            requestId
          ) {
            setTracks([]);
          }
        })
        .finally(() => {
          if (
            trackSearchSequence.current ===
            requestId
          ) {
            setTracksLoading(false);
          }
        });
    }, 180);

    return () => {
      window.clearTimeout(timer);
      if (
        trackSearchSequence.current ===
        requestId
      ) {
        trackSearchSequence.current += 1;
      }
    };
  }, [
    open,
    selectedTrack,
    trackQuery,
  ]);

  useEffect(() => {
    let alive = true;

    setSelectedWorkId("");
    setLinkedWorks([]);

    if (!selectedTrackId || layer !== "work") {
      setLoadingWorks(false);
      return () => {
        alive = false;
      };
    }

    setLoadingWorks(true);
    void getPublicTrackProvenanceById(selectedTrackId)
      .then((payload) => {
        if (!alive) return;
        const works = (payload?.works ?? []).map((work) => ({
          id: work.id,
          title: work.title,
        }));
        setLinkedWorks(works);
        if (works.length === 1) {
          setSelectedWorkId(works[0].id);
        }
      })
      .catch(() => {
        if (alive) setLinkedWorks([]);
      })
      .finally(() => {
        if (alive) setLoadingWorks(false);
      });

    return () => {
      alive = false;
    };
  }, [layer, selectedTrackId]);

  useEffect(() => {
    if (contributorMode !== "person") {
      setPeople([]);
      setSearchingPeople(false);
      return;
    }

    const needle = personQuery.trim();
    if (needle.length < 2 || selectedPerson?.name === needle) {
      setPeople([]);
      setSearchingPeople(false);
      return;
    }

    const requestId = ++personSearchSequence.current;
    setSearchingPeople(true);
    const timer = window.setTimeout(() => {
      void searchMusicCreditPeople(needle)
        .then((results) => {
          if (personSearchSequence.current === requestId) {
            setPeople(results);
          }
        })
        .catch(() => {
          if (personSearchSequence.current === requestId) {
            setPeople([]);
          }
        })
        .finally(() => {
          if (personSearchSequence.current === requestId) {
            setSearchingPeople(false);
          }
        });
    }, 180);

    return () => {
      window.clearTimeout(timer);
      if (personSearchSequence.current === requestId) {
        personSearchSequence.current += 1;
      }
    };
  }, [contributorMode, personQuery, selectedPerson]);

  const roles = layer === "recording" ? RECORDING_ROLES : WORK_ROLES;
  const subjectId =
    layer === "recording" ? selectedTrackId : selectedWorkId;

  async function submitClaim() {
    setMessage(null);
    setSharePath(null);

    if (!selectedTrackId) {
      setMessage({ type: "error", text: "Choose the recording first." });
      return;
    }

    if (layer === "work" && !selectedWorkId) {
      setMessage({
        type: "error",
        text:
          linkedWorks.length === 0
            ? "We don’t have a songwriting record linked to this recording yet."
            : "Choose which songwriting record this credit belongs to.",
      });
      return;
    }

    if (contributorMode === "person" && !selectedPerson) {
      setMessage({ type: "error", text: "Choose who this credit belongs to." });
      return;
    }

    if (contributorMode === "unlisted" && !unlistedName.trim()) {
      setMessage({
        type: "error",
        text: "Enter their name first.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const attestation = await createMyMusicCreditAttestation({
        subjectKind: layer === "recording" ? "track" : "work",
        subjectId,
        roleKey,
        instrumentKey:
          layer === "recording" && instrument.trim()
            ? instrument.trim().toLowerCase()
            : null,
        detailText: detail.trim() || null,
        creditedAs:
          contributorMode === "unlisted"
            ? unlistedName.trim()
            : null,
        proposedPersonResourceId:
          contributorMode === "person"
            ? selectedPerson?.personId ?? null
            : null,
        elicitationMethod:
          contributorMode === "self"
            ? "self_claim"
            : "open_response",
        idempotencyKey: makeIdempotencyKey(),
      });

      if (askForConfirmation && contributorMode !== "self") {
        const invitation = await createMusicCreditInvitation({
          parentAttestationId: attestation.attestationId,
          inviteePersonResourceId:
            contributorMode === "person"
              ? selectedPerson?.personId ?? null
              : null,
          inviteeCreditedAs:
            contributorMode === "unlisted"
              ? unlistedName.trim()
              : null,
        });

        if (invitation.deliveryMode === "inviter_share_only") {
          setSharePath(invitation.sharePath);
          setMessage({
            type: "success",
            text:
              "Credit saved. Share the private confirmation link with them.",
          });
        } else {
          setMessage({
            type: "success",
            text:
              "Credit saved. We sent them a confirmation request.",
          });
        }
      } else {
        setMessage({
          type: "success",
          text:
            "Credit saved. It isn’t public yet.",
        });
      }

      await onSaved?.();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "We couldn’t save this credit.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function copyInvite() {
    if (!sharePath) return;
    const url =
      typeof window === "undefined"
        ? sharePath
        : window.location.origin + sharePath;
    await navigator.clipboard.writeText(url);
    setMessage({
      type: "success",
      text: "Private confirmation link copied.",
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add a credit"
      side="right"
      maxWidth="lg"
      bodyClassName="pb-[calc(6rem+env(safe-area-inset-bottom))]"
      footer={
        <div className="flex items-center justify-end gap-2">
          <WkButton type="button" variant="ghost" onClick={onClose}>
            Close
          </WkButton>
          <WkButton
            type="button"
            variant="primary"
            disabled={submitting}
            onClick={() => void submitClaim()}
          >
            {submitting ? "Saving…" : "Save credit claim"}
          </WkButton>
        </div>
      }
    >
      <div className="space-y-7">
        <p className="text-[13px] leading-6 text-[var(--wk-text-muted)]">
          Choose the recording, add the role, and tell us who the credit belongs to.
        </p>

        {message ? (
          <div
            className={[
              "rounded-xl border px-4 py-3 text-[12px] leading-5",
              message.type === "success"
                ? "border-[var(--wk-brand)]/25 bg-[var(--wk-brand-soft)] text-[var(--wk-text)]"
                : "border-red-300/50 bg-red-50 text-red-800",
            ].join(" ")}
          >
            {message.text}
          </div>
        ) : null}

        {sharePath ? (
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
            <div className="text-[11px] font-black text-[var(--wk-text)]">
              Private confirmation link
            </div>
            <p className="mt-1 break-all text-[11px] text-[var(--wk-text-muted)]">
              {sharePath}
            </p>
            <button
              type="button"
              onClick={() => void copyInvite()}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--wk-border)] px-3 py-2 text-[11px] font-black text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]"
            >
              <WkIcon name="Copy" size={13} />
              Copy link
            </button>
          </div>
        ) : null}

        <section>
          <h3 className="text-[12px] font-black text-[var(--wk-text)]">
            1. Which recording?
          </h3>
          <input
            value={trackQuery}
            onChange={(event) => setTrackQuery(event.target.value)}
            placeholder="Search title or artist"
            autoComplete="off"
            className="mt-3 w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[13px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)]"
          />
          <div className="mt-3 space-y-2">
            {tracksLoading ? (
              <p className="text-[11px] font-semibold text-[var(--wk-text-muted)]">
                Loading recordings…
              </p>
            ) : tracks.length ? (
              tracks.map((track) => (
                <TrackResult
                  key={track.id}
                  track={track}
                  selected={track.id === selectedTrackId}
                  onSelect={() => {
                    setSelectedTrack(track);
                    setSelectedTrackId(track.id);
                    setTrackQuery(track.title);
                    setTracks([track]);
                  }}
                />
              ))
            ) : (
              <p className="text-[11px] font-semibold text-[var(--wk-text-muted)]">
                No active Registry recording matches this search.
              </p>
            )}
          </div>
        </section>

        <section>
          <h3 className="text-[12px] font-black text-[var(--wk-text)]">
            2. What kind of credit is this?
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {([
              ["recording", "Recording"],
              ["work", "Songwriting"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={layer === value}
                onClick={() => {
                  setLayer(value);
                  setRoleKey(
                    value === "recording" ? "producer" : "songwriter",
                  );
                }}
                className={[
                  "rounded-xl border px-3 py-3 text-[12px] font-black",
                  layer === value
                    ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)] text-[var(--wk-text)]"
                    : "border-[var(--wk-border)] text-[var(--wk-text-muted)]",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>

          {layer === "work" ? (
            <div className="mt-3 space-y-2">
              {loadingWorks ? (
                <p className="text-[11px] text-[var(--wk-text-muted)]">
                  Loading verified Works…
                </p>
              ) : linkedWorks.length ? (
                linkedWorks.map((work) => (
                  <button
                    key={work.id}
                    type="button"
                    aria-pressed={selectedWorkId === work.id}
                    onClick={() => setSelectedWorkId(work.id)}
                    className={[
                      "block w-full rounded-xl border px-3 py-3 text-left text-[12px] font-bold",
                      selectedWorkId === work.id
                        ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)]"
                        : "border-[var(--wk-border)] bg-[var(--wk-bg)]",
                    ].join(" ")}
                  >
                    {work.title}
                  </button>
                ))
              ) : selectedTrackId ? (
                <p className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-3 text-[11px] leading-5 text-[var(--wk-text-muted)]">
                  We don’t have a songwriting record linked to this recording yet. You can still add a recording credit.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        <section>
          <h3 className="text-[12px] font-black text-[var(--wk-text)]">
            3. What did they do?
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {roles.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={roleKey === value}
                onClick={() => setRoleKey(value)}
                className={[
                  "rounded-full border px-3 py-2 text-[11px] font-bold",
                  roleKey === value
                    ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)] text-[var(--wk-text)]"
                    : "border-[var(--wk-border)] text-[var(--wk-text-muted)]",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>

          {layer === "recording" && ["instrumentalist", "session_musician"].includes(roleKey) ? (
            <input
              value={instrument}
              onChange={(event) => setInstrument(event.target.value)}
              placeholder="Instrument, e.g. guitar"
              autoComplete="off"
              className="mt-3 w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[13px] text-[var(--wk-text)]"
            />
          ) : null}

          <textarea
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Optional detail about the credit"
            className="mt-3 w-full resize-y rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[13px] leading-5 text-[var(--wk-text)]"
          />
        </section>

        <section>
          <h3 className="text-[12px] font-black text-[var(--wk-text)]">
            4. Who is this credit for?
          </h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {([
              ["self", "Me"],
              ["person", "Someone on WAKILISHA"],
              ["unlisted", "Not on WAKILISHA yet"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={contributorMode === value}
                onClick={() => {
                  setContributorMode(value);
                  setPeople([]);
                  setSelectedPerson(null);
                }}
                className={[
                  "rounded-xl border px-3 py-3 text-[11px] font-black",
                  contributorMode === value
                    ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)] text-[var(--wk-text)]"
                    : "border-[var(--wk-border)] text-[var(--wk-text-muted)]",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>

          {contributorMode === "person" ? (
            <div className="mt-3">
              <input
                value={personQuery}
                onChange={(event) => {
                  setPersonQuery(event.target.value);
                  setSelectedPerson(null);
                }}
                placeholder="Search by name"
                autoComplete="off"
                className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[13px] text-[var(--wk-text)]"
              />
              {searchingPeople ? (
                <p className="mt-2 text-[11px] text-[var(--wk-text-muted)]">
                  Searching People…
                </p>
              ) : null}
              {people.length ? (
                <div className="mt-2 overflow-hidden rounded-xl border border-[var(--wk-border)]">
                  {people.map((person) => (
                    <button
                      key={person.personId}
                      type="button"
                      onClick={() => {
                        setSelectedPerson(person);
                        setPersonQuery(person.name);
                        setPeople([]);
                      }}
                      className="block w-full border-t border-[var(--wk-divider)] bg-[var(--wk-bg)] px-4 py-3 text-left first:border-t-0 hover:bg-[var(--wk-surface-raised)]"
                    >
                      <span className="block text-[12px] font-black text-[var(--wk-text)]">
                        {person.name}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-[var(--wk-text-muted)]">
                        {person.path}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {contributorMode === "unlisted" ? (
            <div className="mt-3">
              <input
                value={unlistedName}
                onChange={(event) => setUnlistedName(event.target.value)}
                maxLength={1000}
                placeholder="Credited name"
                autoComplete="off"
                className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[13px] text-[var(--wk-text)]"
              />
              <p className="mt-2 text-[11px] leading-5 text-[var(--wk-text-muted)]">
                We’ll keep this name with the credit. It won’t create a WAKILISHA profile.
              </p>
            </div>
          ) : null}

          {contributorMode !== "self" ? (
            <button
              type="button"
              role="switch"
              aria-checked={askForConfirmation}
              onClick={() => setAskForConfirmation((value) => !value)}
              className="mt-4 flex w-full items-center justify-between gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-left"
            >
              <span>
                <span className="block text-[12px] font-black text-[var(--wk-text)]">
                  Ask them to confirm
                </span>
                <span className="mt-1 block text-[10px] leading-4 text-[var(--wk-text-muted)]">
                  People on WAKILISHA get a notification. Otherwise, we’ll give you a private link to share.
                </span>
              </span>
              <span
                className={[
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                  askForConfirmation
                    ? "bg-[var(--wk-brand)]"
                    : "bg-[var(--wk-border)]",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute top-1 h-4 w-4 rounded-full bg-white transition-transform",
                    askForConfirmation ? "translate-x-6" : "translate-x-1",
                  ].join(" ")}
                />
              </span>
            </button>
          ) : null}
        </section>
      </div>
    </Sheet>
  );
}
