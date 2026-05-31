import { AppLayout } from "@/components/layout/AppLayout";
import { MobileAppLayout } from "@/components/mobile/MobileAppLayout";
import { useMobileDetect } from "@/hooks/useMobileDetect";

export function ResponsiveAppLayout() {
  const isMobile = useMobileDetect();
  return isMobile ? <MobileAppLayout /> : <AppLayout />;
}