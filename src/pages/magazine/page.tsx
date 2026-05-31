import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { StoryCard } from "@/components/design-system/editorial/StoryCard";
import { SECTIONS, STORIES, EDITOR_PICKS, TRENDING_STORIES, CONTRIBUTORS } from "@/mocks/magazine";

/* ------------------------------------------------------------------ */
/*  Scroll-reveal hook                                                  */
/* ------------------------------------------------------------------ */
function useScrollReveal(threshold = 0.08) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */
function formatReadCount(count: number) {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

function getSectionColor(name: string) {
  return SECTIONS.find(s => s.name === name)?.color || "#1a1a1a";
}

/* ------------------------------------------------------------------ */
/*  Section tag dot                                                     */
/* ------------------------------------------------------------------ */
function SectionDot({ section }: { section: string }) {
  const color = getSectionColor(section);
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">
        {section}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Author byline                                                       */
/* ------------------------------------------------------------------ */
function AuthorByline({
  author,
  authorPhoto,
  date,
  readingTime,
}: {
  author: string;
  authorPhoto?: string;
  date?: string;
  readingTime?: number;
}) {
  return (
    <div className="flex items-center gap-3 text-[12px] text-[var(--wk-text-faint)]">
      {authorPhoto && (
        <img src={authorPhoto} alt={author} className="h-6 w-6 rounded-full object-cover" />
      )}
      <span className="font-semibold text-[var(--wk-text-soft)]">{author}</span>
      {date && (
        <>
          <span className="text-[var(--wk-text-faint)]">·</span>
          <span>{date}</span>
        </>
      )}
      {readingTime && (
        <>
          <span className="text-[var(--wk-text-faint)]">·</span>
          <span>{readingTime} min</span>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */
export default function Magazine() {
  const [activeSection, setActiveSection] = useState("All");
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const featured = STORIES[0];
  const rest = STORIES.slice(1).filter(
    s => activeSection === "All" || s.section === activeSection
  );

  // Editorial grid slices
  const largeStories = rest.slice(0, 2);
  const wideStory = rest[2];
  const smallStories = rest.slice(3, 6);
  const textOnlyStory = rest[6];
  const remainingStories = rest.slice(7);

  /* Reveal wrappers */
  const r1 = useScrollReveal();
  const r2 = useScrollReveal();
  const r3 = useScrollReveal();
  const r4 = useScrollReveal();
  const r5 = useScrollReveal();
  const r6 = useScrollReveal();
  const r7 = useScrollReveal();
  const r8 = useScrollReveal();
  const r9 = useScrollReveal();

  const revealClass = (visible: boolean) =>
    `transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`;

  return (
    <div className="min-h-screen">
      {/* ============================================================ */}
      {/*  COVER HERO — magazine cover aesthetic                        */}
      {/* ============================================================ */}
      <section className="relative min-h-screen flex items-end overflow-hidden">
        {/* Parallax background image */}
        <div
          className="absolute inset-0"
          style={{ transform: `translateY(${scrollY * 0.3}px)` }}
        >
          <img
            src={featured.heroUrl}
            alt=""
            className="h-full w-full object-cover object-center"
          />
        </div>

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />

        {/* Top bar — magazine masthead */}
        <div className="absolute top-0 left-0 right-0 z-10">
          <div className="wk-container-wide flex items-center justify-between px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white/80 backdrop-blur-sm">
                Issue 01
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                May 2024
              </span>
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
              WAKILISHA Editorial
            </span>
          </div>
        </div>

        {/* Hero content */}
        <div className="relative wk-container-wide w-full px-6 pb-24 pt-20 md:pb-32">
          <div className="max-w-4xl">
            <div className="mb-5 flex items-center gap-3">
              <span className="rounded-full bg-[var(--wk-brand)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-brand-on)]">
                {featured.section}
              </span>
              <span className="text-[12px] font-medium text-white/60">
                {featured.readingTime} min read
              </span>
            </div>
            <h1
              className="font-black leading-[0.88] tracking-[-0.04em] text-[#F0EFE8]"
              style={{ fontSize: "clamp(44px, 7vw, 96px)" }}
            >
              {featured.title}
            </h1>
            {featured.dek && (
              <p className="mt-6 max-w-2xl text-[19px] leading-relaxed text-white/65">
                {featured.dek}
              </p>
            )}
            <div className="mt-10 flex items-center gap-4">
              <Link
                to={`/magazine/${featured.slug}`}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-6 py-3 text-[14px] font-bold text-[var(--wk-brand-on)] transition-all hover:brightness-110 whitespace-nowrap"
              >
                Read cover story
                <i className="ri-arrow-right-line" />
              </Link>
              <span className="text-[13px] text-white/50">
                by {featured.author}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  TABLE OF CONTENTS — editorial section nav                    */}
      {/* ============================================================ */}
      <div className="border-y border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="wk-container-wide flex items-center gap-8 overflow-x-auto px-6 py-4">
          <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">
            In this issue
          </span>
          {SECTIONS.map((section) => {
            if (section.name === "All") return null;
            const count = STORIES.filter(s => s.section === section.name).length;
            const isActive = activeSection === section.name;
            return (
              <button
                key={section.name}
                onClick={() => setActiveSection(section.name)}
                className={`group flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all ${
                  isActive
                    ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                    : "hover:bg-[var(--wk-surface-raised)]"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: isActive ? "var(--wk-brand-on)" : section.color,
                  }}
                />
                <span className={isActive ? "text-[var(--wk-brand-on)]" : "text-[var(--wk-text-soft)]"}>
                  {section.name}
                </span>
                <span className="text-[11px] opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================================================ */}
      {/*  TRENDING SHELF — visual thumbnail shelf                      */}
      {/* ============================================================ */}
      <div className="bg-[var(--wk-bg)]">
        <div className={"wk-container-wide px-6 py-12 " + revealClass(r1.visible)} ref={r1.ref}>
          <div className="mb-6 flex items-center justify-between">
            <div className="wk-eyebrow">Trending</div>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {TRENDING_STORIES.map((story, i) => (
              <Link
                key={story.slug}
                to={`/magazine/${story.slug}`}
                className="group flex w-[260px] shrink-0 flex-col gap-3"
              >
                <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
                  <img
                    src={story.heroUrl}
                    alt={story.title}
                    className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)]">
                    <span className="text-[12px] font-bold">{i + 1}</span>
                  </div>
                </div>
                <div>
                  <h4 className="text-[14px] font-bold leading-snug text-[var(--wk-text)] transition-colors group-hover:text-[var(--wk-brand)]">
                    {story.title}
                  </h4>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)]">
                    <span>{story.section}</span>
                    <span>·</span>
                    <span>{formatReadCount(story.readCount)} reads</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  MAIN CONTENT                                                  */}
      {/* ============================================================ */}
      <div className="wk-container-wide px-6 py-20 md:py-28">
        {/* Section filter */}
        <div className="mb-14 flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <button
              key={s.name}
              onClick={() => setActiveSection(s.name)}
              className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-all whitespace-nowrap ${
                activeSection === s.name
                  ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                  : "border border-[var(--wk-border)] text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>

        {/* ========================================================== */}
        {/*  EDITORIAL GRID — "All" view                                */}
        {/* ========================================================== */}
        {activeSection === "All" && (
          <div className="space-y-16">
            {/* Row 1: Two large stories side by side */}
            <div className={"grid gap-6 lg:grid-cols-2 " + revealClass(r2.visible)} ref={r2.ref}>
              {largeStories.map((story) => (
                <Link
                  key={story.slug}
                  to={`/magazine/${story.slug}`}
                  className="group flex flex-col gap-4"
                >
                  <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
                    <img
                      src={story.heroUrl}
                      alt={story.title}
                      className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute left-3 top-3">
                      <span className="rounded-full bg-[var(--wk-brand)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-brand-on)]">
                        {story.section}
                      </span>
                    </div>
                  </div>
                  <div>
                    <h2 className="text-[26px] font-bold leading-snug tracking-[-0.02em] text-[var(--wk-text)] transition-colors group-hover:text-[var(--wk-brand)]">
                      {story.title}
                    </h2>
                    <p className="mt-3 line-clamp-2 text-[15px] leading-relaxed text-[var(--wk-text-muted)]">
                      {story.body?.[0]}
                    </p>
                    <div className="mt-4">
                      <AuthorByline
                        author={story.author}
                        authorPhoto={story.authorPhoto}
                        date={story.date}
                        readingTime={story.readingTime}
                      />
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Row 2: One wide dominant story */}
            {wideStory && (
              <div className={revealClass(r3.visible)} ref={r3.ref}>
                <Link
                  to={`/magazine/${wideStory.slug}`}
                  className="group grid gap-6 overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] lg:grid-cols-[1.4fr_1fr]"
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-[var(--wk-surface-raised)] lg:aspect-auto">
                    <img
                      src={wideStory.heroUrl}
                      alt={wideStory.title}
                      className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute left-4 top-4">
                      <span className="rounded-full bg-[var(--wk-brand)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-brand-on)]">
                        {wideStory.section}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col justify-center p-6 lg:p-10">
                    <h2 className="text-[32px] font-bold leading-tight tracking-[-0.03em] text-[var(--wk-text)] transition-colors group-hover:text-[var(--wk-brand)]">
                      {wideStory.title}
                    </h2>
                    <p className="mt-4 line-clamp-3 text-[15px] leading-relaxed text-[var(--wk-text-muted)]">
                      {wideStory.body?.[0]}
                    </p>
                    <div className="mt-6">
                      <AuthorByline
                        author={wideStory.author}
                        authorPhoto={wideStory.authorPhoto}
                        date={wideStory.date}
                        readingTime={wideStory.readingTime}
                      />
                    </div>
                  </div>
                </Link>
              </div>
            )}

            {/* Row 3: Three small stories */}
            <div className={"grid gap-5 sm:grid-cols-2 lg:grid-cols-3 " + revealClass(r4.visible)} ref={r4.ref}>
              {smallStories.map((story) => (
                <Link
                  key={story.slug}
                  to={`/magazine/${story.slug}`}
                  className="group flex flex-col gap-3"
                >
                  <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
                    <img
                      src={story.heroUrl}
                      alt={story.title}
                      className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute left-2 top-2">
                      <span className="rounded-full border border-white/30 bg-black/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/80 backdrop-blur-sm">
                        {story.section}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-[17px] font-bold leading-snug text-[var(--wk-text)] transition-colors group-hover:text-[var(--wk-brand)]">
                    {story.title}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)]">
                    {story.authorPhoto && (
                      <img src={story.authorPhoto} alt={story.author} className="h-5 w-5 rounded-full object-cover" />
                    )}
                    <span className="font-semibold text-[var(--wk-text-soft)]">{story.author}</span>
                    <span>·</span>
                    <span>{story.readingTime} min</span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Row 4: Text-only card + medium card */}
            <div className={"grid gap-6 lg:grid-cols-[1fr_1.3fr] " + revealClass(r5.visible)} ref={r5.ref}>
              {/* Text-only card */}
              {textOnlyStory && (
                <div className="flex flex-col justify-center rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 lg:p-10">
                  <div className="mb-3">
                    <SectionDot section={textOnlyStory.section} />
                  </div>
                  <h2 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-[var(--wk-text)]">
                    {textOnlyStory.title}
                  </h2>
                  <p className="mt-4 line-clamp-4 text-[15px] leading-relaxed text-[var(--wk-text-muted)]">
                    {textOnlyStory.body?.[0]}
                  </p>
                  <div className="mt-6">
                    <AuthorByline
                      author={textOnlyStory.author}
                      authorPhoto={textOnlyStory.authorPhoto}
                      date={textOnlyStory.date}
                    />
                  </div>
                  <Link
                    to={`/magazine/${textOnlyStory.slug}`}
                    className="mt-6 inline-flex items-center gap-2 text-[13px] font-bold text-[var(--wk-brand)] transition-colors hover:text-[var(--wk-brand-hover)]"
                  >
                    Read the story
                    <i className="ri-arrow-right-line" />
                  </Link>
                </div>
              )}

              {/* Medium card */}
              {remainingStories[0] && (
                <Link
                  to={`/magazine/${remainingStories[0].slug}`}
                  className="group flex flex-col gap-3"
                >
                  <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
                    <img
                      src={remainingStories[0].heroUrl}
                      alt={remainingStories[0].title}
                      className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute left-3 top-3">
                      <span className="rounded-full bg-[var(--wk-brand)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-brand-on)]">
                        {remainingStories[0].section}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-[20px] font-bold leading-snug text-[var(--wk-text)] transition-colors group-hover:text-[var(--wk-brand)]">
                    {remainingStories[0].title}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)]">
                    {remainingStories[0].authorPhoto && (
                      <img src={remainingStories[0].authorPhoto} alt={remainingStories[0].author} className="h-5 w-5 rounded-full object-cover" />
                    )}
                    <span className="font-semibold text-[var(--wk-text-soft)]">{remainingStories[0].author}</span>
                    <span>·</span>
                    <span>{remainingStories[0].readingTime} min</span>
                  </div>
                </Link>
              )}
            </div>

            {/* Row 5: Two more cards */}
            <div className={"grid gap-5 sm:grid-cols-2 " + revealClass(r6.visible)} ref={r6.ref}>
              {remainingStories.slice(1, 3).map((story) => (
                <Link
                  key={story.slug}
                  to={`/magazine/${story.slug}`}
                  className="group flex flex-col gap-3"
                >
                  <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
                    <img
                      src={story.heroUrl}
                      alt={story.title}
                      className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute left-2 top-2">
                      <span className="rounded-full border border-white/30 bg-black/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/80 backdrop-blur-sm">
                        {story.section}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-[17px] font-bold leading-snug text-[var(--wk-text)] transition-colors group-hover:text-[var(--wk-brand)]">
                    {story.title}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)]">
                    {story.authorPhoto && (
                      <img src={story.authorPhoto} alt={story.author} className="h-5 w-5 rounded-full object-cover" />
                    )}
                    <span className="font-semibold text-[var(--wk-text-soft)]">{story.author}</span>
                    <span>·</span>
                    <span>{story.readingTime} min</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================== */}
        {/*  FILTERED VIEW                                              */}
        {/* ========================================================== */}
        {activeSection !== "All" && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((story) => <StoryCard key={story.slug} {...story} />)
            }
          </div>
        )}

        {/* Empty state */}
        {rest.length === 0 && activeSection !== "All" && (
          <div className="py-16 text-center text-[var(--wk-text-muted)]">
            <i className="ri-article-line mb-3 block text-4xl" />
            No stories in this section yet.
          </div>
        )}

        {/* ========================================================== */}
        {/*  BELOW THE FOLD                                            */}
        {/* ========================================================== */}
        {activeSection === "All" && (
          <div className="mt-28 space-y-28">
            {/* Editor's Picks */}
            <div className={"space-y-6 " + revealClass(r7.visible)} ref={r7.ref}>
              <div className="flex items-center gap-3">
                <div className="wk-eyebrow">Editor's Picks</div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {EDITOR_PICKS.map((pick) => (
                  <Link
                    key={pick.slug}
                    to={`/magazine/${pick.slug}`}
                    className="group flex flex-col gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 transition-all hover:border-[var(--wk-border-2)]"
                  >
                    <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                      <img
                        src={pick.heroUrl}
                        alt={pick.title}
                        className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute left-2 top-2">
                        <span className="rounded-full bg-[var(--wk-brand)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-brand-on)]">
                          {pick.pickReason}
                        </span>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 px-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wk-text-soft)]">
                          {pick.section}
                        </span>
                        <span className="text-[11px] text-[var(--wk-text-faint)]">
                          {pick.readingTime} min
                        </span>
                      </div>
                      <h3 className="line-clamp-2 text-[14px] font-bold leading-snug text-[var(--wk-text)]">
                        {pick.title}
                      </h3>
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)]">
                        {pick.authorPhoto && (
                          <img src={pick.authorPhoto} alt={pick.author} className="h-4 w-4 rounded-full object-cover" />
                        )}
                        <span>{pick.author}</span>
                        <span>·</span>
                        <span>{pick.date}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Trending + Newsletter */}
            <div className={"grid gap-8 lg:grid-cols-[1fr_340px] " + revealClass(r8.visible)} ref={r8.ref}>
              {/* Trending list */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="wk-eyebrow">Trending Now</div>
                </div>
                <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
                  {TRENDING_STORIES.map((story, index) => (
                    <Link
                      key={story.slug}
                      to={`/magazine/${story.slug}`}
                      className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--wk-surface-raised)]"
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
                        <span className="text-[11px] font-bold">{index + 1}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-[13px] font-bold text-[var(--wk-text)]">
                          {story.title}
                        </h4>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--wk-text-soft)]">
                            {story.section}
                          </span>
                          <span className="text-[11px] text-[var(--wk-text-faint)]">
                            {formatReadCount(story.readCount)} reads
                          </span>
                        </div>
                      </div>
                      <i className="ri-arrow-right-line text-[var(--wk-text-faint)] transition-colors group-hover:text-[var(--wk-brand)]" />
                    </Link>
                  ))}
                </div>
              </div>

              {/* Newsletter */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="wk-eyebrow">Newsletter</div>
                </div>
                {subscribed ? (
                  <div className="relative overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 text-center">
                    <div className="absolute inset-0 bg-[var(--wk-brand)] opacity-[0.06]" />
                    <div className="relative">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)]">
                        <i className="ri-check-line text-xl" />
                      </div>
                      <h3 className="text-[16px] font-bold text-[var(--wk-text)]">
                        Subscribed
                      </h3>
                      <p className="mt-1 text-[13px] text-[var(--wk-text-muted)]">
                        You will receive the WAKILISHA editorial digest.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="relative overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
                    <div className="relative overflow-hidden px-6 py-8 text-center">
                      <div className="absolute inset-0 bg-[var(--wk-brand)] opacity-[0.06]" />
                      <div className="relative">
                        <div className="mb-3 flex items-center justify-center gap-2">
                          <i className="ri-newspaper-line text-[var(--wk-brand)]" />
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">
                            WAKILISHA Editorial
                          </span>
                        </div>
                        <h3 className="text-[18px] font-bold leading-tight text-[var(--wk-text)]">
                          Get the editorial digest
                        </h3>
                        <p className="mt-2 text-[13px] leading-relaxed text-[var(--wk-text-muted)]">
                          Weekly analysis, chart commentary, and industry signals delivered to your inbox.
                        </p>
                      </div>
                    </div>
                    <div className="border-t border-[var(--wk-divider)] px-6 py-5">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (email.trim()) setSubscribed(true);
                        }}
                        className="space-y-3"
                      >
                        <div className="relative">
                          <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)]" />
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            required
                            className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] py-3 pl-10 pr-4 text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)]"
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full rounded-xl bg-[var(--wk-brand)] py-3 text-[14px] font-bold text-[var(--wk-brand-on)] transition-all hover:brightness-110 whitespace-nowrap"
                        >
                          Subscribe
                        </button>
                      </form>
                      <p className="mt-3 text-center text-[11px] text-[var(--wk-text-faint)]">
                        No spam. Unsubscribe anytime.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Contributors */}
            <div className={"space-y-6 " + revealClass(r9.visible)} ref={r9.ref}>
              <div className="flex items-center gap-3">
                <div className="wk-eyebrow">Contributors</div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {CONTRIBUTORS.map((contributor) => (
                  <div
                    key={contributor.name}
                    className="flex flex-col items-center rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 text-center transition-all hover:border-[var(--wk-brand)]"
                  >
                    <img
                      src={contributor.photo}
                      alt={contributor.name}
                      className="h-16 w-16 rounded-full object-cover"
                    />
                    <h3 className="mt-4 text-[15px] font-bold text-[var(--wk-text)]">
                      {contributor.name}
                    </h3>
                    <p className="text-[12px] font-semibold text-[var(--wk-brand)]">
                      {contributor.role}
                    </p>
                    <p className="mt-2 text-[13px] leading-relaxed text-[var(--wk-text-muted)]">
                      {contributor.bio}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* More Stories */}
            {remainingStories.length > 3 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="wk-eyebrow">More Stories</div>
                  <div className="h-px flex-1 bg-[var(--wk-divider)]" />
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {remainingStories.slice(3).map((story) => (
                    <StoryCard key={story.slug} {...story} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}