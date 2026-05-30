import type { ReactNode } from "react";

interface WkTagProps {
  children: ReactNode;
  variant?: "default" | "brand";
  onClick?: () => void;
  className?: string;
}

export function WkTag({
  children,
  variant = "default",
  onClick,
  className = "",
}: WkTagProps) {
  const base = "wk-tag";
  const variantClass =
    variant === "brand" ? "wk-tag-brand" : "bg-[var(--wk-surface)] border-[var(--wk-border-2)] text-[var(--wk-text-soft)]";

  return (
    <span
      onClick={onClick}
      className={`${base} ${variantClass} ${onClick ? "cursor-pointer" : ""} ${className}`.trim()}
    >
      {children}
    </span>
  );
}