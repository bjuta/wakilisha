import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { WkIcon } from "@/components/design-system/Icon";

type Choice = "charts" | "artists" | "magazine";

const CHOICE_ROUTES: Record<Choice, string> = {
  charts: "/charts",
  artists: "/artists",
  magazine: "/magazine",
};

export default function AuthPage() {
  const navigate = useNavigate();
  const [choice, setChoice] = useState<Choice>("charts");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);

  async function handleEmailAuth(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() || email.trim().split("@")[0] },
          },
        });
        if (signUpError) throw signUpError;
        navigate(CHOICE_ROUTES[choice]);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        navigate(CHOICE_ROUTES[choice]);
      }
    } catch (err: any) {
      setError(err?.message ?? "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAuth() {
    setError(null);
    setLoading(true);
    try {
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}${CHOICE_ROUTES[choice]}` },
      });
      if (googleError) throw googleError;
    } catch (err: any) {
      setError(err?.message ?? "Google sign-in failed.");
      setLoading(false);
    }
  }

  function toggleMode() {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setError(null);
  }

  const brandPanel = (
    <section
      className="hidden lg:flex flex-col justify-between relative overflow-hidden"
      style={{ width: "46%", background: "var(--wk-surface)" }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full opacity-[0.06]"
        style={{ background: "var(--wk-brand)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 left-20 w-[320px] h-[320px] rounded-full opacity-[0.04]"
        style={{ background: "var(--wk-v-film)" }}
      />
      <div className="relative z-10 p-10 md:p-14">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-[20px] text-[22px] font-black mb-6"
          style={{ background: "var(--wk-brand)", color: "var(--wk-brand-on)", boxShadow: "0 18px 60px rgba(var(--wk-brand-rgb), 0.22)" }}
        >
          W
        </div>
        <div
          className="font-black tracking-[-.05em]"
          style={{ fontFamily: "var(--wk-font-display)", fontSize: "clamp(36px, 4vw, 52px)", lineHeight: 0.94, color: "var(--wk-text)" }}
        >
          WAKILISHA
        </div>
      </div>
      <div className="relative z-10 p-10 md:p-14 pb-14">
        <p className="max-w-[340px] leading-relaxed" style={{ fontFamily: "var(--wk-font-body)", fontSize: "15px", color: "var(--wk-text-soft)" }}>
          Your people are here. Sign in to follow artists, save charts, and keep your cultural graph close.
        </p>
        <div className="flex gap-2 mt-8">
          {(["charts", "artists", "magazine"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setChoice(c)}
              className="px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.12em] whitespace-nowrap transition-all duration-200 cursor-pointer capitalize"
              style={{
                background: choice === c ? "var(--wk-brand-soft)" : "transparent",
                border: choice === c ? "1px solid rgba(var(--wk-brand-rgb), 0.35)" : "1px solid var(--wk-border)",
                color: choice === c ? "var(--wk-brand)" : "var(--wk-text-muted)",
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </section>
  );

  return (
    <main className="flex min-h-screen" style={{ background: "var(--wk-bg)" }}>
      {brandPanel}

      <section className="flex-1 flex flex-col justify-center px-6 sm:px-10 md:px-16 lg:px-20 py-16">
        <div className="w-full max-w-[400px] mx-auto">

          {/* Mobile-only logo */}
          <div className="lg:hidden mb-10">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-[16px] text-[18px] font-black mb-5"
              style={{ background: "var(--wk-brand)", color: "var(--wk-brand-on)", boxShadow: "0 14px 40px rgba(var(--wk-brand-rgb), 0.18)" }}
            >
              W
            </div>
            <div className="font-black tracking-[-.05em] text-[28px]" style={{ fontFamily: "var(--wk-font-display)", color: "var(--wk-text)" }}>
              WAKILISHA
            </div>
          </div>

          {/* Header */}
          <h1 className="font-black tracking-[-.03em] mb-1" style={{ fontFamily: "var(--wk-font-display)", fontSize: "clamp(26px, 2.5vw, 34px)", lineHeight: 1.1, color: "var(--wk-text)" }}>
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mb-8 leading-relaxed" style={{ fontFamily: "var(--wk-font-body)", fontSize: "14px", color: "var(--wk-text-muted)" }}>
            {mode === "signin" ? "Sign in to continue to your cultural graph." : "Join WAKILISHA and connect with African culture."}
          </p>

          {/* Error banner */}
          {error && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl mb-6 text-[13px] font-medium"
              style={{ background: "var(--wk-danger-soft)", color: "var(--wk-danger)", fontFamily: "var(--wk-font-ui)" }}
            >
              <WkIcon name="AlertCircle" size={16} />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} className="cursor-pointer hover:opacity-70">
                <WkIcon name="X" size={14} />
              </button>
            </div>
          )}

          {/* Email/Password Form or CTA */}
          {showEmailForm ? (
            <form onSubmit={handleEmailAuth} className="flex flex-col gap-3 mb-6">
              {mode === "signup" && (
                <input
                  type="text"
                  placeholder="Display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full h-[52px] rounded-[14px] px-5 text-[14px] outline-none transition-colors"
                  style={{
                    background: "var(--wk-surface-raised)",
                    border: "1px solid var(--wk-border)",
                    color: "var(--wk-text)",
                    fontFamily: "var(--wk-font-ui)",
                  }}
                />
              )}
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-[52px] rounded-[14px] px-5 text-[14px] outline-none transition-colors"
                style={{
                  background: "var(--wk-surface-raised)",
                  border: "1px solid var(--wk-border)",
                  color: "var(--wk-text)",
                  fontFamily: "var(--wk-font-ui)",
                }}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full h-[52px] rounded-[14px] px-5 text-[14px] outline-none transition-colors"
                style={{
                  background: "var(--wk-surface-raised)",
                  border: "1px solid var(--wk-border)",
                  color: "var(--wk-text)",
                  fontFamily: "var(--wk-font-ui)",
                }}
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full h-[52px] rounded-[14px] flex items-center justify-center gap-3 font-bold text-[14px] whitespace-nowrap transition-all duration-200 cursor-pointer hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "var(--wk-brand)", color: "var(--wk-brand-on)", fontFamily: "var(--wk-font-ui)" }}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {mode === "signin" ? "Signing in..." : "Creating account..."}
                  </span>
                ) : mode === "signin" ? (
                  <>
                    <WkIcon name="LogIn" size={17} /> Sign in with email
                  </>
                ) : (
                  <>
                    <WkIcon name="UserPlus" size={17} /> Create account
                  </>
                )}
              </button>

              {/* Back to initial view */}
              <button
                type="button"
                onClick={() => { setShowEmailForm(false); setError(null); }}
                className="w-full h-[44px] rounded-[14px] flex items-center justify-center gap-2 font-semibold text-[13px] whitespace-nowrap transition-all duration-200 cursor-pointer hover:opacity-80 active:scale-[0.98]"
                style={{ background: "transparent", color: "var(--wk-text-muted)", fontFamily: "var(--wk-font-ui)" }}
              >
                <WkIcon name="ArrowLeft" size={15} /> Back
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-3 mb-6">
              <button
                onClick={() => setShowEmailForm(true)}
                disabled={loading}
                className="w-full h-[52px] rounded-[14px] flex items-center justify-center gap-3 font-bold text-[14px] whitespace-nowrap transition-all duration-200 cursor-pointer hover:opacity-90 active:scale-[0.98]"
                style={{ background: "var(--wk-brand)", color: "var(--wk-brand-on)", fontFamily: "var(--wk-font-ui)" }}
              >
                <WkIcon name="Mail" size={17} />
                Continue with email
              </button>

              <button
                onClick={handleGoogleAuth}
                disabled={loading}
                className="w-full h-[52px] rounded-[14px] flex items-center justify-center gap-3 font-bold text-[14px] whitespace-nowrap transition-all duration-200 cursor-pointer hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                style={{ background: "var(--wk-surface-raised)", border: "1px solid var(--wk-border)", color: "var(--wk-text)", fontFamily: "var(--wk-font-ui)" }}
              >
                {loading ? (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <WkIcon name="Chrome" size={17} />
                )}
                Continue with Google
              </button>

              <div className="flex items-center gap-3 my-1">
                <span className="flex-1 h-px" style={{ background: "var(--wk-divider)" }} />
                <span className="text-[11px] font-medium" style={{ fontFamily: "var(--wk-font-ui)", color: "var(--wk-text-faint)" }}>or</span>
                <span className="flex-1 h-px" style={{ background: "var(--wk-divider)" }} />
              </div>

              <Link
                to="/"
                className="w-full h-[52px] rounded-[14px] flex items-center justify-center gap-3 font-bold text-[14px] whitespace-nowrap transition-all duration-200 cursor-pointer hover:opacity-80 active:scale-[0.98] no-underline"
                style={{ background: "transparent", color: "var(--wk-text-muted)", fontFamily: "var(--wk-font-ui)" }}
              >
                Explore without signing in
              </Link>
            </div>
          )}

          {/* Toggle sign in / sign up */}
          <button
            onClick={toggleMode}
            className="w-full text-center mb-4 text-[13px] font-semibold cursor-pointer hover:opacity-80 transition-opacity"
            style={{ fontFamily: "var(--wk-font-ui)", color: "var(--wk-brand)" }}
          >
            {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>

          {/* Terms */}
          <p className="text-center leading-relaxed" style={{ fontFamily: "var(--wk-font-ui)", fontSize: "11px", color: "var(--wk-text-faint)" }}>
            By continuing, you agree to WAKILISHA&apos;s{" "}
            <a href="#" className="font-semibold hover:underline" style={{ color: "var(--wk-brand)" }}>Terms</a>{" "}
            and{" "}
            <a href="#" className="font-semibold hover:underline" style={{ color: "var(--wk-brand)" }}>Privacy Policy</a>.
          </p>
        </div>
      </section>
    </main>
  );
}