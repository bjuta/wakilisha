import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { supabase } from "@/lib/supabase";
import { fetchUserRole, getDefaultRoute, roleCanAccessAdmin } from "@/services/userRoles";

type Mode = "signin" | "checking" | "denied" | "forgot" | "magic";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const next = params.get("next") || "/admin";
  const [mode, setMode] = useState<Mode>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [deniedEmail, setDeniedEmail] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function checkExistingSession() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) {
        setMode("signin");
        return;
      }
      const role = await fetchUserRole(user.id);
      if (!alive) return;
      if (roleCanAccessAdmin(role?.role ?? null)) {
        navigate(next || getDefaultRoute(role!.role), { replace: true });
      } else {
        setDeniedEmail(user.email ?? null);
        setMode("denied");
      }
    }
    checkExistingSession();
    return () => { alive = false; };
  }, [navigate, next]);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    clearMessages();
    setLoading(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !data.user) {
      setError(signInError?.message || "Could not sign in.");
      setLoading(false);
      return;
    }
    const role = await fetchUserRole(data.user.id);
    if (!roleCanAccessAdmin(role?.role ?? null)) {
      await supabase.auth.signOut();
      setDeniedEmail(data.user.email ?? email);
      setMode("denied");
      setLoading(false);
      return;
    }
    navigate(next || getDefaultRoute(role!.role), { replace: true });
  };

  const handlePasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    clearMessages();
    if (!email.trim()) {
      setError("Enter your admin email address.");
      return;
    }
    setLoading(true);
    const redirectTo = `${window.location.origin}/auth/reset-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSuccess("Password reset email sent. Open the link in your email to set a new password.");
  };

  const handleMagicLink = async (event: React.FormEvent) => {
    event.preventDefault();
    clearMessages();
    if (!email.trim()) {
      setError("Enter your admin email address.");
      return;
    }
    setLoading(true);
    const emailRedirectTo = `${window.location.origin}/admin/login?next=${encodeURIComponent(next)}`;
    const { error: magicError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo, shouldCreateUser: false },
    });
    setLoading(false);
    if (magicError) {
      setError(magicError.message);
      return;
    }
    setSuccess("Magic link sent. Open it from your email to continue into Admin Studio.");
  };

  const handleGoogle = async () => {
    clearMessages();
    setLoading(true);
    const redirectTo = `${window.location.origin}/admin/login?next=${encodeURIComponent(next)}`;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  };

  const signOutAndPublic = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  const signOutAndRetry = async () => {
    setLoading(true);
    clearMessages();
    await supabase.auth.signOut();
    setEmail("");
    setPassword("");
    setDeniedEmail(null);
    setMode("signin");
    setLoading(false);
  };

  const backToSignin = () => {
    clearMessages();
    setMode("signin");
  };

  return (
    <div className="min-h-screen bg-wk-bg text-wk-text">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-12">
        <div className="grid w-full gap-6 lg:grid-cols-[1fr_420px] lg:items-center">
          <div className="hidden lg:block">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-wk-brand/20 bg-wk-brand-soft px-3 py-1 text-[11px] font-black uppercase tracking-wider text-wk-brand">
              <WkIcon name="ShieldCheck" size={14} /> Admin Studio
            </div>
            <h1 className="max-w-2xl text-[44px] font-black leading-[0.95] tracking-tight text-wk-text">Staff access is separate from public WAKILISHA accounts.</h1>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-wk-text-muted">
              Public signups become subscribers by default. Admin Studio requires an assigned operator role such as administrator, editor, chart editor, registry editor, reviewer, or support.
            </p>
          </div>

          <WkSurface className="p-6 sm:p-8">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-wk-brand text-wk-brand-on">
                <WkIcon name={mode === "forgot" ? "Mail" : mode === "magic" ? "Mail" : "LockKeyhole"} size={26} />
              </div>
              <h2 className="text-[22px] font-black tracking-tight text-wk-text">
                {mode === "forgot" ? "Reset admin password" : mode === "magic" ? "Send admin magic link" : "Admin login"}
              </h2>
              <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
                {mode === "forgot" ? "We will email a secure password reset link." : mode === "magic" ? "Use a one-time email link to sign in without a password." : "Use an account with an active WAKILISHA admin/operator role."}
              </p>
            </div>

            {mode === "checking" && (
              <div className="rounded-xl border border-wk-border bg-wk-surface-raised p-4 text-center text-[13px] text-wk-text-muted">Checking current session…</div>
            )}

            {error && <div className="mb-4 rounded-xl border border-wk-danger/30 bg-wk-danger-soft p-3 text-[12px] text-wk-danger">{error}</div>}
            {success && <div className="mb-4 rounded-xl border border-wk-success/30 bg-wk-success-soft p-3 text-[12px] text-wk-success">{success}</div>}

            {mode === "denied" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-wk-warning/30 bg-wk-warning-soft p-4">
                  <div className="flex items-start gap-3">
                    <WkIcon name="CircleAlert" size={18} className="mt-0.5 text-wk-warning" />
                    <div>
                      <div className="text-[13px] font-bold text-wk-text">This account is not an admin account</div>
                      <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">{deniedEmail || "This user"} is signed in but does not have an admin-capable role. Public accounts default to subscriber and cannot enter Admin Studio.</p>
                    </div>
                  </div>
                </div>
                <button onClick={signOutAndRetry} disabled={loading} className="wk-button wk-button-primary w-full">{loading ? "Signing out…" : "Sign out and try another admin account"}</button>
                <button onClick={signOutAndPublic} disabled={loading} className="wk-button wk-button-ghost w-full">Continue to public account login</button>
              </div>
            )}

            {mode === "forgot" && (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-black uppercase tracking-wider text-wk-text-faint">Admin email</span>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" className="wk-input w-full" placeholder="admin@wakilisha.africa" />
                </label>
                <button type="submit" disabled={loading} className="wk-button wk-button-primary w-full">{loading ? "Sending…" : "Send password reset"}</button>
                <button type="button" onClick={backToSignin} className="wk-button wk-button-ghost w-full">Back to admin login</button>
              </form>
            )}

            {mode === "magic" && (
              <form onSubmit={handleMagicLink} className="space-y-4">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-black uppercase tracking-wider text-wk-text-faint">Admin email</span>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" className="wk-input w-full" placeholder="admin@wakilisha.africa" />
                </label>
                <button type="submit" disabled={loading} className="wk-button wk-button-primary w-full">{loading ? "Sending…" : "Send magic link"}</button>
                <button type="button" onClick={backToSignin} className="wk-button wk-button-ghost w-full">Back to admin login</button>
              </form>
            )}

            {mode === "signin" && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-black uppercase tracking-wider text-wk-text-faint">Admin email</span>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" className="wk-input w-full" placeholder="admin@wakilisha.africa" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-black uppercase tracking-wider text-wk-text-faint">Password</span>
                  <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required autoComplete="current-password" className="wk-input w-full" placeholder="••••••••" />
                </label>
                <div className="flex items-center justify-between gap-3">
                  <button type="button" onClick={() => { clearMessages(); setMode("forgot"); }} className="text-[12px] font-bold text-wk-text-muted hover:text-wk-brand">Forgot password?</button>
                  <button type="button" onClick={() => { clearMessages(); setMode("magic"); }} className="text-[12px] font-bold text-wk-text-muted hover:text-wk-brand">Use magic link</button>
                </div>
                <button type="submit" disabled={loading} className="wk-button wk-button-primary w-full">{loading ? "Checking access…" : "Enter Admin Studio"}</button>
                <button type="button" onClick={handleGoogle} disabled={loading} className="wk-button wk-button-ghost w-full">
                  <WkIcon name="Chrome" size={16} /> Continue with Google
                </button>
                <div className="border-t border-wk-border pt-4 text-center">
                  <button type="button" onClick={() => navigate("/auth")} className="text-[12px] font-bold text-wk-text-muted hover:text-wk-brand">Looking for public login?</button>
                </div>
              </form>
            )}
          </WkSurface>
        </div>
      </div>
    </div>
  );
}
