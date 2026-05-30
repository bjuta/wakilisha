import { useMobileDetect } from "@/hooks/useMobileDetect";

export function ResponsivePage({ mobile, desktop }: { mobile: React.ReactNode; desktop: React.ReactNode }) {
  const isMobile = useMobileDetect();
  return isMobile ? <>{mobile}</> : <>{desktop}</>;
}