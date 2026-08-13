import { AppLayout } from "@/components/layout/AppLayout";
import { MobileAppLayout } from "@/components/mobile/MobileAppLayout";
import { useMobileDetect } from "@/hooks/useMobileDetect";
import { RegistryOnboardingGate } from "@/components/auth/RegistryOnboardingGate";

export function ResponsiveAppLayout() {
  const isMobile = useMobileDetect();
  const layout = isMobile ? <MobileAppLayout /> : <AppLayout />;

  return (
    <RegistryOnboardingGate>
      {layout}
    </RegistryOnboardingGate>
  );
}