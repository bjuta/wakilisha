import { ch19Background, ch19Name, type Ch19Identity } from "@/utils/ch19";

type Chapter19FallbackImageProps = Ch19Identity & {
  className?: string;
};

export function Chapter19FallbackImage({ className = "", ...identity }: Chapter19FallbackImageProps) {
  return (
    <div
      className={`flex h-full w-full items-end p-[14px] ${className}`}
      style={{ background: ch19Background(identity) }}
      role="img"
      aria-label={`${ch19Name(identity)} placeholder image`}
    >
      <span className="font-[var(--wk-font-display)] text-[18px] font-extrabold leading-none tracking-[-0.025em] text-white">
        {ch19Name(identity)}
      </span>
    </div>
  );
}
