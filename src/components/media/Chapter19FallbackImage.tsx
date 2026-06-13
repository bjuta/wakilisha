import { ch19Background, type Ch19Identity } from "@/utils/ch19";

type Chapter19FallbackImageProps = Ch19Identity & {
  className?: string;
};

export function Chapter19FallbackImage({ className = "", ...identity }: Chapter19FallbackImageProps) {
  return (
    <div
      className={`h-full w-full ${className}`}
      style={{ background: ch19Background(identity) }}
      role="img"
      aria-label="placeholder image"
    />
  );
}