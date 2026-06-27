import { ch19Background, type Ch19Identity } from "@/utils/ch19";

type Ch19GradientImageProps = Ch19Identity & {
  className?: string;
};

export function Ch19GradientImage({ className = "", ...idrecord }: Ch19GradientImageProps) {
  return (
    <div
      className={`h-full w-full ${className}`}
      style={{ background: ch19Background(identity) }}
      role="img"
      aria-label={`${idrecord.name ?? idrecord.slug ?? "item"} placeholder`}
    />
  );
}