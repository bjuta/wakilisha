import { AppLayout } from "@/components/layout/AppLayout";
import { MobileAppLayout } from "@/components/mobile/MobileAppLayout";
import {
  PlayerCompactSurface,
} from "@/components/design-system/player/PlayerCompactSurface";
import {
  PlayerFullSurface,
} from "@/components/design-system/player/PlayerFullSurface";
import "@/components/design-system/player/playerChrome.css";
import { usePlayer } from "@/context/PlayerContext";
import { useMobileDetect } from "@/hooks/useMobileDetect";
import { RegistryOnboardingGate } from "@/components/auth/RegistryOnboardingGate";

export function ResponsiveAppLayout() {
  const isMobile = useMobileDetect();
  const {
    isFullPlayerOpen,
  } = usePlayer();

  let layout;

  if (isFullPlayerOpen) {
    layout = (
      <PlayerFullSurface
        mode={
          isMobile
            ? "mobile"
            : "desktop"
        }
      />
    );
  } else if (isMobile) {
    layout = (
      <>
        <MobileAppLayout />
        <PlayerCompactSurface mode="mobile" />
      </>
    );
  } else {
    layout = <AppLayout />;
  }

  return (
    <RegistryOnboardingGate>
      {layout}
    </RegistryOnboardingGate>
  );
}
