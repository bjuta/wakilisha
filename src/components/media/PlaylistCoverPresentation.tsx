import {
  Ch19GradientImage,
} from "@/components/media/Ch19GradientImage";

export function PlaylistCoverPresentation({
  src,
  altText,
  slug,
  title,
  caption,
  loading,
  imageClassName = "",
}: {
  src: string | null;
  altText: string | null;
  slug: string;
  title: string;
  caption?: string | null;
  loading?: "eager" | "lazy";
  imageClassName?: string;
}) {
  if (!src) {
    return (
      <Ch19GradientImage
        slug={slug}
        name={title}
      />
    );
  }

  const subjectLabel =
    caption?.trim() || null;

  return (
    <div
      className="relative isolate h-full w-full overflow-hidden"
      style={{
        containerType:
          "inline-size",
      }}
    >
      <img
        src={src}
        alt={
          altText?.trim() ||
          title
        }
        loading={loading}
        className={[
          "relative z-0 h-full w-full object-cover",
          imageClassName,
        ].join(" ")}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute z-10 left-[7.5%] top-[7.5%] w-[61%] text-[#0C0D0A]"
      >
        <div
          className="font-black tracking-[-0.055em]"
          style={{
            fontSize:
              "clamp(14px, 9.5cqw, 48px)",
            lineHeight:
              0.88,
            overflowWrap:
              "break-word",
          }}
        >
          {title}
        </div>

        {
          subjectLabel
            ? (
                <div
                  className="mt-[5cqw] font-medium italic tracking-[0.01em]"
                  style={{
                    fontSize:
                      "clamp(5px, 1.7cqw, 8px)",
                    lineHeight:
                      1.2,
                    opacity:
                      0.62,
                  }}
                >
                  {subjectLabel}
                </div>
              )
            : null
        }
      </div>
    </div>
  );
}
