import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import type { PublicArtistDetail } from "@/services/publicContent/client";

type ArtistMusicProvenanceProps = {
  artistName: string;
  provenance: PublicArtistDetail["musicProvenance"];
};

type ArtistMusicCredit =
  PublicArtistDetail["musicProvenance"]["recordingCredits"][number];

function SubjectCredit({
  credit,
}: {
  credit: ArtistMusicCredit;
}) {
  const subject = credit.subject;
  const content = (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 transition-colors hover:bg-[var(--wk-surface-raised)]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
        <WkIcon
          name={subject?.kind === "work" ? "BookOpen" : "Music"}
          size={17}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-brand)]">
          {credit.roleLabel}
        </span>
        <span className="mt-1 block truncate text-[14px] font-black text-[var(--wk-text)]">
          {subject?.title || "Music credit"}
        </span>
      </span>
      {subject?.path ? (
        <WkIcon
          name="ArrowUpRight"
          size={14}
          className="shrink-0 text-[var(--wk-text-faint)]"
        />
      ) : null}
    </div>
  );

  return subject?.path ? <Link to={subject.path}>{content}</Link> : content;
}

function CreditGroup({
  heading,
  description,
  credits,
}: {
  heading: string;
  description: string;
  credits: ArtistMusicCredit[];
}) {
  if (!credits.length) return null;

  return (
    <div>
      <div className="mb-3">
        <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
          {heading}
        </h3>
        <p className="mt-1 max-w-2xl text-[10px] leading-4 text-[var(--wk-text-muted)]">
          {description}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {credits.map((credit) => (
          <SubjectCredit key={credit.id} credit={credit} />
        ))}
      </div>
    </div>
  );
}

export function ArtistMusicProvenance({
  artistName,
  provenance,
}: ArtistMusicProvenanceProps) {
  const recordingCredits = provenance?.recordingCredits ?? [];
  const workCredits = provenance?.workCredits ?? [];
  const groupMembers = provenance?.groupMembers ?? [];
  const hasCredits = recordingCredits.length > 0 || workCredits.length > 0;
  const hasMembers = groupMembers.length > 0;

  if (!hasCredits && !hasMembers) return null;

  return (
    <section aria-labelledby="artist-provenance-heading">
      <div className="mb-6">
        <div className="wk-eyebrow mb-2">Credits & people</div>
        <h2
          id="artist-provenance-heading"
          className="text-[clamp(26px,3vw,40px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]"
        >
          Who makes {artistName}
        </h2>
        <p className="mt-3 max-w-2xl text-[12px] leading-5 text-[var(--wk-text-muted)]">
          Verified contribution and membership records from the WAKILISHA Registry. Pending assertions are not shown here.
        </p>
      </div>

      <div className="space-y-8">
        <CreditGroup
          heading="Recording roles"
          description="Performance, production and recording-side work tied to specific recordings."
          credits={recordingCredits}
        />

        <CreditGroup
          heading="Songwriting & Work roles"
          description="Authorship and other contribution roles tied to canonical Musical Works."
          credits={workCredits}
        />

        {hasMembers ? (
          <div>
            <h3 className="mb-1 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
              Group members
            </h3>
            <p className="mb-3 max-w-2xl text-[10px] leading-4 text-[var(--wk-text-muted)]">
              Membership is a relationship to this Artist identity. It does not imply participation on every recording.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {groupMembers.map((membership) => {
                const person = membership.person;
                const body = (
                  <div className="flex items-center gap-3 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 transition-colors hover:bg-[var(--wk-surface-raised)]">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]">
                      <WkIcon name="User" size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-black text-[var(--wk-text)]">
                        {person.name}
                      </span>
                      <span className="mt-0.5 block text-[10px] font-bold text-[var(--wk-text-muted)]">
                        {membership.roleLabel}
                        {membership.roleDetail ? " · " + membership.roleDetail : ""}
                      </span>
                    </span>
                    {person.path ? (
                      <WkIcon
                        name="ArrowUpRight"
                        size={14}
                        className="text-[var(--wk-text-faint)]"
                      />
                    ) : null}
                  </div>
                );

                return person.path ? (
                  <Link key={membership.membershipId} to={person.path}>
                    {body}
                  </Link>
                ) : (
                  <div key={membership.membershipId}>{body}</div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
