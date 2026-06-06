import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"checking" | "ready" | "done" | "error">("checking");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    async function checkRecoverySession() {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const type = hash.get("type");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      if (type === "recovery" && accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        window.history.replaceState({}, document.title, window.location.pathname);
        if (!alive) return;
        if (error) {
          setStatus("error");
          setMessage(error.message);
          return;
        }
        setStatus("ready");
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      if (data.session) setStatus("ready");
      else {
        setStatus("error");
        setMessage("This password reset link is missing or expired. Request a new reset email.");
      }
    }
    checkRecoverySession();
    return () => { alive = false; };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (password.length < 8) {
      setStatus("error");
      setMessage("Use at least 8 characters for your new password.");
      return;
    }
    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("The two passwords do not match.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("done");
    setMessage("Password updated. You can now sign in with your new password.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-wk-bg px-4 py-12 text-wk-text">
      <WkSurface className="w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-wk-brand text-wk-brand-on">
            <WkIcon name="LockKeyhole" size={26} />
          </div>
          <h1 className="text-[24px] font-black tracking-tight">Reset your password</h1>
          <p className="mt-2 text-[13px] leading-6 text-wk-text-muted">Enter a new password for your WAKILISHA account.</p>
        </div>

        {status === "checking" && (
          <div className="rounded-xl border border-wk-border bg-wk-surface-raised p-4 text-center text-[13px] text-wk-text-muted">Checking reset link…</div>
        )}

        {message && (
          <div className={`mb-4 rounded-xl border p-3 text-[13px] ${status === "done" ? "border-wk-success/30 bg-wk-success-soft text-wk-success" : "border-wk-danger/30 bg-wk-danger-soft text-wk-danger"}`}>
            {message}
          </div>
        )}

        {status === "ready" || status === "error" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-[11px] font-black uppercase tracking-wider text-wk-text-faint">New password</span>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" className="wk-input w-full" placeholder="At least 8 characters" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-black uppercase tracking-wider text-wk-text-faint">Confirm password</span>
              <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" autoComplete="new-password" className="wk-input w-full" placeholder="Repeat new password" />
            </label>
            <button type="submit" disabled={loading || status === "checking"} className="wk-button wk-button-primary w-full">
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        ) : null}

        {status === "done" && (
          <div className="space-y-3">
            <button onClick={() => navigate("/admin/login")} className="wk-button wk-button-primary w-full">Go to admin login</button>
            <button onClick={() => navigate("/auth")} className="wk-button wk-button-ghost w-full">Go to public login</button>
          </div>
        )}

        {status !== "done" && (
          <button onClick={() => navigate("/auth")} className="wk-button wk-button-ghost mt-4 w-full">Back to login</button>
        )}
      </WkSurface>
    </main>
  );
}
