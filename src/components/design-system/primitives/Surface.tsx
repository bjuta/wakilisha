import type {
  ComponentPropsWithoutRef,
  ReactNode,
} from "react";

interface WkSurfaceProps
  extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode;
}

export function WkSurface({
  children,
  className = "",
  onClick,
  ...divProps
}: WkSurfaceProps) {
  return (
    <div
      {...divProps}
      onClick={onClick}
      className={`wk-panel ${className} ${
        onClick ? "cursor-pointer" : ""
      }`.trim()}
    >
      {children}
    </div>
  );
}
