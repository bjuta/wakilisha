import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { trackEvent, getAnalyticsSessionId, getCanonicalPageUrl } from "@/services/analytics";
import { BRIEFING_SLUGS, isValidEmail, normalizeEmail, subscribeToBriefings } from "@/services/audienceSubscriptionService";
import { fetchAllAuthors, type AuthorRow } from "@/services/authorProfiles";

type PersonLink = {
  label: string;
  url: string;
  icon: string;
};

type PersonProfile = {
  slug: string;
  name: string;
  role: string;
  team: "Founder" | "Editorial" | "Contributor";
  bio: string;
  location: string;
  avatarUrl: string;
  profilePath?: string;
  links: PersonLink[];
  source: "founder" | "registry_authors";
};

const FOUNDER: PersonProfile = {
  slug: "beautah-muiruri",
  name: "Beautah Muiruri",
  role: "Founder & Editor-in-Chief",
  team: "Founder",
  location: "Nairobi, Kenya",
  avatarUrl: "",
  profilePath: "",
  links: [],
  source: "founder",
  bio:
    "Beautah leads WAKILISHA's editorial direction, product vision, and company-building work. His focus is turning African creative life into durable infrastructure: stories, charts, artist pages, guides, and tools that make culture easier to discover, understand, and build around.",
};

const TRUST_POINTS = [
  {
    eyebrow: "Editorial",
    title: "Real bylines, real context",
    desc: "WAKILISHA is built around named contributors, visible authorship, and stories that carry context beyond the algorithm.",
    icon: "ri-quill-pen-line",
  },
  {
    eyebrow: "Data",
    title: "Explainable music surfaces",
    desc: "Charts, artist pages, tracks, releases, and signals should be inspectable. We are building toward clearer methodology, source trails, and correction paths.",
    icon: "ri-bar-chart-box-line",
  },
  {
    eyebrow: "Company",
    title: "Built for diligence",
    desc: "Partners, funders, contributors, and readers should be able to understand who runs WAKILISHA, how it works, and how to reach the right person.",
    icon: "ri-shield-check-line",
  },
];

const OPERATING_AREAS = [
  {
    title: "Magazine",
    desc: "Profiles, criticism, release reviews, essays, guides, and field notes for African creative life.",
    to: "/magazine",
    icon: "ri-newspaper-line",
  },
  {
    title: "Charts",
    desc: "Music chart products built around movement, context, methodology, and market-specific discovery.",
    to: "/charts",
    icon: "ri-bar-chart-grouped-line",
  },
  {
    title: "Artists",
    desc: "Artist pages, credits, releases, songs, profiles, and the public context that helps creative work travel.",
    to: "/artists",
    icon: "ri-mic-line",
  },
  {
    title: "Guides",
    desc: "Practical discovery layers for scenes, sounds, regions, stories, and cultural routes worth following.",
    to: "/guides",
    icon: "ri-compass-3-line",
  },
];

const DILIGENCE_LINKS = [
  { label: "Editorial and partnerships", value: "hello@wakilisha.africa", href: "mailto:hello@wakilisha.africa", icon: "ri-mail-line" },
  { label: "Contact page", value: "Contact WAKILISHA", href: "/contact", icon: "ri-customer-service-2-line" },
  { label: "Privacy", value: "How user data is handled", href: "/privacy", icon: "ri-lock-line" },
  { label: "Terms", value: "Platform terms of use", href: "/terms", icon: "ri-file-list-3-line" },
];

function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("about-reveal-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -24px 0px" },
    );

    const els = document.querySelectorAll(".about-reveal");
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("")
    .slice(0, 2);
}

