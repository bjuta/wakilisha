import type { ReactNode } from "react";

interface WkSurfaceProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function WkSurface({ children, className = "", onClick }: WkSurfaceProps) {
  return (
    <div
      onClick={onClick}
      className={`wk-panel ${className} ${onClick ? "cursor-pointer" : ""}`.trim()}
    >
      {children}
    </div>
  );
}