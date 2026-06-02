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
      <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground-500">{label}</p>
      <p className="mt-1 text-[26px] font-black text-foreground-950">{value}</p>
      <span className={`mt-1 inline-block text-[11px] font-semibold ${positive ? "text-green-600" : "text-amber-600"}`}>
        {positive ? <i className="ri-arrow-up-line mr-0.5" /> : <i className="ri-arrow-down-line mr-0.5" />}
        {trend}
      </span>
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${positive ? "bg-green-400" : "bg-amber-400"}`} />
    </WkSurface>
  );
}