function generatedPortrait(name: string, slug: string) {
  const seed = Array.from(slug).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hueA = 72 + (seed % 32);
  const hueB = 220 + (seed % 80);
  const mark = initials(name) || "WK";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="900" viewBox="0 0 720 900">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="hsl(${hueA} 58% 54%)"/>
        <stop offset="0.58" stop-color="#11160d"/>
        <stop offset="1" stop-color="hsl(${hueB} 58% 42%)"/>
      </linearGradient>
      <radialGradient id="orb" cx="50%" cy="32%" r="58%">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.34"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="720" height="900" fill="url(#bg)"/>
    <circle cx="560" cy="160" r="260" fill="url(#orb)"/>
    <circle cx="140" cy="760" r="300" fill="#84C241" opacity="0.16"/>
    <path d="M0 610 C160 545 250 675 380 585 C505 498 565 542 720 470 L720 900 L0 900 Z" fill="#f7f9f1" opacity="0.14"/>
    <rect x="72" y="74" width="576" height="752" rx="36" fill="#0c0d0a" opacity="0.22" stroke="#ffffff" stroke-opacity="0.22"/>
    <text x="360" y="488" text-anchor="middle" fill="#f7f9f1" font-family="Inter,Arial,sans-serif" font-size="154" font-weight="900" letter-spacing="-10">${mark}</text>
    <text x="360" y="550" text-anchor="middle" fill="#84C241" font-family="Inter,Arial,sans-serif" font-size="28" font-weight="900" letter-spacing="8">WAKILISHA</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function authorToPerson(author: AuthorRow): PersonProfile {
  const name = (author.name || author.slug).trim();
  const role = author.role || "Contributor";
  const links: PersonLink[] = [];

  if (author.url) {
    links.push({ label: "Website", url: author.url, icon: "ri-global-line" });
  }

  (author.social_links || []).forEach((link) => {
    if (!link?.url) return;
    links.push({
      label: link.label || "Profile",
      url: link.url,
      icon: link.icon || "ri-external-link-line",
    });
  });

  return {
    slug: author.slug,
    name,
    role,
    team: role.toLowerCase().includes("editor") ? "Editorial" : "Contributor",
    location: author.location || "",
    avatarUrl: author.avatar_url || "",
    profilePath: `/authors/${author.slug}`,
    links,
    source: "registry_authors",
    bio: author.bio || `${name} contributes to WAKILISHA's coverage of African music and creative life.`,
  };
}

function AboutNewsletter() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailValue = normalizeEmail(email);
    if (!isValidEmail(emailValue)) {
      setError("Please enter a valid email address.");
      return;
    }

    setError("");

    trackEvent("newsletter_signup", {
      pageType: "about",
      context: { sourceSection: "about_trust_footer", formId: "about-newsletter", briefing_slugs: BRIEFING_SLUGS.cultureDispatch },
    });

    try {
      await subscribeToBriefings(emailValue, BRIEFING_SLUGS.cultureDispatch, {
        sourceForm: "about_newsletter",
        pageType: "about",
        pageUrl: getCanonicalPageUrl(),
        sessionId: getAnalyticsSessionId(),
        sourceContext: { source_section: "about_trust_footer", form_id: "about-newsletter" },
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <section className="about-reveal rounded-[28px] border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
      {done ? (
        <div className="py-16 px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--wk-brand)] flex items-center justify-center mx-auto mb-5">
            <i className="ri-check-line text-[28px] text-[var(--wk-brand-on)]" />
          </div>
          <h3 className="text-[24px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-2">You're in</h3>
          <p className="text-[14px] text-[var(--wk-text-muted)] max-w-[380px] mx-auto leading-relaxed">
            Culture Dispatch is now on its way to you.
          </p>
        </div>
      ) : (
        <div className="py-14 px-6 text-center max-w-[620px] mx-auto">
          <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)] mb-4">
            <i className="ri-mail-line text-[15px]" /> Stay close
          </span>
          <h2 className="text-[clamp(28px,3vw,42px)] font-black tracking-[-0.045em] text-[var(--wk-text)] leading-tight mb-3">
            Follow what we are building
          </h2>
          <p className="text-[14px] text-[var(--wk-text-muted)] leading-relaxed mb-8">
            Editorial updates, charts, guides, contributor notes, and the company signals worth paying attention to.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-[500px] mx-auto sm:flex-row">
            <input type="hidden" name="wk_session_id" value={getAnalyticsSessionId()} />
            <input type="hidden" name="wk_page_url" value={getCanonicalPageUrl()} />
            <input type="hidden" name="wk_page_type" value="about" />
            <input type="hidden" name="wk_source_section" value="about_trust_footer" />
            <div className="relative flex-1">
              <i className="ri-mail-line absolute left-4 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)] text-[17px] pointer-events-none" />
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full h-12 rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] pl-11 pr-4 text-[14px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors"
              />
            </div>
            <button type="submit" className="h-12 px-7 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[14px] font-extrabold hover:-translate-y-0.5 transition-transform whitespace-nowrap shrink-0 cursor-pointer">
              Subscribe
            </button>
          </form>
          {error && <p className="mt-3 text-[12px] font-semibold text-[var(--wk-danger)]">{error}</p>}
          <p className="mt-4 text-[11px] font-semibold text-[var(--wk-text-faint)]">No spam. Unsubscribe anytime.</p>
        </div>
      )}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-7 h-px bg-[var(--wk-brand)]" />
      <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)]">{children}</span>
    </div>
  );
}

