import { ArrowUp, ArrowDown } from "lucide-react";
import { WkSurface } from "@/components/design-system/primitives/Surface";

interface KpiCardProps {
  label: string;
  value: string;
  trend: string;
  positive: boolean;
}

export function KpiCard({ label, value, trend, positive }: KpiCardProps) {
  return (
    <WkSurface className="p-4 relative overflow-hidden">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-wk-text-muted">{label}</p>
      <p className="mt-1 text-[26px] font-black text-wk-text">{value}</p>
      <span className={`mt-1 inline-block text-[11px] font-semibold ${positive ? "text-wk-success" : "text-wk-warning"}`}>
        {positive ? <ArrowUp size={12} className="mr-0.5 inline" /> : <ArrowDown size={12} className="mr-0.5 inline" />}
        {trend}
      </span>
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${positive ? "bg-wk-success" : "bg-wk-warning"}`} />
    </WkSurface>
  );
}