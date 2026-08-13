import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  Navigate,
  useLocation,
} from "react-router-dom";
import { useAuthUser } from "@/hooks/useAuthUser";
import {
  getRegistryOnboardingState,
} from "@/services/community/registryOnboarding";

type GateState =
  | "clear"
  | "checking"
  | "onboarding";

export function RegistryOnboardingGate({
  children,
}: {
  children: ReactNode;
}) {
  const authUser = useAuthUser();
  const location = useLocation();
  const onAuthPage =
    location.pathname === "/auth";
  const [gate, setGate] =
    useState<GateState>("clear");

  useEffect(() => {
    let alive = true;

    if (
      authUser.loading
      || onAuthPage
    ) {
      return () => {
        alive = false;
      };
    }

    if (!authUser.id) {
      setGate("clear");
      return () => {
        alive = false;
      };
    }

    setGate("checking");

    getRegistryOnboardingState()
      .then((state) => {
        if (!alive) {
          return;
        }

        setGate(
          state.status === "not_started"
            ? "onboarding"
            : "clear",
        );
      })
      .catch((error) => {
        console.warn(
          "Could not check onboarding state:",
          error,
        );

        if (alive) {
          setGate("clear");
        }
      });

    return () => {
      alive = false;
    };
  }, [
    authUser.id,
    authUser.loading,
    onAuthPage,
  ]);

  if (
    !authUser.loading
    && authUser.id
    && gate === "checking"
    && !onAuthPage
  ) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--wk-bg)] text-[var(--wk-text)]">
        <div className="text-[18px] font-black tracking-[-0.04em]">
          WAKILISHA
          <span className="text-[var(--wk-brand)]">
            .
          </span>
        </div>
      </div>
    );
  }

  if (
    !authUser.loading
    && authUser.id
    && gate === "onboarding"
    && !onAuthPage
  ) {
    return (
      <Navigate
        to="/start"
        replace
      />
    );
  }

  return children;
}
