import {
  forwardRef,
  useState,
  type ImgHTMLAttributes,
  type ReactEventHandler,
} from "react";
import {
  getResponsiveImageDefinition,
  type ResponsiveImagePreset,
} from "@/lib/responsiveMedia";

type ResponsiveMediaImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "srcSet" | "sizes"
> & {
  src: string;
  preset?: ResponsiveImagePreset;
};

export const ResponsiveMediaImage =
  forwardRef<HTMLImageElement, ResponsiveMediaImageProps>(
    function ResponsiveMediaImage(
      {
        src,
        preset = "card",
        onError,
        ...imageProps
      },
      ref,
    ) {
      const [failedSource, setFailedSource] =
        useState<string | null>(null);

      const definition = getResponsiveImageDefinition(
        src,
        preset,
      );

      const useOptimizedSource =
        definition.optimized &&
        failedSource !== src;

      const handleError: ReactEventHandler<
        HTMLImageElement
      > = (event) => {
        if (useOptimizedSource) {
          setFailedSource(src);
        }

        onError?.(event);
      };

      return (
        <img
          ref={ref}
          {...imageProps}
          src={
            useOptimizedSource
              ? definition.src
              : src
          }
          srcSet={
            useOptimizedSource
              ? definition.srcSet
              : undefined
          }
          sizes={
            useOptimizedSource
              ? definition.sizes
              : undefined
          }
          data-wakilisha-responsive-image={
            useOptimizedSource
              ? preset
              : undefined
          }
          onError={handleError}
        />
      );
    },
  );

ResponsiveMediaImage.displayName =
  "ResponsiveMediaImage";
