import { supabase } from "@/lib/supabase";

function currentReturnTo(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}` || "/";
}

export function getSafeReturnTo(raw?: string | null): string {
  if (!raw) return currentReturnTo();

  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const url = new URL(raw);
      if (typeof window !== "undefined" && url.origin !== window.location.origin) return "/";
      return `${url.pathname}${url.search}${url.hash}` || "/";
    }

    if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/auth")) return "/";
    return raw;
  } catch {
    return "/";
  }
}

export function buildVerifyEmailUrl(returnTo = currentReturnTo(), email?: string | null): string {
  if (typeof window === "undefined") return "/auth?mode=verify";

  const url = new URL("/auth", window.location.origin);
  url.searchParams.set("mode", "verify");
  url.searchParams.set("returnTo", getSafeReturnTo(returnTo));
  if (email) url.searchParams.set("email", email);

  return `${url.pathname}${url.search}`;
}

export async function resendVerificationEmail(email: string, returnTo = currentReturnTo()): Promise<void> {
  const safeEmail = email.trim().toLowerCase();
  if (!safeEmail) throw new Error("Enter your email address.");

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: safeEmail,
    options: {
      emailRedirectTo: `${window.location.origin}${getSafeReturnTo(returnTo)}`,
    },
  });

  if (error) throw error;
}
