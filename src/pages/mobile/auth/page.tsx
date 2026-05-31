import { Link } from "react-router-dom";

export default function MobileAuth() {
  return (
    <main className="wk-mobile-v5 auth-screen">
      <section className="auth-logo-zone">
        <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-[#84c241] text-[32px] font-black text-[#081006] shadow-[0_18px_60px_rgba(132,194,65,.22)]">
          W
        </div>
        <div className="text-center">
          <div className="text-[28px] font-black tracking-[-.05em] text-white">WAKILISHA</div>
          <p className="auth-tagline">Your people are here. Sign in to follow artists, save charts, and keep your cultural graph close.</p>
        </div>
      </section>

      <section className="auth-buttons">
        <button className="auth-btn auth-btn-primary"><i className="ri-mail-line" /> Continue with email</button>
        <button className="auth-btn auth-btn-secondary"><i className="ri-google-fill" /> Continue with Google</button>
        <div className="auth-divider"><span className="auth-divider-line" /><span className="auth-divider-text">or</span><span className="auth-divider-line" /></div>
        <Link to="/" className="auth-btn auth-btn-ghost">Explore without signing in</Link>
      </section>

      <p className="auth-terms">By continuing, you agree to WAKILISHA’s <a>Terms</a> and <a>Privacy Policy</a>.</p>
    </main>
  );
}
