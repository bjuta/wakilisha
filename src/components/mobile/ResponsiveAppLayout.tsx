import { useMobileDetect } from "@/hooks/useMobileDetect";
import { AppLayout } from "@/components/layout/AppLayout";
import { MobileAppLayout } from "@/components/mobile/MobileAppLayout";

export function ResponsiveAppLayout() {
  const isMobile = useMobileDetect();
  return isMobile ? <MobileAppLayout /> : <AppLayout />;
}