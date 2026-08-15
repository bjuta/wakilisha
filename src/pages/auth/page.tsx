import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { WkIcon } from "@/components/design-system/Icon";
import { resendVerificationEmail } from "@/services/auth/accountVerification";
import {
  getRegistryOnboardingArtists,
  type RegistryOnboardingArtist,
} from "@/services/community";

function AuthMobileTextClearing({
  children,
  className = "",
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={`relative isolate ${interactive ? "" : "pointer-events-none"} ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-5 -inset-y-4 -z-10 lg:hidden"
        style={{
          background:
            "radial-gradient(ellipse at center, color-mix(in srgb, var(--wk-bg) 98%, transparent) 0%, color-mix(in srgb, var(--wk-bg) 90%, transparent) 42%, color-mix(in srgb, var(--wk-bg) 58%, transparent) 64%, transparent 82%)",
          filter: "blur(7px)",
        }}
      />
      {children}
    </div>
  );
}

type Choice = "charts" | "artists" | "magazine";
type AuthMode = "signin" | "signup" | "forgot" | "magic" | "verify";

const CHOICE_ROUTES: Record<Choice, string> = {
  charts: "/charts",
  artists: "/artists",
  magazine: "/magazine",
};


type AuthArtistFieldSlot = {
  left: number;
  top: number;
  size: number;
  driftX: number;
  driftY: number;
  cycleEvery: number;
  cycleOffset: number;
};

const AUTH_ARTIST_FIELD_SLOTS: AuthArtistFieldSlot[] = [
  { left: 8, top: 14, size: 58, driftX: 5, driftY: -4, cycleEvery: 3, cycleOffset: 0 },
  { left: 27, top: 8, size: 78, driftX: -6, driftY: 5, cycleEvery: 4, cycleOffset: 1 },
  { left: 48, top: 17, size: 54, driftX: 7, driftY: 4, cycleEvery: 3, cycleOffset: 2 },
  { left: 69, top: 7, size: 68, driftX: -5, driftY: -5, cycleEvery: 4, cycleOffset: 0 },
  { left: 89, top: 18, size: 56, driftX: 6, driftY: 4, cycleEvery: 3, cycleOffset: 1 },
  { left: 15, top: 38, size: 72, driftX: -7, driftY: 5, cycleEvery: 4, cycleOffset: 2 },
  { left: 38, top: 34, size: 58, driftX: 5, driftY: -6, cycleEvery: 3, cycleOffset: 0 },
  { left: 61, top: 40, size: 86, driftX: -5, driftY: 5, cycleEvery: 5, cycleOffset: 3 },
  { left: 84, top: 36, size: 62, driftX: 7, driftY: -4, cycleEvery: 4, cycleOffset: 1 },
  { left: 7, top: 60, size: 52, driftX: 6, driftY: 5, cycleEvery: 3, cycleOffset: 2 },
  { left: 27, top: 62, size: 80, driftX: -6, driftY: -5, cycleEvery: 5, cycleOffset: 1 },
  { left: 51, top: 57, size: 60, driftX: 5, driftY: 6, cycleEvery: 4, cycleOffset: 0 },
  { left: 72, top: 65, size: 74, driftX: -7, driftY: 4, cycleEvery: 3, cycleOffset: 2 },
  { left: 92, top: 59, size: 54, driftX: 5, driftY: -5, cycleEvery: 4, cycleOffset: 3 },
  { left: 15, top: 83, size: 66, driftX: -5, driftY: -4, cycleEvery: 5, cycleOffset: 0 },
  { left: 38, top: 87, size: 54, driftX: 6, driftY: 5, cycleEvery: 3, cycleOffset: 1 },
  { left: 62, top: 83, size: 80, driftX: -6, driftY: -4, cycleEvery: 4, cycleOffset: 2 },
  { left: 87, top: 86, size: 62, driftX: 5, driftY: 5, cycleEvery: 3, cycleOffset: 0 },
];

const AUTH_ARTIST_FIELD_VISIBLE_COUNT = 18;
const AUTH_ARTIST_FIELD_TICK_MS = 5 * 60 * 1000;


const AUTH_MOBILE_ARTIST_FIELD_VISIBLE_COUNT = 24;

const AUTH_MOBILE_ARTIST_FIELD_SLOTS = [
  { left: 50, top: 48, size: 74, travelX: -72, travelY: -58, duration: 42, delay: -7 },
  { left: 43, top: 43, size: 58, travelX: -102, travelY: -30, duration: 48, delay: -31 },
  { left: 57, top: 43, size: 62, travelX: 106, travelY: -34, duration: 44, delay: -18 },
  { left: 36, top: 35, size: 52, travelX: -118, travelY: -84, duration: 56, delay: -43 },
  { left: 64, top: 34, size: 56, travelX: 122, travelY: -82, duration: 46, delay: -12 },
  { left: 50, top: 29, size: 46, travelX: 2, travelY: -122, duration: 60, delay: -49 },
  { left: 29, top: 49, size: 70, travelX: -132, travelY: -2, duration: 50, delay: -23 },
  { left: 71, top: 49, size: 66, travelX: 136, travelY: 4, duration: 43, delay: -36 },
  { left: 33, top: 59, size: 54, travelX: -120, travelY: 76, duration: 52, delay: -15 },
  { left: 67, top: 60, size: 58, travelX: 118, travelY: 82, duration: 47, delay: -41 },
  { left: 50, top: 64, size: 72, travelX: 0, travelY: 118, duration: 58, delay: -28 },
  { left: 43, top: 53, size: 46, travelX: -66, travelY: 44, duration: 40, delay: -9 },
  { left: 57, top: 55, size: 50, travelX: 72, travelY: 52, duration: 49, delay: -34 },
  { left: 25, top: 37, size: 44, travelX: -104, travelY: -78, duration: 62, delay: -52 },
  { left: 75, top: 36, size: 48, travelX: 106, travelY: -80, duration: 45, delay: -21 },
  { left: 25, top: 66, size: 56, travelX: -108, travelY: 94, duration: 54, delay: -38 },
  { left: 77, top: 67, size: 52, travelX: 104, travelY: 98, duration: 51, delay: -6 },
  { left: 39, top: 27, size: 48, travelX: -62, travelY: -106, duration: 57, delay: -46 },
  { left: 61, top: 26, size: 42, travelX: 66, travelY: -108, duration: 50, delay: -26 },
  { left: 37, top: 71, size: 42, travelX: -62, travelY: 104, duration: 55, delay: -17 },
  { left: 63, top: 72, size: 48, travelX: 70, travelY: 106, duration: 46, delay: -33 },
  { left: 50, top: 19, size: 40, travelX: 0, travelY: -114, duration: 64, delay: -56 },
  { left: 19, top: 53, size: 46, travelX: -90, travelY: 10, duration: 48, delay: -39 },
  { left: 81, top: 54, size: 44, travelX: 92, travelY: 18, duration: 53, delay: -14 },
] as const;

type AuthArtistFieldScope =
  | "desktop"
  | "mobile";

type AuthArtistFieldOffset = {
  x: number;
  y: number;
};

type AuthArtistFieldDrag = {
  scope: AuthArtistFieldScope;
  index: number;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
  size: number;
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
  const [
    presentationArtists,
    setPresentationArtists,
  ] = useState<RegistryOnboardingArtist[]>([]);
  const [
    presentationPhase,
    setPresentationPhase,
  ] = useState(0);
  const desktopArtistFieldRef =
    useRef<HTMLDivElement | null>(null);
  const mobileArtistFieldRef =
    useRef<HTMLDivElement | null>(null);
  const [
    desktopArtistOffsets,
    setDesktopArtistOffsets,
  ] = useState<
    Record<number, AuthArtistFieldOffset>
  >({});
  const [
    mobileArtistOffsets,
    setMobileArtistOffsets,
  ] = useState<
    Record<number, AuthArtistFieldOffset>
  >({});
  const [
    artistFieldDrag,
    setArtistFieldDrag,
  ] = useState<AuthArtistFieldDrag | null>(
    null,
  );

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

  useEffect(() => {
    let alive = true;

    getRegistryOnboardingArtists(24)
      .then((opening) => {
        if (!alive) return;

        const uniqueArtists =
          Array.from(
            new Map(
              opening.artists.map(
                (artist) => [
                  artist.targetId,
                  artist,
                ],
              ),
            ).values(),
          ).slice(0, 24);

        setPresentationArtists(
          uniqueArtists,
        );
      })
      .catch(() => {
        if (!alive) return;
        setPresentationArtists([]);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (
      presentationArtists.length === 0
      || typeof window === "undefined"
      || window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches
    ) {
      return;
    }

    const timer =
      window.setInterval(
        () => {
          setPresentationPhase(
            (current) => current + 1,
          );
        },
        AUTH_ARTIST_FIELD_TICK_MS,
      );

    return () => {
      window.clearInterval(timer);
    };
  }, [presentationArtists.length]);

  function getArtistFieldOffset(
    scope: AuthArtistFieldScope,
    index: number,
  ): AuthArtistFieldOffset {
    const offsets =
      scope === "desktop"
        ? desktopArtistOffsets
        : mobileArtistOffsets;

    return offsets[index] ?? {
      x: 0,
      y: 0,
    };
  }

  function updateArtistFieldOffset(
    scope: AuthArtistFieldScope,
    index: number,
    offset: AuthArtistFieldOffset,
  ) {
    const setter =
      scope === "desktop"
        ? setDesktopArtistOffsets
        : setMobileArtistOffsets;

    setter((current) => ({
      ...current,
      [index]: offset,
    }));
  }

  function getArtistFieldContainer(
    scope: AuthArtistFieldScope,
  ) {
    return scope === "desktop"
      ? desktopArtistFieldRef.current
      : mobileArtistFieldRef.current;
  }

  function getArtistFieldSlot(
    scope: AuthArtistFieldScope,
    index: number,
  ) {
    return scope === "desktop"
      ? AUTH_ARTIST_FIELD_SLOTS[index]
      : AUTH_MOBILE_ARTIST_FIELD_SLOTS[
          index
        ];
  }

  function handleArtistFieldPointerDown(
    scope: AuthArtistFieldScope,
    index: number,
    size: number,
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    const currentOffset =
      getArtistFieldOffset(
        scope,
        index,
      );

    event.currentTarget.setPointerCapture(
      event.pointerId,
    );

    setArtistFieldDrag({
      scope,
      index,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: currentOffset.x,
      startOffsetY: currentOffset.y,
      size,
    });
  }

  function handleArtistFieldPointerMove(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (
      !artistFieldDrag
      || artistFieldDrag.pointerId
        !== event.pointerId
    ) {
      return;
    }

    const container =
      getArtistFieldContainer(
        artistFieldDrag.scope,
      );
    const slot =
      getArtistFieldSlot(
        artistFieldDrag.scope,
        artistFieldDrag.index,
      );

    if (!container || !slot) return;

    const rect =
      container.getBoundingClientRect();

    const baseX =
      rect.width * slot.left / 100;
    const baseY =
      rect.height * slot.top / 100;

    const requestedX =
      artistFieldDrag.startOffsetX
      + event.clientX
      - artistFieldDrag.startClientX;
    const requestedY =
      artistFieldDrag.startOffsetY
      + event.clientY
      - artistFieldDrag.startClientY;

    const radius =
      artistFieldDrag.size / 2;

    const minX =
      radius - baseX;
    const maxX =
      rect.width - radius - baseX;
    const minY =
      radius - baseY;
    const maxY =
      rect.height - radius - baseY;

    updateArtistFieldOffset(
      artistFieldDrag.scope,
      artistFieldDrag.index,
      {
        x: Math.min(
          maxX,
          Math.max(
            minX,
            requestedX,
          ),
        ),
        y: Math.min(
          maxY,
          Math.max(
            minY,
            requestedY,
          ),
        ),
      },
    );
  }

  function endArtistFieldDrag(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (
      artistFieldDrag?.pointerId
      !== event.pointerId
    ) {
      return;
    }

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId,
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      );
    }

    setArtistFieldDrag(null);
  }

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

  const mobileArtistField = (
    <div
      aria-hidden="true"
      className="pointer-events-none relative h-[42svh] min-h-[315px] max-h-[430px] shrink-0 overflow-hidden bg-[var(--wk-surface)] lg:hidden"
    >
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          [data-wk-auth-traveler="true"] {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }

        ${AUTH_MOBILE_ARTIST_FIELD_SLOTS.map(
          (slot, index) => `
            @keyframes wk-auth-artist-travel-${index} {
              0% {
                transform: translate3d(${Math.round(slot.travelX * -0.18)}px, ${Math.round(slot.travelY * -0.18)}px, 0) scale(0.82);
                opacity: 0.22;
              }
              14% {
                opacity: 0.94;
              }
              72% {
                opacity: 0.98;
              }
              100% {
                transform: translate3d(${slot.travelX}px, ${slot.travelY}px, 0) scale(1.08);
                opacity: 0.08;
              }
            }
          `,
        ).join("\n")}
      `}</style>
      <div
        ref={mobileArtistFieldRef}
        className="absolute inset-0"
      >
        {presentationArtists.length > 0
          ? AUTH_MOBILE_ARTIST_FIELD_SLOTS
              .slice(
                0,
                Math.min(
                  AUTH_MOBILE_ARTIST_FIELD_VISIBLE_COUNT,
                  presentationArtists.length,
                ),
              )
              .map(
                (slot, index) => {
                  const artistIndex =
                    (
                      index
                      + presentationPhase * 3
                    )
                    % presentationArtists.length;

                  const artist =
                    presentationArtists[
                      artistIndex
                    ];
                  const dragOffset =
                    mobileArtistOffsets[
                      index
                    ] ?? {
                      x: 0,
                      y: 0,
                    };

                  return (
                    <div
                      key={`auth-mobile-field-slot-${index}`}
                      className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none select-none active:cursor-grabbing"
                      style={{
                        left: `${slot.left}%`,
                        top: `${slot.top}%`,
                        transform:
                          `translate(-50%, -50%) translate(${dragOffset.x}px, ${dragOffset.y}px)`,
                      }}
                      onPointerDown={(
                        event,
                      ) =>
                        handleArtistFieldPointerDown(
                          "mobile",
                          index,
                          slot.size,
                          event,
                        )
                      }
                      onPointerMove={
                        handleArtistFieldPointerMove
                      }
                      onPointerUp={
                        endArtistFieldDrag
                      }
                      onPointerCancel={
                        endArtistFieldDrag
                      }
                    >
                      <div
                        data-wk-auth-traveler="true"
                        style={{
                          animation:
                            `wk-auth-artist-travel-${index} ${slot.duration}s cubic-bezier(0.22, 0.61, 0.36, 1) ${slot.delay}s infinite`,
                          animationPlayState:
                            artistFieldDrag?.scope === "mobile"
                            && artistFieldDrag.index === index
                              ? "paused"
                              : "running",
                          willChange:
                            "transform, opacity",
                        }}
                      >
                        <div className="rounded-full bg-[var(--wk-border)] p-[3px] shadow-[0_12px_36px_rgba(0,0,0,0.08)]">
                          <div className="rounded-full bg-[var(--wk-surface)] p-[2px]">
                            <img
                              src={artist.imageUrl}
                              alt=""
                              draggable={false}
                              className="rounded-full object-cover"
                              style={{
                                width: slot.size,
                                height: slot.size,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                },
              )
          : AUTH_MOBILE_ARTIST_FIELD_SLOTS
              .slice(
                0,
                AUTH_MOBILE_ARTIST_FIELD_VISIBLE_COUNT,
              )
              .map(
                (slot, index) => (
                  <div
                    key={`auth-mobile-field-placeholder-${index}`}
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--wk-surface-raised)]"
                    style={{
                      left: `${slot.left}%`,
                      top: `${slot.top}%`,
                      width: slot.size,
                      height: slot.size,
                    }}
                  />
                ))}
      </div>

    <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--wk-bg) 38%, transparent) 46%, var(--wk-bg) 100%)",
        }}
      />
    </div>
  );

  const brandPanel = (
    <section className="hidden lg:flex flex-col justify-between relative overflow-hidden" style={{ width: "46%", background: "var(--wk-surface)" }}>
      <div className="relative z-10 p-10 md:p-14">
        <div className="flex h-14 w-14 items-center justify-center rounded-[20px] text-[22px] font-black mb-6" style={{ background: "var(--wk-brand)", color: "var(--wk-brand-on)", boxShadow: "0 18px 60px rgba(var(--wk-brand-rgb), 0.22)" }}>W</div>
        <div className="font-black tracking-[-.05em]" style={{ fontFamily: "var(--wk-font-display)", fontSize: "clamp(36px, 4vw, 52px)", lineHeight: 0.94, color: "var(--wk-text)" }}>WAKILISHA</div>
      </div>

      <div
        aria-hidden="true"
        className="relative z-10 flex min-h-[360px] flex-1 select-none items-center px-6 md:px-8 xl:px-10"
      >
        <div
          ref={desktopArtistFieldRef}
          className="relative h-[430px] w-full overflow-visible"
        >
          {presentationArtists.length > 0
            ? AUTH_ARTIST_FIELD_SLOTS
                .slice(
                  0,
                  Math.min(
                    AUTH_ARTIST_FIELD_VISIBLE_COUNT,
                    presentationArtists.length,
                  ),
                )
                .map(
                  (slot, index) => {
                    const artistIndex =
                      (
                        index
                        + presentationPhase * 3
                      )
                      % presentationArtists.length;

                    const artist =
                      presentationArtists[
                        artistIndex
                      ];
                    const dragOffset =
                      desktopArtistOffsets[
                        index
                      ] ?? {
                        x: 0,
                        y: 0,
                      };

                    const direction =
                      (
                        presentationPhase
                        + index
                      )
                      % 2 === 0
                        ? 1
                        : -1;

                    const breathing =
                      (
                        presentationPhase
                        + index
                      )
                      % 2 === 0
                        ? 0.9
                        : 1;

                    return (
                      <div
                        key={`auth-field-slot-${index}`}
                        className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none select-none active:cursor-grabbing"
                        style={{
                          left: `${slot.left}%`,
                          top: `${slot.top}%`,
                          opacity: breathing,
                          transform:
                            `translate(-50%, -50%) translate(${dragOffset.x + direction * slot.driftX}px, ${dragOffset.y + direction * slot.driftY}px)`,
                          transition:
                            artistFieldDrag?.scope === "desktop"
                            && artistFieldDrag.index === index
                              ? "opacity 3200ms ease-in-out"
                              : "transform 3600ms ease-in-out, opacity 3200ms ease-in-out",
                        }}
                        onPointerDown={(
                          event,
                        ) =>
                          handleArtistFieldPointerDown(
                            "desktop",
                            index,
                            slot.size,
                            event,
                          )
                        }
                        onPointerMove={
                          handleArtistFieldPointerMove
                        }
                        onPointerUp={
                          endArtistFieldDrag
                        }
                        onPointerCancel={
                          endArtistFieldDrag
                        }
                      >
                        <div className="relative flex flex-col items-center">
                          <div
                            className={`rounded-full p-[3px] transition-all duration-500 group-hover:scale-110 group-hover:bg-[var(--wk-brand)] ${
                              index % 5 === 0
                                ? "bg-[var(--wk-brand)]"
                                : "bg-[var(--wk-border)]"
                            }`}
                            style={{
                              boxShadow:
                                index % 5 === 0
                                  ? "0 0 0 7px rgba(var(--wk-brand-rgb), 0.045)"
                                  : "0 14px 38px rgba(0, 0, 0, 0.08)",
                            }}
                          >
                            <div className="rounded-full bg-[var(--wk-surface)] p-[2px]">
                              <img
                                src={artist.imageUrl}
                                alt=""
                                draggable={false}
                                className="rounded-full object-cover transition-all duration-500 group-hover:brightness-105"
                                style={{
                                  width: slot.size,
                                  height: slot.size,
                                }}
                              />
                            </div>
                          </div>

                          <span
                            className="pointer-events-none absolute top-full mt-2 max-w-[118px] truncate rounded-full bg-[var(--wk-bg)]/88 px-2 py-1 text-[10px] font-bold text-[var(--wk-text-muted)] opacity-100 shadow-sm backdrop-blur-sm transition-all duration-300 group-hover:-translate-y-0.5 group-hover:text-[var(--wk-text)]"
                            style={{
                              fontFamily:
                                "var(--wk-font-ui)",
                            }}
                          >
                            {artist.displayName}
                          </span>
                        </div>
                      </div>
                    );
                  },
                )
            : AUTH_ARTIST_FIELD_SLOTS
                .slice(
                  0,
                  AUTH_ARTIST_FIELD_VISIBLE_COUNT,
                )
                .map(
                  (slot, index) => (
                    <div
                      key={`auth-field-placeholder-${index}`}
                      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--wk-surface-raised)]"
                      style={{
                        left: `${slot.left}%`,
                        top: `${slot.top}%`,
                        width: slot.size,
                        height: slot.size,
                        opacity:
                          0.36
                          + (
                            index % 3
                          ) * 0.1,
                      }}
                    />
                  ),
                )}
        </div>
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
    <main className="relative flex min-h-screen flex-col overflow-x-hidden lg:flex-row" style={{ background: "var(--wk-bg)" }}>
      {mobileArtistField}
      {brandPanel}
      <section className="relative z-10 flex flex-1 flex-col justify-start bg-[var(--wk-bg)] px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-8 sm:px-10 sm:py-12 md:px-16 lg:justify-center lg:bg-transparent lg:px-20 lg:py-16">
        <div className="relative w-full max-w-[420px] mx-auto px-1 py-5 sm:px-2 sm:py-7 lg:max-w-[400px] lg:px-0 lg:py-0">
          <AuthMobileTextClearing className="lg:hidden mb-10 w-fit">
            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] text-[18px] font-black mb-5" style={{ background: "var(--wk-brand)", color: "var(--wk-brand-on)", boxShadow: "0 14px 40px rgba(var(--wk-brand-rgb), 0.18)" }}>W</div>
            <div className="font-black tracking-[-.05em] text-[28px]" style={{ fontFamily: "var(--wk-font-display)", color: "var(--wk-text)" }}>WAKILISHA</div>
          </AuthMobileTextClearing>

          <AuthMobileTextClearing className="mb-8">
            <h1 className="font-black tracking-[-.03em] mb-1" style={{ fontFamily: "var(--wk-font-display)", fontSize: "clamp(26px, 2.5vw, 34px)", lineHeight: 1.1, color: "var(--wk-text)" }}>{heading}</h1>
            <p className="leading-relaxed" style={{ fontFamily: "var(--wk-font-body)", fontSize: "14px", color: "var(--wk-text-muted)" }}>{subcopy}</p>
          </AuthMobileTextClearing>

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
              <AuthMobileTextClearing interactive>
                <div className="flex items-center justify-between gap-3 px-1">
                  <button type="button" onClick={() => goToMode("forgot")} className="text-[12px] font-bold hover:opacity-80" style={{ color: "var(--wk-text-muted)", fontFamily: "var(--wk-font-ui)" }}>Forgot password?</button>
                  <button type="button" onClick={() => goToMode("magic")} className="text-[12px] font-bold hover:opacity-80" style={{ color: "var(--wk-text-muted)", fontFamily: "var(--wk-font-ui)" }}>Use magic link</button>
                </div>
              </AuthMobileTextClearing>
              <button type="submit" disabled={loading} className="w-full h-[52px] rounded-[14px] flex items-center justify-center gap-3 font-bold text-[14px] whitespace-nowrap transition-all duration-200 cursor-pointer hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: "var(--wk-brand)", color: "var(--wk-brand-on)", fontFamily: "var(--wk-font-ui)" }}>{loading ? (mode === "signin" ? "Signing in..." : "Creating account...") : mode === "signin" ? <><WkIcon name="LogIn" size={17} /> Sign in with email</> : <><WkIcon name="UserPlus" size={17} /> Create account</>}</button>
              <button type="button" onClick={() => { setShowEmailForm(false); clearMessages(); }} className="w-full h-[44px] rounded-[14px] flex items-center justify-center gap-2 font-semibold text-[13px] whitespace-nowrap transition-all duration-200 cursor-pointer hover:opacity-80 active:scale-[0.98]" style={{ background: "transparent", color: "var(--wk-text-muted)", fontFamily: "var(--wk-font-ui)" }}><WkIcon name="ArrowLeft" size={15} /> Back</button>
            </form>
          ) : (
            <div className="flex flex-col gap-3 mb-6">
              <button onClick={() => setShowEmailForm(true)} disabled={loading} className="w-full h-[52px] rounded-[14px] flex items-center justify-center gap-3 font-bold text-[14px] whitespace-nowrap transition-all duration-200 cursor-pointer hover:opacity-90 active:scale-[0.98]" style={{ background: "var(--wk-brand)", color: "var(--wk-brand-on)", fontFamily: "var(--wk-font-ui)" }}><WkIcon name="Mail" size={17} />Continue with email</button>
              <button onClick={() => goToMode("magic")} disabled={loading} className="w-full h-[52px] rounded-[14px] flex items-center justify-center gap-3 font-bold text-[14px] whitespace-nowrap transition-all duration-200 cursor-pointer hover:opacity-90 active:scale-[0.98]" style={{ background: "var(--wk-surface-raised)", border: "1px solid var(--wk-border)", color: "var(--wk-text)", fontFamily: "var(--wk-font-ui)" }}><WkIcon name="MailCheck" size={17} />Email me a magic link</button>
              <button onClick={handleGoogleAuth} disabled={loading} className="w-full h-[52px] rounded-[14px] flex items-center justify-center gap-3 font-bold text-[14px] whitespace-nowrap transition-all duration-200 cursor-pointer hover:opacity-90 active:scale-[0.98] disabled:opacity-50" style={{ background: "var(--wk-surface-raised)", border: "1px solid var(--wk-border)", color: "var(--wk-text)", fontFamily: "var(--wk-font-ui)" }}>{loading ? "Loading..." : <><WkIcon name="Chrome" size={17} />Continue with Google</>}</button>
              <div className="flex items-center gap-3 my-1">
                <span className="flex-1 h-px" style={{ background: "var(--wk-divider)" }} />
                <span className="relative z-10 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ fontFamily: "var(--wk-font-ui)", color: "var(--wk-text-faint)", background: "color-mix(in srgb, var(--wk-bg) 88%, transparent)" }}>or</span>
                <span className="flex-1 h-px" style={{ background: "var(--wk-divider)" }} />
              </div>
              <AuthMobileTextClearing interactive>
                <Link to="/" className="w-full h-[52px] rounded-[14px] flex items-center justify-center gap-3 font-bold text-[14px] whitespace-nowrap transition-all duration-200 cursor-pointer hover:opacity-80 active:scale-[0.98] no-underline" style={{ background: "transparent", color: "var(--wk-text-muted)", fontFamily: "var(--wk-font-ui)" }}>Explore without signing in</Link>
              </AuthMobileTextClearing>
            </div>
          )}

          <AuthMobileTextClearing interactive className="mt-1">
            {!isRecovery && !["forgot", "magic", "verify"].includes(mode) && <button onClick={toggleMode} className="w-full text-center mb-4 text-[13px] font-semibold cursor-pointer hover:opacity-80 transition-opacity" style={{ fontFamily: "var(--wk-font-ui)", color: "var(--wk-brand)" }}>{mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}</button>}
            <p className="text-center leading-relaxed" style={{ fontFamily: "var(--wk-font-ui)", fontSize: "11px", color: "var(--wk-text-faint)" }}>By continuing, you agree to WAKILISHA's <a href="#" className="font-semibold hover:underline" style={{ color: "var(--wk-brand)" }}>Terms</a> and <a href="#" className="font-semibold hover:underline" style={{ color: "var(--wk-brand)" }}>Privacy Policy</a>.</p>
          </AuthMobileTextClearing>
        </div>
      </section>
    </main>
  );
}
