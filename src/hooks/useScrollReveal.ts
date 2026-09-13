import { useEffect, useRef, useState } from "react";

export function useScrollReveal<T extends HTMLElement>(threshold = 0.1) {
  const ref = useRef<T>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, revealed };
}

export interface ScrollRevealElementsOptions {
  selector?: string;
  visibleClass?: string;
  threshold?: number;
  rootMargin?: string;
}

/**
 * Enhancement-only reveal authority.
 *
 * Public content must remain visibly painted without JavaScript.
 * IntersectionObserver may settle motion state, but never owns visibility.
 */
export function useScrollRevealElements(
  deps: readonly unknown[] = [],
  {
    selector = ".wk-reveal",
    visibleClass = "wk-reveal-visible",
    threshold = 0.08,
    rootMargin = "0px 0px -32px 0px",
  }: ScrollRevealElementsOptions = {},
) {
  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(
        selector,
      ),
    );

    if (elements.length === 0) {
      return;
    }

    const revealAll = () => {
      elements.forEach((element) => {
        element.classList.add(
          visibleClass,
        );
      });
    };

    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches
    ) {
      revealAll();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add(
            visibleClass,
          );

          observer.unobserve(
            entry.target,
          );
        });
      },
      {
        threshold,
        rootMargin,
      },
    );

    elements.forEach((element) => {
      observer.observe(
        element,
      );
    });

    return () => {
      observer.disconnect();
    };
  }, deps);
}
