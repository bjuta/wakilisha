import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";

export default function MobileGuides() {
  return (
    <div className="wk-mobile-v5">
      <section className="home-section">
        <div className="mx-5 text-center pt-6 pb-4">
          <div className="flex h-16 w-16 mx-auto mb-4 items-center justify-center rounded-2xl" style={{ background: "var(--wk-v-intel)", color: "#fff" }}>
            <WkIcon name="Compass" size={28} />
          </div>
          <div className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] mb-2 flex items-center justify-center gap-2">
            <span className="w-3 h-px bg-[var(--wk-brand)]" />
            Recently Launched
          </div>
          <h1 className="text-[24px] font-black tracking-[-0.04em] text-[var(--wk-text)] mb-2">WAKILISHA Guides</h1>
          <p className="text-[13px] leading-relaxed text-[var(--wk-text-soft)]">
            Your practical discovery layer for African creative life. Where to go, what to experience, who to know.
          </p>
        </div>
      </section>

      <section className="home-section">
        <div className="mx-5 space-y-3">
          {[
            { label: "Where to go", icon: "MapPin" },
            { label: "What to hear", icon: "Headphones" },
            { label: "What to watch", icon: "Film" },
            { label: "Who to know", icon: "Star" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "var(--wk-v-intel)", color: "#fff" }}>
                <WkIcon name={item.icon} size={18} />
              </div>
              <span className="text-[14px] font-bold text-[var(--wk-text)]">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section pb-8">
        <div className="mx-5 text-center">
          <p className="text-[13px] text-[var(--wk-text-muted)] mb-4">
            Full guides are being curated by our editorial team.
          </p>
          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-3 text-[13px] font-bold text-[var(--wk-brand-on)] active:scale-[0.97] transition-transform mobile-pressable whitespace-nowrap"
          >
            <WkIcon name="ArrowLeft" size={16} />
            Back to WAKILISHA
          </Link>
        </div>
      </section>
    </div>
  );
}