function PersonCard({ person, featured = false }: { person: PersonProfile; featured?: boolean }) {
  const portrait = person.avatarUrl || generatedPortrait(person.name, person.slug);
  const card = (
    <article className={`group relative overflow-hidden rounded-[28px] border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--wk-border-2)] ${featured ? "lg:grid lg:grid-cols-[0.9fr_1.1fr]" : ""}`}>
      <div className={`relative overflow-hidden bg-[#0c0d0a] ${featured ? "min-h-[360px]" : "aspect-[4/5]"}`}>
        <img src={portrait} alt={person.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute left-4 top-4 rounded-full bg-black/55 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white backdrop-blur">
          {person.team}
        </div>
      </div>

      <div className={`${featured ? "p-6 lg:p-9" : "p-5"} flex flex-col`}>
        <div className="mb-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">{person.role}</p>
          <h3 className={`${featured ? "text-[clamp(30px,4vw,56px)]" : "text-[22px]"} mt-2 font-black leading-[0.95] tracking-[-0.045em] text-[var(--wk-text)]`}>
            {person.name}
          </h3>
          {person.location && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--wk-text-muted)]">
              <i className="ri-map-pin-line text-[var(--wk-brand)]" /> {person.location}
            </p>
          )}
        </div>

        <p className={`${featured ? "text-[15px]" : "text-[13px]"} leading-relaxed text-[var(--wk-text-muted)]`}>
          {person.bio}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {person.profilePath && (
            <Link to={person.profilePath} className="inline-flex h-9 items-center gap-2 rounded-full bg-[var(--wk-brand)] px-4 text-[12px] font-black text-[var(--wk-brand-on)] transition-transform hover:-translate-y-0.5">
              View profile <i className="ri-arrow-right-line" />
            </Link>
          )}
          {person.links.slice(0, 3).map((link) => (
            <a
              key={`${person.slug}-${link.url}`}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--wk-border)] text-[var(--wk-text-soft)] transition-colors hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]"
              aria-label={`${person.name} ${link.label}`}
            >
              <i className={link.icon} />
            </a>
          ))}
        </div>

        {person.source === "registry_authors" && (
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
            Sourced from contributor profile data
          </p>
        )}
      </div>
    </article>
  );

  return card;
}

