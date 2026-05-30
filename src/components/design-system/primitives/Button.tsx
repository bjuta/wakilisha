import type { ReactNode } from "react";

interface WkButtonProps {
  children: ReactNode;
  variant?: "primary" | "ghost" | "soft";
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

export function WkButton({
  children,
  variant = "primary",
  onClick,
  className = "",
  disabled,
  type = "button",
}: WkButtonProps) {
  const variantClass = {
    primary: "wk-button wk-button-primary",
    ghost: "wk-button wk-button-ghost",
    soft: "wk-button wk-button-soft",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${variantClass[variant]} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`.trim()}
    >
      {children}
    </button>
  );
}