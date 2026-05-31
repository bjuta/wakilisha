import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";

export default function MobileAuth() {
  return (
    <main className="wk-mobile-v5 auth-screen">
      <section className="auth-logo-zone">
        <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-[var(--wk-brand)] text-[32px] font-black text-[var(--wk-brand-on)] auth-logo-shadow">
          W
        </div>
        <div className="text-center">
          <div className="text-[28px] font-black tracking-[-.05em] text-[var(--wk-text)]">WAKILISHA</div>
          <p className="auth-tagline">Your people are here. Sign in to follow artists, save charts, and keep your cultural graph close.</p>
        </div>
      </section>

      <section className="auth-choice-grid">
        <button className="auth-choice on">Charts</button>
        <button className="auth-choice">Artists</button>
        <button className="auth-choice">Magazine</button>
      </section>

      <section className="auth-buttons">
        <button className="auth-btn auth-btn-primary"><WkIcon name="Mail" size={17} /> Continue with email</button>
        <button className="auth-btn auth-btn-secondary"><WkIcon name="Chrome" size={17} /> Continue with Google</button>
        <div className="auth-divider"><span className="auth-divider-line" /><span className="auth-divider-text">or</span><span className="auth-divider-line" /></div>
        <Link to="/" className="auth-btn auth-btn-ghost">Explore without signing in</Link>
      </section>

      <p className="auth-terms">By continuing, you agree to WAKILISHA’s <a>Terms</a> and <a>Privacy Policy</a>.</p>
    </main>
  );
}