export default function AboutPage() {
  const [authors, setAuthors] = useState<AuthorRow[]>([]);
  const [authorsStatus, setAuthorsStatus] = useState<"loading" | "ready" | "error">("loading");
  const heroRef = useRef<HTMLDivElement>(null);

  useScrollReveal();

  useEffect(() => {
    let alive = true;
    fetchAllAuthors()
      .then((rows) => {
        if (!alive) return;
        setAuthors(rows.filter((row) => row.slug && row.name));
        setAuthorsStatus("ready");
      })
      .catch((err) => {
        console.warn("Could not load About page contributors:", err);
        if (!alive) return;
        setAuthorsStatus("error");
      });

    return () => {
      alive = false;
    };
  }, []);

  const contributorPeople = useMemo(() => {
    const seen = new Set([FOUNDER.slug]);
    return authors
      .map(authorToPerson)
      .filter((person) => {
        if (seen.has(person.slug)) return false;
        seen.add(person.slug);
        return true;
      })
      .sort((a, b) => {
        const aEditorial = a.team === "Editorial" ? 0 : 1;
        const bEditorial = b.team === "Editorial" ? 0 : 1;
        return aEditorial - bEditorial || a.name.localeCompare(b.name);
      });
  }, [authors]);

  const hasContributors = contributorPeople.length > 0;

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      <section ref={heroRef} className="relative -mt-16 overflow-hidden bg-[#070807] text-white">
        <div className="absolute inset-0">
          <div className="absolute left-[-15%] top-[-20%] h-[520px] w-[520px] rounded-full bg-[var(--wk-brand)] opacity-20 blur-[120px]" />
          <div className="absolute right-[-10%] top-[18%] h-[480px] w-[480px] rounded-full bg-[#f7f9f1] opacity-[0.08] blur-[120px]" />
          <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)", backgroundSize: "72px 72px" }} />
        </div>

        <div className="relative mx-auto grid min-h-[92vh] max-w-[1440px] grid-cols-1 gap-10 px-5 pb-14 pt-32 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-20">
          <div className="flex flex-col justify-end">
            <div className="mb-6 flex items-center gap-3">
              <span className="h-px w-8 bg-white/40" />
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-white/60">About WAKILISHA</span>
            </div>
            <h1 className="max-w-[780px] text-[clamp(48px,8vw,112px)] font-black leading-[0.84] tracking-[-0.07em]">
              The people building the culture layer.
            </h1>
            <p className="mt-7 max-w-[600px] text-[16px] leading-relaxed text-white/60 md:text-[19px]">
              WAKILISHA is an editorial and data company for African creative life. We publish stories, map artists, build charts, and create discovery infrastructure that can be inspected, trusted, and built upon.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#meet-the-gang" className="inline-flex h-12 items-center rounded-full bg-[var(--wk-brand)] px-6 text-[13px] font-black text-[var(--wk-brand-on)] transition-transform hover:-translate-y-0.5">
                Meet the Gang
              </a>
              <a href="#diligence" className="inline-flex h-12 items-center rounded-full border border-white/20 px-6 text-[13px] font-black text-white transition-colors hover:bg-white hover:text-black">
                Due diligence
              </a>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Founder-led", "Leadership"],
                ["Named people", "Profiles"],
                ["Editorial standards", "Trust"],
                ["Nairobi", "Base"],
              ].map(([value, label]) => (
                <div key={value} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
                  <p className="text-[16px] font-black tracking-[-0.02em]">{value}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 self-end sm:grid-cols-3 lg:pb-2">
            {[FOUNDER, ...contributorPeople.slice(0, 8)].map((person, index) => {
              const portrait = person.avatarUrl || generatedPortrait(person.name, person.slug);
              return (
                <Link
                  key={`${person.slug}-${index}`}
                  to={person.profilePath || "#meet-the-gang"}
                  className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] ${index === 0 ? "col-span-2 aspect-[16/10] sm:col-span-2" : "aspect-[4/5]"}`}
                >
                  <img src={portrait} alt={person.name} className="h-full w-full object-cover opacity-85 transition duration-700 group-hover:scale-105 group-hover:opacity-100" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="truncate text-[13px] font-black leading-tight text-white">{person.name}</p>
                    <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-[0.13em] text-white/45">{person.role}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-[1440px] flex-col gap-18 px-5 py-16 sm:px-6 lg:gap-24 lg:px-8 lg:py-24">
        <section className="about-reveal grid gap-8 border-y border-[var(--wk-border)] py-12 lg:grid-cols-[0.85fr_1.15fr] lg:py-20">
          <div>
            <SectionLabel>Why we exist</SectionLabel>
            <h2 className="mt-5 max-w-[520px] text-[clamp(34px,5vw,68px)] font-black leading-[0.88] tracking-[-0.06em] text-[var(--wk-text)]">
              Trust is part of the product.
            </h2>
          </div>
          <div className="max-w-[760px]">
            <p className="text-[clamp(20px,3vw,34px)] font-black leading-[1] tracking-[-0.045em] text-[var(--wk-text)]">
              Your people are here. Your music is here. Your stories deserve infrastructure that understands them.
            </p>
            <p className="mt-6 text-[15px] leading-relaxed text-[var(--wk-text-muted)]">
              WAKILISHA exists because African creativity needs more than attention. It needs visible authorship, reliable records, practical discovery, and an ecosystem that can stand up to scrutiny from readers, contributors, partners, and investors.
            </p>
          </div>
        </section>

        <section id="meet-the-gang" className="about-reveal scroll-mt-24">
          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <SectionLabel>Meet the Gang</SectionLabel>
              <h2 className="mt-5 text-[clamp(36px,6vw,82px)] font-black leading-[0.86] tracking-[-0.065em] text-[var(--wk-text)]">
                Real people. Real work.
              </h2>
            </div>
            <p className="max-w-[440px] text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
              This section is powered by WAKILISHA contributor profile data where available. No fake team members. No anonymous mascots. Missing links stay missing until they are verified.
            </p>
          </div>

          <PersonCard person={FOUNDER} featured />

          <div className="mt-5">
            {authorsStatus === "loading" && (
              <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 text-[13px] font-semibold text-[var(--wk-text-muted)]">
                Loading contributor profiles…
              </div>
            )}

            {authorsStatus === "error" && (
              <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 text-[13px] font-semibold text-[var(--wk-text-muted)]">
                Contributor profiles could not load from the author database. Founder information remains visible while we fix the data layer.
              </div>
            )}

            {authorsStatus === "ready" && !hasContributors && (
              <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 text-[13px] font-semibold text-[var(--wk-text-muted)]">
                Contributor profiles will appear here as registry_authors records are verified.
              </div>
            )}

            {hasContributors && (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {contributorPeople.map((person) => (
                  <PersonCard key={person.slug} person={person} />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="about-reveal">
          <div className="mb-8">
            <SectionLabel>How WAKILISHA works</SectionLabel>
            <h2 className="mt-5 text-[clamp(32px,4.5vw,60px)] font-black leading-[0.9] tracking-[-0.055em] text-[var(--wk-text)]">
              Editorial company, data spine, cultural memory.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {OPERATING_AREAS.map((area) => (
              <Link key={area.title} to={area.to} className="group rounded-[24px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 transition-all hover:-translate-y-1 hover:border-[var(--wk-border-2)]">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--wk-bg-subtle)] text-[var(--wk-text-soft)] transition-colors group-hover:bg-[var(--wk-brand-soft)] group-hover:text-[var(--wk-brand)]">
                  <i className={`${area.icon} text-[22px]`} />
                </div>
                <h3 className="text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)]">{area.title}</h3>
                <p className="mt-3 text-[13px] leading-relaxed text-[var(--wk-text-muted)]">{area.desc}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-[12px] font-black text-[var(--wk-text-faint)] group-hover:text-[var(--wk-brand)]">
                  Explore <i className="ri-arrow-right-line" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="about-reveal">
          <div className="mb-8">
            <SectionLabel>Trust layer</SectionLabel>
            <h2 className="mt-5 text-[clamp(32px,4.5vw,60px)] font-black leading-[0.9] tracking-[-0.055em] text-[var(--wk-text)]">
              Built to be checked.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {TRUST_POINTS.map((point) => (
              <article key={point.title} className="rounded-[24px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 lg:p-7">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--wk-bg-subtle)] text-[var(--wk-brand)]">
                  <i className={`${point.icon} text-[22px]`} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">{point.eyebrow}</p>
                <h3 className="mt-2 text-[21px] font-black tracking-[-0.03em] text-[var(--wk-text)]">{point.title}</h3>
                <p className="mt-3 text-[13px] leading-relaxed text-[var(--wk-text-muted)]">{point.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="diligence" className="about-reveal scroll-mt-24 rounded-[32px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 lg:p-9">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <SectionLabel>Due diligence</SectionLabel>
              <h2 className="mt-5 text-[clamp(32px,4vw,58px)] font-black leading-[0.9] tracking-[-0.055em] text-[var(--wk-text)]">
                Know who to call and what to inspect.
              </h2>
              <p className="mt-5 text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
                This page is becoming WAKILISHA's public trust surface: leadership, contributors, contact paths, editorial posture, and policy links in one place.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {DILIGENCE_LINKS.map((item) => {
                const external = item.href.startsWith("mailto:");
                const content = (
                  <div className="group flex min-h-[118px] flex-col justify-between rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-5 transition-colors hover:border-[var(--wk-brand)]">
                    <div className="flex items-center justify-between gap-4">
                      <i className={`${item.icon} text-[22px] text-[var(--wk-brand)]`} />
                      <i className="ri-arrow-right-up-line text-[16px] text-[var(--wk-text-faint)] group-hover:text-[var(--wk-brand)]" />
                    </div>
                    <div>
                      <p className="text-[12px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">{item.label}</p>
                      <p className="mt-1 break-words text-[14px] font-bold text-[var(--wk-text)]">{item.value}</p>
                    </div>
                  </div>
                );

                if (external) {
                  return (
                    <a key={item.label} href={item.href}>
                      {content}
                    </a>
                  );
                }

                return (
                  <Link key={item.label} to={item.href}>
                    {content}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <AboutNewsletter />
      </div>

      <style>{`
        .about-reveal {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.7s var(--wk-ease-standard), transform 0.7s var(--wk-ease-standard);
        }

        .about-reveal-visible {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>
    </main>
  );
}
