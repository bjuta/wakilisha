import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { WkIcon } from "@/components/design-system/Icon";
import { resendVerificationEmail } from "@/services/auth/accountVerification";

type Choice = "charts" | "artists" | "magazine";
type AuthMode = "signin" | "signup" | "forgot" | "magic" | "verify";

const CHOICE_ROUTES: Record<Choice, string> = {
  charts: "/charts",
  artists: "/artists",
  magazine: "/magazine",
};

export default function AuthPage() {
  const navigate = useNavigate();
  const [choice, setChoice] = useState<Choice>("charts");
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [recoveryChecked, setRecoveryChecked] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedMode = params.get("mode");
    const requestedEmail = params.get("email");

    if (
      requestedMode === "signin" ||
      requestedMode === "signup" ||
      requestedMode === "forgot" ||
      requestedMode === "magic" ||
      requestedMode === "verify"
    ) {
      setMode(requestedMode);
      setShowEmailForm(true);
    }

    if (requestedEmail) setEmail(requestedEmail);

    let alive = true;
    async function checkRecoveryHash() {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const type = hash.get("type");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (type === "recovery" && accessToken && refreshToken) {
        setIsRecovery(true);
        const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        window.history.replaceState({}, document.title, window.location.pathname);
        if (!alive) return;
        if (sessionError) setError(sessionError.message);
      }
      if (alive) setRecoveryChecked(true);
    }
    checkRecoveryHash();
    return () => { alive = false; };
  }, []);

  function clearMessages() {
    setError(null);
    setSuccess(null);
  }

  function resolveReturnTo(): string {
    const raw = new URLSearchParams(window.location.search).get("returnTo");
    if (!raw) return CHOICE_ROUTES[choice];

    try {
      if (raw.startsWith("http://") || raw.startsWith("https://")) {
        const url = new URL(raw);
        if (url.origin !== window.location.origin) return CHOICE_ROUTES[choice];
        return `${url.pathname}${url.search}${url.hash}` || CHOICE_ROUTES[choice];
      }

      if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/auth")) {
        return CHOICE_ROUTES[choice];
      }

      return raw;
    } catch {
      return CHOICE_ROUTES[choice];
    }
  }

  async function handleRecoveryPassword(e: FormEvent) {
    e.preventDefault();
    clearMessages();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess("Password updated. You can now sign in with your new password.");
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err?.message ?? "Could not update password.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset(e: FormEvent) {
    e.preventDefault();
    clearMessages();
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSuccess("Password reset email sent. Open the link in your email to set a new password.");
  }

  async function handleResendVerification(e: FormEvent) {
    e.preventDefault();
    clearMessages();

    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }

    setLoading(true);

    try {
      await resendVerificationEmail(email.trim(), resolveReturnTo());
      setSuccess("Verification email sent. Open it from your inbox to use Save, Follow, Comments, and the rest of the community layer.");
    } catch (err: any) {
      setError(err?.message ?? "Could not send verification email.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink(e: FormEvent) {
    e.preventDefault();
    clearMessages();
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    setLoading(true);
    const { error: magicError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}${resolveReturnTo()}`,
        shouldCreateUser: true,
      },
    });
    setLoading(false);
    if (magicError) {
      setError(magicError.message);
      return;
    }
    setSuccess("Magic link sent. Open it from your email to continue.");
  }

  async function handleEmailAuth(e: FormEvent) {
    e.preventDefault();
    clearMessages();

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
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() || email.trim().split("@")[0] },
            emailRedirectTo: `${window.location.origin}${resolveReturnTo()}`,
          },
        });
        if (signUpError) throw signUpError;

        if (!signUpData.session) {
          setMode("verify");
          setShowEmailForm(true);
          setSuccess("We sent you a verification email. You can keep browsing, but you will need to verify before participating.");
          return;
        }

        navigate(resolveReturnTo());
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        navigate(resolveReturnTo());
      }
    } catch (err: any) {
      setError(err?.message ?? "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAuth() {
    clearMessages();
    setLoading(true);
    try {
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}${resolveReturnTo()}` },
      });
      if (googleError) throw googleError;
    } catch (err: any) {
      setError(err?.message ?? "Google sign-in failed.");
      setLoading(false);
    }
  }

  function toggleMode() {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    clearMessages();
  }

  function goToMode(nextMode: AuthMode) {
    clearMessages();
    setMode(nextMode);
    setShowEmailForm(true);
  }

  const brandPanel = (
    <section className="hidden lg:flex flex-col justify-between relative overflow-hidden" style={{ width: "46%", background: "var(--wk-surface)" }}>
      <div aria-hidden="true" className="pointer-events-none absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full opacity-[0.06]" style={{ background: "var(--wk-brand)" }} />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 left-20 w-[320px] h-[320px] rounded-full opacity-[0.04]" style={{ background: "var(--wk-v-film)" }} />
      <div className="relative z-10 p-10 md:p-14">
        <div className="flex h-14 w-14 items-center justify-center rounded-[20px] text-[22px] font-black mb-6" style={{ background: "var(--wk-brand)", color: "var(--wk-brand-on)", boxShadow: "0 18px 60px rgba(var(--wk-brand-rgb), 0.22)" }}>W</div>
        <div className="font-black tracking-[-.05em]" style={{ fontFamily: "var(--wk-font-display)", fontSize: "clamp(36px, 4vw, 52px)", lineHeight: 0.94, color: "var(--wk-text)" }}>WAKILISHA</div>
      </div>
      <div className="relative z-10 p-10 md:p-14 pb-14">
        <p className="max-w-[340px] leading-relaxed" style={{ fontFamily: "var(--wk-font-body)", fontSize: "15px", color: "var(--wk-text-soft)" }}>
          {isRecovery ? "Choose a new password and get back into your account securely." : mode === "forgot" ? "Reset your public WAKILISHA account password securely." : mode === "magic" ? "Use a one-time email link to continue without a password." : "Your people are here. Sign in to follow artists, save charts, and keep your culture close."}
        </p>
        {!isRecovery && <div className="flex gap-2 mt-8">{(["charts", "artists", "magazine"] as const).map((c) => <button key={c} onClick={() => setChoice(c)} className="px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-[0.12em] whitespace-nowrap transition-all duration-200 cursor-pointer capitalize" style={{ background: choice === c ? "var(--wk-brand-soft)" : "transparent", border: choice === c ? "1px solid rgba(var(--wk-brand-rgb), 0.35)" : "1px solid var(--wk-border)", color: choice === c ? "var(--wk-brand)" : "var(--wk-text-muted)" }}>{c}</button>)}</div>}
      </div>
    </section>
  );

  if (!recoveryChecked) {
    return <main className="flex min-h-screen items-center justify-center" style={{ background: "var(--wk-bg)", color: "var(--wk-text)" }}><div className="text-[13px]" style={{ color: "var(--wk-text-muted)" }}>Checking auth link…</div></main>;
  }

  const heading = isRecovery ? "Reset your password" : mode === "verify" ? "Verify your email" : mode === "forgot" ? "Forgot password?" : mode === "magic" ? "Get a magic link" : mode === "signin" ? "Welcome back" : "Create your account";
  const subcopy = isRecovery ? "Enter a new password for your WAKILISHA account." : mode === "verify" ? "Confirm your email to use saves, follows, comments, replies, and community actions." : mode === "forgot" ? "Enter your email and we will send a secure reset link." : mode === "magic" ? "Enter your email and we will send a one-time sign-in link." : mode === "signin" ? "Sign in to continue to your WAKILISHA account." : "Join WAKILISHA and connect with African culture.";

  return (
    <main className="flex min-h-screen" style={{ background: "var(--wk-bg)" }}>
      {brandPanel}
      <section className="flex-1 flex flex-col justify-center px-6 sm:px-10 md:px-16 lg:px-20 py-16">
        <div className="w-full max-w-[400px] mx-auto">
          <div className="lg:hidden mb-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] text-[18px] font-black mb-5" style={{ background: "var(--wk-brand)", color: "var(--wk-brand-on)", boxShadow: "0 14px 40px rgba(var(--wk-brand-rgb), 0.18)" }}>W</div>
            <div className="font-black tracking-[-.05em] text-[28px]" style={{ fontFamily: "var(--wk-font-display)", color: "var(--wk-text)" }}>WAKILISHA</div>
          </div>

          <h1 className="font-black tracking-[-.03em] mb-1" style={{ fontFamily: "var(--wk-font-display)", fontSize: "clamp(26px, 2.5vw, 34px)", lineHeight: 1.1, color: "var(--wk-text)" }}>{heading}</h1>
          <p className="mb-8 leading-relaxed" style={{ fontFamily: "var(--wk-font-body)", fontSize: "14px", color: "var(--wk-text-muted)" }}>{subcopy}</p>

          {error && <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-6 text-[13px] font-medium" style={{ background: "var(--wk-danger-soft)", color: "var(--wk-danger)", fontFamily: "var(--wk-font-ui)" }}><WkIcon name="AlertCircle" size={16} /><span className="flex-1">{error}</span><button onClick={() => setError(null)} className="cursor-pointer hover:opacity-70"><WkIcon name="X" size={14} /></button></div>}
          {success && <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-6 text-[13px] font-medium" style={{ background: "var(--wk-success-soft)", color: "var(--wk-success)", fontFamily: "var(--wk-font-ui)" }}><WkIcon name="CheckCircle" size={16} /><span className="flex-1">{success}</span></div>}

          {isRecovery ? (
            <div className="space-y-4">
              {success ? (
                <>
                  <button onClick={() => navigate("/admin/login")} className="w-full h-[52px] rounded-[14px] flex items-center justify-center gap-3 font-bold text-[14px]" style={{ background: "var(--wk-brand)", color: "var(--wk-brand-on)", fontFamily: "var(--wk-font-ui)" }}>Go to admin login</button>
                  <button onClick={() => { setIsRecovery(false); setSuccess(null); setMode("signin"); }} className="w-full h-[44px] rounded-[14px] flex items-center justify-center gap-2 font-semibold text-[13px]" style={{ background: "transparent", color: "var(--wk-text-muted)", fontFamily: "var(--wk-font-ui)" }}>Go to public login</button>
                </>
              ) : (
                <form onSubmit={handleRecoveryPassword} className="flex flex-col gap-3 mb-6">
                  <input type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="w-full h-[52px] rounded-[14px] px-5 text-[14px] outline-none transition-colors" style={{ background: "var(--wk-surface-raised)", border: "1px solid var(--wk-border)", color: "var(--wk-text)", fontFamily: "var(--wk-font-ui)" }} />
                  <input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} className="w-full h-[52px] rounded-[14px] px-5 text-[14px] outline-none transition-colors" style={{ background: "var(--wk-surface-raised)", border: "1px solid var(--wk-border)", color: "var(--wk-text)", fontFamily: "var(--wk-font-ui)" }} />
                  <button type="submit" disabled={loading} className="w-full h-[52px] rounded-[14px] flex items-center justify-center gap-3 font-bold text-[14px] whitespace-nowrap transition-all duration-200 cursor-pointer hover:opacity-90 active:scale-[0.98] disabled:opacity-50" style={{ background: "var(--wk-brand)", color: "var(--wk-brand-on)", fontFamily: "var(--wk-font-ui)" }}>{loading ? "Updating..." : "Update password"}</button>
                </form>
              )}
            </div>
          ) : mode === "verify" ? (
            <form onSubmit={handleResendVerification} className="flex flex-col gap-3 mb-6">
              <div className="rounded-[18px] p-4 mb-1" style={{ background: "var(--wk-brand-soft)", border: "1px solid rgba(var(--wk-brand-rgb), 0.28)" }}>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ background: "var(--wk-brand)", color: "var(--wk-brand-on)" }}>
                    <WkIcon name="MailCheck" size={18} />
                  </div>
                  <div>
                    <p className="text-[13px] font-black" style={{ color: "var(--wk-text)" }}>
                      Participation is locked until your email is verified.
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--wk-text-muted)" }}>
                      You can still browse WAKILISHA. Verify your email to save, follow, comment, reply, vote, react, and report.
                    </p>
                  </div>
                </div>
              </div>

              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-[52px] rounded-[14px] px-5 text-[14px] outline-none transition-colors"
                style={{ background: "var(--wk-surface-raised)", border: "1px solid var(--wk-border)", color: "var(--wk-text)", fontFamily: "var(--wk-font-ui)" }}
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full h-[52px] rounded-[14px] flex items-center justify-center gap-3 font-bold text-[14px] whitespace-nowrap transition-all duration-200 cursor-pointer hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                style={{ background: "var(--wk-brand)", color: "var(--wk-brand-on)", fontFamily: "var(--wk-font-ui)" }}
              >
                {loading ? "Sending..." : "Resend verification email"}
              </button>

              <button
                type="button"
                onClick={() => navigate(resolveReturnTo())}
                className="w-full h-[44px] rounded-[14px] flex items-center justify-center gap-2 font-semibold text-[13px]"
                style={{ background: "transparent", color: "var(--wk-text-muted)", fontFamily: "var(--wk-font-ui)" }}
              >
                Keep browsing
              </button>
            </form>
          ) : mode === "forgot" ? (
            <form onSubmit={handlePasswordReset} className="flex flex-col gap-3 mb-6">
              <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full h-[52px] rounded-[14px] px-5 text-[14px] outline-none transition-colors" style={{ background: "var(--wk-surface-raised)", border: "1px solid var(--wk-border)", color: "var(--wk-text)", fontFamily: "var(--wk-font-ui)" }} />
              <button type="submit" disabled={loading} className="w-full h-[52px] rounded-[14px] flex items-center justify-center gap-3 font-bold text-[14px] whitespace-nowrap transition-all duration-200 cursor-pointer hover:opacity-90 active:scale-[0.98] disabled:opacity-50" style={{ background: "var(--wk-brand)", color: "var(--wk-brand-on)", fontFamily: "var(--wk-font-ui)" }}>{loading ? "Sending..." : "Send password reset"}</button>
              <button type="button" onClick={() => { clearMessages(); setMode("signin"); }} className="w-full h-[44px] rounded-[14px] flex items-center justify-center gap-2 font-semibold text-[13px]" style={{ background: "transparent", color: "var(--wk-text-muted)", fontFamily: "var(--wk-font-ui)" }}>Back to login</button>
            </form>
          ) : mode === "magic" ? (
            <form onSubmit={handleMagicLink} className="flex flex-col gap-3 mb-6">
              <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full h-[52px] rounded-[14px] px-5 text-[14px] outline-none transition-colors" style={{ background: "var(--wk-surface-raised)", border: "1px solid var(--wk-border)", color: "var(--wk-text)", fontFamily: "var(--wk-font-ui)" }} />
              <button type="submit" disabled={loading} className="w-full h-[52px] rounded-[14px] flex items-center justify-center gap-3 font-bold text-[14px] whitespace-nowrap transition-all duration-200 cursor-pointer hover:opacity-90 active:scale-[0.98] disabled:opacity-50" style={{ background: "var(--wk-brand)", color: "var(--wk-brand-on)", fontFamily: "var(--wk-font-ui)" }}>{loading ? "Sending..." : "Send magic link"}</button>
              <button type="button" onClick={() => { clearMessages(); setMode("signin"); }} className="w-full h-[44px] rounded-[14px] flex items-center justify-center gap-2 font-semibold text-[13px]" style={{ background: "transparent", color: "var(--wk-text-muted)", fontFamily: "var(--wk-font-ui)" }}>Back to login</button>
            </form>
          ) : showEmailForm ? (
            <form onSubmit={handleEmailAuth} className="flex flex-col gap-3 mb-6">
              {mode === "signup" && <input type="text" placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full h-[52px] rounded-[14px] px-5 text-[14px] outline-none transition-colors" style={{ background: "var(--wk-surface-raised)", border: "1px solid var(--wk-border)", color: "var(--wk-text)", fontFamily: "var(--wk-font-ui)" }} />}
              <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full h-[52px] rounded-[14px] px-5 text-[14px] outline-none transition-colors" style={{ background: "var(--wk-surface-raised)", border: "1px solid var(--wk-border)", color: "var(--wk-text)", fontFamily: "var(--wk-font-ui)" }} />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="w-full h-[52px] rounded-[14px] px-5 text-[14px] outline-none transition-colors" style={{ background: "var(--wk-surface-raised)", border: "1px solid var(--wk-border)", color: "var(--wk-text)", fontFamily: "var(--wk-font-ui)" }} />
              <div className="flex items-center justify-between gap-3 px-1">
                <button type="button" onClick={() => goToMode("forgot")} className="text-[12px] font-bold hover:opacity-80" style={{ color: "var(--wk-text-muted)", fontFamily: "var(--wk-font-ui)" }}>Forgot password?</button>
                <button type="button" onClick={() => goToMode("magic")} className="text-[12px] font-bold hover:opacity-80" style={{ color: "var(--wk-text-muted)", fontFamily: "var(--wk-font-ui)" }}>Use magic link</button>
              </div>
              <button type="submit" disabled={loading} className="w-full h-[52px] rounded-[14px] flex items-center justify-center gap-3 font-bold text-[14px] whitespace-nowrap transition-all duration-200 cursor-pointer hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: "var(--wk-brand)", color: "var(--wk-brand-on)", fontFamily: "var(--wk-font-ui)" }}>{loading ? (mode === "signin" ? "Signing in..." : "Creating account...") : mode === "signin" ? <><WkIcon name="LogIn" size={17} /> Sign in with email</> : <><WkIcon name="UserPlus" size={17} /> Create account</>}</button>
              <button type="button" onClick={() => { setShowEmailForm(false); clearMessages(); }} className="w-full h-[44px] rounded-[14px] flex items-center justify-center gap-2 font-semibold text-[13px] whitespace-nowrap transition-all duration-200 cursor-pointer hover:opacity-80 active:scale-[0.98]" style={{ background: "transparent", color: "var(--wk-text-muted)", fontFamily: "var(--wk-font-ui)" }}><WkIcon name="ArrowLeft" size={15} /> Back</button>
            </form>
          ) : (
            <div className="flex flex-col gap-3 mb-6">
              <button onClick={() => setShowEmailForm(true)} disabled={loading} className="w-full h-[52px] rounded-[14px] flex items-center justify-center gap-3 font-bold text-[14px] whitespace-nowrap transition-all duration-200 cursor-pointer hover:opacity-90 active:scale-[0.98]" style={{ background: "var(--wk-brand)", color: "var(--wk-brand-on)", fontFamily: "var(--wk-font-ui)" }}><WkIcon name="Mail" size={17} />Continue with email</button>
              <button onClick={() => goToMode("magic")} disabled={loading} className="w-full h-[52px] rounded-[14px] flex items-center justify-center gap-3 font-bold text-[14px] whitespace-nowrap transition-all duration-200 cursor-pointer hover:opacity-90 active:scale-[0.98]" style={{ background: "var(--wk-surface-raised)", border: "1px solid var(--wk-border)", color: "var(--wk-text)", fontFamily: "var(--wk-font-ui)" }}><WkIcon name="MailCheck" size={17} />Email me a magic link</button>
              <button onClick={handleGoogleAuth} disabled={loading} className="w-full h-[52px] rounded-[14px] flex items-center justify-center gap-3 font-bold text-[14px] whitespace-nowrap transition-all duration-200 cursor-pointer hover:opacity-90 active:scale-[0.98] disabled:opacity-50" style={{ background: "var(--wk-surface-raised)", border: "1px solid var(--wk-border)", color: "var(--wk-text)", fontFamily: "var(--wk-font-ui)" }}>{loading ? "Loading..." : <><WkIcon name="Chrome" size={17} />Continue with Google</>}</button>
              <div className="flex items-center gap-3 my-1"><span className="flex-1 h-px" style={{ background: "var(--wk-divider)" }} /><span className="text-[11px] font-medium" style={{ fontFamily: "var(--wk-font-ui)", color: "var(--wk-text-faint)" }}>or</span><span className="flex-1 h-px" style={{ background: "var(--wk-divider)" }} /></div>
              <Link to="/" className="w-full h-[52px] rounded-[14px] flex items-center justify-center gap-3 font-bold text-[14px] whitespace-nowrap transition-all duration-200 cursor-pointer hover:opacity-80 active:scale-[0.98] no-underline" style={{ background: "transparent", color: "var(--wk-text-muted)", fontFamily: "var(--wk-font-ui)" }}>Explore without signing in</Link>
            </div>
          )}

          {!isRecovery && !["forgot", "magic", "verify"].includes(mode) && <button onClick={toggleMode} className="w-full text-center mb-4 text-[13px] font-semibold cursor-pointer hover:opacity-80 transition-opacity" style={{ fontFamily: "var(--wk-font-ui)", color: "var(--wk-brand)" }}>{mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}</button>}
          <p className="text-center leading-relaxed" style={{ fontFamily: "var(--wk-font-ui)", fontSize: "11px", color: "var(--wk-text-faint)" }}>By continuing, you agree to WAKILISHA's <a href="#" className="font-semibold hover:underline" style={{ color: "var(--wk-brand)" }}>Terms</a> and <a href="#" className="font-semibold hover:underline" style={{ color: "var(--wk-brand)" }}>Privacy Policy</a>.</p>
        </div>
      </section>
    </main>
  );
}
