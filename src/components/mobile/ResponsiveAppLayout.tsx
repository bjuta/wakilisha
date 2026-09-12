import { lazy, Suspense } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MobileAppLayout } from "@/components/mobile/MobileAppLayout";
import {
  PlayerCompactSurface,
} from "@/components/design-system/player/PlayerCompactSurface";
import "@/components/design-system/player/playerChrome.css";
import { usePlayer } from "@/context/PlayerContext";
import { useMobileDetect } from "@/hooks/useMobileDetect";
import { RegistryOnboardingGate } from "@/components/auth/RegistryOnboardingGate";

const LazyPlayerFullSurface = lazy(async () => {
  const module = await import(
    "@/components/design-system/player/PlayerFullSurface"
  );

  return {
    default: module.PlayerFullSurface,
  };
});

export function ResponsiveAppLayout() {
  const isMobile = useMobileDetect();
  const {
    isFullPlayerOpen,
  } = usePlayer();

  const baseLayout = isMobile ? (
    <>
      <MobileAppLayout />
      <PlayerCompactSurface mode="mobile" />
    </>
  ) : (
    <AppLayout />
  );

  const layout = isFullPlayerOpen ? (
    <Suspense fallback={baseLayout}>
      <LazyPlayerFullSurface
        mode={
          isMobile
            ? "mobile"
            : "desktop"
        }
      />
    </Suspense>
  ) : (
    baseLayout
  );

  return (
    <RegistryOnboardingGate>
      {layout}
    </RegistryOnboardingGate>
  );
}
