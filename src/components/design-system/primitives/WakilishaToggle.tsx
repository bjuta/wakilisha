import React from "react";

interface WakilishaToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
  size?: "sm" | "md";
  disabled?: boolean;
}

const SIZES = {
  sm: {
    track: "w-[36px] h-[22px]",
    knob: "w-[18px] h-[18px]",
    icon: "text-[10px]",
    offset: "translate-x-[14px]",
    pad: "top-[2px] left-[2px]",
  },
  md: {
    track: "w-[44px] h-[26px]",
    knob: "w-[22px] h-[22px]",
    icon: "text-[12px]",
    offset: "translate-x-[18px]",
    pad: "top-[2px] left-[2px]",
  },
};

export const WakilishaToggle: React.FC<WakilishaToggleProps> = ({
  value,
  onChange,
  size = "md",
  disabled = false,
}) => {
  const s = SIZES[size];

  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      disabled={disabled}
      aria-pressed={value}
      className={`
        ${s.track}
        relative rounded-full shrink-0 cursor-pointer
        transition-all duration-200 ease-out
        disabled:opacity-40 disabled:cursor-not-allowed
        ${value
          ? "bg-[var(--wk-brand)] shadow-[inset_0_1px_3px_rgba(0,0,0,0.15)]"
          : "bg-[var(--wk-border-2)] shadow-[inset_0_1px_3px_rgba(0,0,0,0.08)]"
        }
      `}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {/* Knob */}
      <span
        className={`
          absolute ${s.pad}
          ${s.knob}
          rounded-full
          flex items-center justify-center
          transition-all duration-200 ease-out
          ${value
            ? `${s.offset} bg-[var(--wk-surface)] shadow-[0_2px_6px_rgba(0,0,0,0.25),0_1px_2px_rgba(0,0,0,0.15)]`
            : "translate-x-0 bg-[var(--wk-bg)] shadow-[0_2px_5px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.08)]"
          }
        `}
      >
        {/* Bolt icon */}
        <i
          className={`
            ri-flashlight-line ${s.icon}
            transition-colors duration-200
            ${value ? "text-[var(--wk-brand)]" : "text-[var(--wk-text-muted)]/40"}
          `}
        />
      </span>
    </button>
  );
};

export default WakilishaToggle;