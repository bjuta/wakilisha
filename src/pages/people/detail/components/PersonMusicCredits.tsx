import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import type {
  PublicPersonMusicCredit,
  PublicPersonMusicCredits,
} from "@/services/musicProvenance";

function CreditCard({
  credit,
}: {
  credit: PublicPersonMusicCredit;
}) {
  const subject = credit.subject;

  const card = (
    <article className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 transition-colors hover:bg-[var(--wk-surface-raised)]">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
          <WkIcon
            name={subject?.kind === "work" ? "BookOpen" : "Music"}
            size={17}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-brand)]">
            {credit.roleLabel}
          </div>
          <h3 className="mt-1 truncate text-[14px] font-black text-[var(--wk-text)]">
            {subject?.title || "Music credit"}
          </h3>
          <div className="mt-1 flex flex-wrap gap-x-2 text-[10px] font-semibold text-[var(--wk-text-muted)]">
            {credit.instrument ? <span>{credit.instrument}</span> : null}
            {credit.detail ? <span>{credit.detail}</span> : null}
            {credit.creditedAs ? <span>Credited as {credit.creditedAs}</span> : null}
          </div>
        </div>
        {subject?.path ? (
          <WkIcon
            name="ArrowUpRight"
            size={14}
            className="mt-1 shrink-0 text-[var(--wk-text-faint)]"
          />
        ) : null}
      </div>
    </article>
  );

  if (subject?.path) {
    return <Link to={subject.path}>{card}</Link>;
  }

  return card;
}

export function PersonMusicCredits({
  credits,
  personName,
}: {
  credits: PublicPersonMusicCredits;
  personName: string;
}) {
  const total =
    credits.recordingCredits.length + credits.workCredits.length;

  if (total === 0) {
    return (
      <section className="px-0 py-10 md:py-14">
        <div className="rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-6 py-10 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]">
            <WkIcon name="Music" size={20} />
          </span>
          <h2 className="mt-4 text-[18px] font-black text-[var(--wk-text)]">
            No canonical music credits yet
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-[12px] leading-5 text-[var(--wk-text-muted)]">
            Verified WAKILISHA Registry credits for {personName} will appear here. Pending claims are never shown publicly.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="px-0 py-10 md:py-14">
      <div className="mb-6">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
          Music Credits
        </div>
        <h2 className="mt-2 text-[24px] font-black tracking-[-0.035em] text-[var(--wk-text)]">
          Recorded work and songwriting
        </h2>
        <p className="mt-2 max-w-2xl text-[12px] leading-5 text-[var(--wk-text-muted)]">
          These are verified canonical contribution records. Assertions still under review are not part of this public portfolio.
        </p>
      </div>

      {credits.recordingCredits.length ? (
        <div>
          <h3 className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
            Recording credits
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {credits.recordingCredits.map((credit) => (
              <CreditCard key={credit.id} credit={credit} />
            ))}
          </div>
        </div>
      ) : null}

      {credits.workCredits.length ? (
        <div className={credits.recordingCredits.length ? "mt-8" : ""}>
          <h3 className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
            Songwriting and Work credits
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {credits.workCredits.map((credit) => (
              <CreditCard key={credit.id} credit={credit} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
