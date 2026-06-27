import { useState } from "react";
import { Link } from "react-router-dom";
import { trackEvent, getAnalyticsSessionId, getCanonicalPageUrl } from "@/services/analytics";
import { submitForm } from "@/services/formService";
import { BRIEFING_SLUGS, guideInterest, subscribeToBriefings } from "@/services/audienceSubscriptionService";
import { dakarData } from "@/pages/guides/detail/dakarData";
import { MobileShareButton } from "@/components/design-system/share/ShareSheet";

export default function MobileDakarGuide() {
  const { hero, share, argument, anatomy, disciplines, watchlist, timeline, follow } = dakarData;
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const sessionId = getAnalyticsSessionId();
  const pageUrl = getCanonicalPageUrl();
  const guideSlug = "dakar-biennale-2026";
  const guideTitle = `${follow.title} ${follow.titleItalic || ""}`;

  const [followStatus, setFollowStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const handleFollowSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    trackEvent("guide_subscribe_submit", {
      pageType: "guide_detail",
      entitySlug: guideSlug,
      recordType: "guide",
      context: {
        source_section: "follow_form_mobile",
        guide_title: guideTitle,
        guide_slug: guideSlug,
      },
    });

    setFollowStatus("submitting");
    const form = e.currentTarget;
    const formData = new FormData(form);
    const submission: Record<string, string> = { form_type: "dakar_follow" };
    formData.forEach((value, key) => {
      submission[key] = String(value);
    });

    try {
      const result = await submitForm(submission);
      if (!result.success) throw new Error(result.error ?? "Could not save subscription.");

      await subscribeToBriefings(String(submission.email || ""), BRIEFING_SLUGS.fieldGuides, {
        sourceForm: "mobile_dakar_follow",
        pageType: "guide_detail",
        pageUrl,
        sessionId,
        interests: [
          guideInterest({
            slug: guideSlug,
            title: guideTitle,
            sourceForm: "mobile_dakar_follow",
            kind: "follow",
            strength: 70,
            sourceContext: { source_section: "follow_form_mobile", mobile: true },
          }),
        ],
      });

      setFollowStatus("success");
    } catch (error) {
      console.warn("[mobile guide] subscription failed:", error);
      setFollowStatus("error");
    }
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(share.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLinks = [
    { icon: "ri-whatsapp-line", label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${share.title} ${share.url}`)}`, color: "#25D366" },
    { icon: "ri-twitter-x-line", label: "X", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(share.title)}&url=${encodeURIComponent(share.url)}`, color: "#000" },
    { icon: "ri-facebook-line", label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(share.url)}`, color: "#1877F2" },
    { icon: "ri-linkedin-line", label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(share.url)}`, color: "#0A66C2" },
    { icon: "ri-mail-line", label: "Email", href: `mailto:?subject=${encodeURIComponent(share.title)}&body=${encodeURIComponent(share.description + "\n" + share.url)}`, color: "#EA4335" },
  ];

  const moreLinks = [
    { icon: "ri-telegram-line", label: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(share.url)}&text=${encodeURIComponent(share.title)}`, color: "#26A5E4" },
    { icon: "ri-reddit-line", label: "Reddit", href: `https://www.reddit.com/submit?url=${encodeURIComponent(share.url)}&title=${encodeURIComponent(share.title)}`, color: "#FF4500" },
    { icon: "ri-pinterest-line", label: "Pinterest", href: `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(share.url)}`, color: "#BD081C" },
    { icon: "ri-messenger-line", label: "Messenger", href: `https://www.facebook.com/dialog/send?link=${encodeURIComponent(share.url)}&app_id=0`, color: "#00B2FF" },
  ];

  const ShareRow = () => (
    <section className="py-4 px-5" style={{ background: "var(--wk-bg-subtle)" }}>
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {shareLinks.map((link) => (
          <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 w-10 h-10 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] flex items-center justify-center active:scale-90 transition-transform" style={{ color: link.color }}>
            <i className={link.icon} />
          </a>
        ))}
        <button onClick={handleCopy} className={`flex-shrink-0 w-10 h-10 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] flex items-center justify-center active:scale-90 transition-transform cursor-pointer ${copied ? "text-[var(--wk-v-intel)]" : "text-[var(--wk-text-muted)]"}`}>
          <i className={copied ? "ri-check-line" : "ri-link-m"} />
        </button>
        <button onClick={() => setShareOpen(true)} className="flex-shrink-0 w-10 h-10 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] flex items-center justify-center text-[var(--wk-text-muted)] active:scale-90 transition-transform cursor-pointer">
          <i className="ri-more-line" />
        </button>
      </div>

      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShareOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-[500px] rounded-t-2xl bg-[var(--wk-bg)] p-5 pb-8 z-10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-black text-[var(--wk-text)]">Share via</h3>
              <button onClick={() => setShareOpen(false)} className="w-8 h-8 rounded-full border border-[var(--wk-border)] flex items-center justify-center text-[var(--wk-text-muted)] cursor-pointer">
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {moreLinks.map((link) => (
                <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 py-2 active:scale-90 transition-transform">
                  <div className="w-11 h-11 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] flex items-center justify-center" style={{ color: link.color }}>
                    <i className={link.icon} />
                  </div>
                  <span className="text-[10px] text-[var(--wk-text-muted)]">{link.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--wk-bg)" }}>
      {/* Hero */}
      <header className="relative min-h-[80dvh] flex flex-col justify-end overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={hero.mastheadImage} alt="Dakar Biennale 2026" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-black/80" />
        </div>
        <div className="relative z-10 flex items-center justify-between px-4 pt-6">
          <Link to="/guides" className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/25 backdrop-blur-sm px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/85 whitespace-nowrap">
            <i className="ri-arrow-left-line text-[12px]" /> Guides
          </Link>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-white">{hero.badge}</span>
            <MobileShareButton
              item={{
                title: "Dakar Biennale 2026",
                subtitle: share.description,
                description: share.description,
                type: "page",
              }}
            />
          </div>
        </div>
        <div className="relative z-10 px-4 pt-8 pb-6">
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/80 mb-2">{hero.kicker}</p>
          <h1 className="text-[clamp(36px,10vw,56px)] font-black leading-[0.95] text-white mb-3">
            {hero.title}<em className="italic">{hero.titleItalic}</em>
          </h1>
          <p className="text-[13px] text-white/70 mb-5">{hero.subtitle}</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {hero.facts.map((f) => (
              <div key={f.label}>
                <span className="text-[9px] uppercase tracking-wider text-white/50 font-semibold">{f.label}</span>
                <p className="text-[12px] text-white font-medium">{f.value}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="#dossier" className="inline-flex items-center px-5 py-2.5 text-[12px] font-semibold bg-white text-black rounded-md active:scale-[0.98] transition-transform whitespace-nowrap">Read the dossier</a>
            <a href="#updates" className="inline-flex items-center px-5 py-2.5 text-[12px] font-semibold border border-white/40 text-white rounded-md active:scale-[0.98] transition-transform whitespace-nowrap">Follow updates</a>
          </div>
        </div>
      </header>

      <ShareRow />

      {/* The Argument */}
      <section id="dossier" className="py-12 px-5" style={{ background: "var(--wk-bg)" }}>
        <div className="mb-6">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)]">{argument.label}</span>
          <h2 className="text-[22px] font-black leading-tight tracking-[-0.03em] text-[var(--wk-text)] mt-1">
            {argument.title}<br /><em className="italic font-light">{argument.titleItalic}</em>
          </h2>
        </div>
        {argument.prose.map((p, i) => (
          <p key={i} className="text-[14px] leading-relaxed text-[var(--wk-text-soft)] mb-4">{p}</p>
        ))}
        <div className="mt-6 pt-6 border-t border-[var(--wk-divider)]">
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--wk-text-muted)]">{argument.chaptersLabel}</span>
          <div className="mt-3 space-y-4">
            {argument.chapters.map((ch) => (
              <div key={ch.number} className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--wk-brand)]/10 flex items-center justify-center text-[11px] font-black text-[var(--wk-brand)]">{ch.number}</span>
                <div>
                  <h3 className="text-[14px] font-bold text-[var(--wk-text)]">{ch.title}</h3>
                  <p className="text-[12px] text-[var(--wk-text-soft)] mt-0.5">{ch.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Event Architecture */}
      <section className="py-12 px-5" style={{ background: "var(--wk-bg-subtle)" }}>
        <div className="mb-6">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)]">{anatomy.label}</span>
          <h2 className="text-[22px] font-black leading-tight tracking-[-0.03em] text-[var(--wk-text)] mt-1">
            {anatomy.title}<br /><em className="italic font-light">{anatomy.titleItalic}</em>
          </h2>
        </div>
        <div className="space-y-4">
          {anatomy.items.map((item) => (
            <div key={item.number} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--wk-brand)]/10 flex items-center justify-center text-[11px] font-black text-[var(--wk-brand)]">{item.number}</span>
                <div className="min-w-0">
                  <h3 className="text-[14px] font-bold text-[var(--wk-text)]">{item.name}</h3>
                  <p className="text-[12px] text-[var(--wk-text-soft)] mt-1">{item.description}</p>
                  <span className="inline-block mt-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--wk-brand)]/5 text-[var(--wk-brand)]">{item.route}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Disciplines */}
      <section className="py-12 px-5" style={{ background: "var(--wk-bg)" }}>
        <div className="mb-6">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)]">{disciplines.label}</span>
          <h2 className="text-[22px] font-black leading-tight tracking-[-0.03em] text-[var(--wk-text)] mt-1">
            {disciplines.title}<br /><em className="italic font-light">{disciplines.titleItalic}</em>
          </h2>
          <p className="mt-2 text-[11px] text-[var(--wk-text-muted)]">{disciplines.note}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {disciplines.items.map((d) => (
            <div key={d.number} className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 text-center">
              <span className="text-[10px] font-black text-[var(--wk-brand)]">{d.number}</span>
              <p className="text-[11px] font-semibold text-[var(--wk-text)] mt-0.5 leading-tight">{d.name}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Watchlist */}
      <section className="py-12 px-5" style={{ background: "var(--wk-bg-subtle)" }}>
        <div className="mb-6">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)]">{watchlist.label}</span>
          <h2 className="text-[22px] font-black leading-tight tracking-[-0.03em] text-[var(--wk-text)] mt-1">
            {watchlist.title}<br /><em className="italic font-light">{watchlist.titleItalic}</em>
          </h2>
        </div>
        <div className="space-y-4">
          {watchlist.items.map((item) => (
            <div key={item.number} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--wk-v-intel)]/10 flex items-center justify-center text-[11px] font-black" style={{ color: "var(--wk-v-intel)" }}>{item.number}</span>
                <div>
                  <h3 className="text-[13px] font-bold text-[var(--wk-text)] leading-snug">{item.question}</h3>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--wk-v-intel)" }}>{item.signal}</p>
                  <p className="mt-2 text-[12px] text-[var(--wk-text-soft)] leading-relaxed">{item.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Timeline */}
      <section className="py-12 px-5" style={{ background: "var(--wk-bg)" }}>
        <div className="mb-6">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)]">{timeline.label}</span>
          <h2 className="text-[22px] font-black leading-tight tracking-[-0.03em] text-[var(--wk-text)] mt-1">
            {timeline.title}<br /><em className="italic font-light">{timeline.titleItalic}</em>
          </h2>
          <p className="mt-2 text-[11px] text-[var(--wk-text-muted)]">{timeline.note}</p>
        </div>
        <div className="relative pl-6 border-l-2 border-[var(--wk-brand)]/20 space-y-6">
          {timeline.events.map((e, i) => (
            <div key={i} className="relative">
              <div className="absolute -left-[25px] top-1 w-2.5 h-2.5 rounded-full bg-[var(--wk-brand)]" />
              <span className="text-[11px] font-black text-[var(--wk-brand)]">{e.date}</span>
              <p className="text-[13px] text-[var(--wk-text-soft)] mt-0.5">{e.event}</p>
            </div>
          ))}
        </div>
      </section>

      <ShareRow />

      {/* Follow Updates */}
      <section id="updates" className="py-12 px-5" style={{ background: "var(--wk-bg-subtle)" }}>
        <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6">
          <div className="mb-5">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)]">{follow.label}</span>
            <h2 className="text-[22px] font-black leading-tight tracking-[-0.03em] text-[var(--wk-text)] mt-1">
              {follow.title}<br /><em className="italic font-light">{follow.titleItalic}</em>
            </h2>
          </div>
          {follow.copy.map((p, i) => (
            <p key={i} className="text-[13px] leading-relaxed text-[var(--wk-text-soft)] mb-3">{p}</p>
          ))}
          <div className="mt-5 pt-5 border-t border-[var(--wk-divider)]">
            <h3 className="text-[15px] font-bold text-[var(--wk-text)] mb-1">{follow.form.heading}</h3>
            <p className="text-[12px] text-[var(--wk-text-muted)] mb-4">{follow.form.description}</p>
            <form
              onSubmit={handleFollowSubmit}
              className="space-y-3"
            >
              <input type="hidden" name="wk_session_id" value={sessionId} />
              <input type="hidden" name="wk_page_url" value={pageUrl} />
              <input type="hidden" name="wk_page_type" value="guide_detail" />
              <input type="hidden" name="wk_source_section" value="follow_form_mobile" />
              <div>
                <label className="block text-[11px] font-bold text-[var(--wk-text)] mb-1">{follow.form.emailLabel}</label>
                <input
                  type="email" name="email" placeholder={follow.form.emailPlaceholder} required
                  className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)]/40"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--wk-text)] mb-1">{follow.form.personaLabel}</label>
                <select name="persona" className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[13px] text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)]/40">
                  {follow.form.personaOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-start gap-2 text-[11px] text-[var(--wk-text-muted)] cursor-pointer">
                <input type="checkbox" name="consent" className="mt-0.5" />
                <span>{follow.form.consentLabel}</span>
              </label>
              <button type="submit" disabled={followStatus === "submitting" || followStatus === "success"} className="w-full rounded-lg bg-[var(--wk-brand)] px-4 py-3 text-[13px] font-bold text-[var(--wk-brand-on)] active:scale-[0.98] transition-transform whitespace-nowrap cursor-pointer disabled:opacity-60">
                {followStatus === "submitting" ? "Submitting..." : followStatus === "success" ? "You’re on the list!" : follow.form.submitLabel}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Back */}
      <div className="py-10 border-t border-[var(--wk-divider)]" style={{ background: "var(--wk-bg)" }}>
        <div className="px-5 text-center">
          <Link to="/guides" className="inline-flex items-center gap-1.5 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 py-3 text-[13px] font-bold text-[var(--wk-text)] active:scale-[0.97] transition-transform whitespace-nowrap">
            <i className="ri-arrow-left-line" /> Back to All Guides
          </Link>
        </div>
      </div>
    </div>
  );
}