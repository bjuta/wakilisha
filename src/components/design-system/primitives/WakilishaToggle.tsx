import type { FC } from "react";

interface WakilishaToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
  size?: "sm" | "md";
  disabled?: boolean;
  ariaLabel?: string;
}

/** Accessible 44px action target with a compact Workbook v4 pill track. */
export const WakilishaToggle: FC<WakilishaToggleProps> = ({
  value, onChange, size = "md", disabled = false, ariaLabel = "Toggle setting",
}) => {
  const compact = size === "sm";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={ariaLabel}
      onClick={() => onChange(!value)}
      disabled={disabled}
      className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-wk-brand disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span
        aria-hidden="true"
        className={`relative block shrink-0 rounded-full transition-colors duration-200 motion-reduce:transition-none ${compact ? "h-[22px] w-[36px]" : "h-[26px] w-[44px]"} ${value ? "bg-wk-brand" : "bg-wk-border-strong"}`}
      >
        <span
          className={`absolute top-[2px] left-[2px] block rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none ${compact ? "h-[18px] w-[18px]" : "h-[22px] w-[22px]"} ${value ? (compact ? "translate-x-[14px]" : "translate-x-[18px]") : "translate-x-0"}`}
        />
      </span>
    </button>
  );
};

export default WakilishaToggle;
