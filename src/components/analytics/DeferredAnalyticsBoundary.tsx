import {
  lazy,
  Suspense,
  useEffect,
  useState,
} from "react";

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: () => void,
    options?: {
      timeout: number;
    },
  ) => number;
  cancelIdleCallback?: (
    handle: number,
  ) => void;
};

const DeferredPageViewTracker = lazy(
  async () => {
    const module = await import(
      "@/hooks/usePageViewTracking"
    );

    return {
      default: module.PageViewTracker,
    };
  },
);

const DeferredGtagInjector = lazy(
  () => import("./GtagInjector"),
);

export function scheduleAfterFirstVisualMilestone(
  callback: () => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const idleWindow =
    window as IdleWindow;

  let cancelled = false;
  let activated = false;
  let observer: PerformanceObserver | null =
    null;
  let firstFrame = 0;
  let secondFrame = 0;
  let postPaintFrame = 0;
  let idleHandle: number | null = null;
  let timeoutHandle: number | null = null;
  let loadFallbackAttached = false;

  const run = () => {
    if (cancelled || activated) {
      return;
    }

    activated = true;

    if (timeoutHandle !== null) {
      window.clearTimeout(
        timeoutHandle,
      );
      timeoutHandle = null;
    }

    callback();
  };

  const scheduleIdle = () => {
    if (cancelled || activated) {
      return;
    }

    if (
      typeof idleWindow
        .requestIdleCallback
      === "function"
    ) {
      idleHandle =
        idleWindow.requestIdleCallback(
          run,
          {
            timeout: 1200,
          },
        );
      return;
    }

    timeoutHandle =
      window.setTimeout(
        run,
        0,
      );
  };

  const scheduleAfterObservedPaint = () => {
    if (cancelled || activated) {
      return;
    }

    observer?.disconnect();
    observer = null;

    postPaintFrame =
      window.requestAnimationFrame(
        scheduleIdle,
      );
  };

  const scheduleFallbackAfterLoad = () => {
    if (cancelled || activated) {
      return;
    }

    firstFrame =
      window.requestAnimationFrame(
        () => {
          secondFrame =
            window.requestAnimationFrame(
              scheduleIdle,
            );
        },
      );
  };

  const onLoadFallback = () => {
    loadFallbackAttached = false;
    scheduleFallbackAfterLoad();
  };

  const existingFcp =
    window.performance
      ?.getEntriesByName(
        "first-contentful-paint",
        "paint",
      )
      ?? [];

  if (existingFcp.length > 0) {
    scheduleAfterObservedPaint();
  } else if (
    typeof PerformanceObserver
    !== "undefined"
  ) {
    try {
      observer =
        new PerformanceObserver(
          (list) => {
            if (
              list
                .getEntries()
                .some(
                  (entry) =>
                    entry.name
                    === "first-contentful-paint",
                )
            ) {
              scheduleAfterObservedPaint();
            }
          },
        );

      observer.observe({
        type: "paint",
        buffered: true,
      });
    } catch {
      observer?.disconnect();
      observer = null;

      if (
        document.readyState
        === "complete"
      ) {
        scheduleFallbackAfterLoad();
      } else {
        loadFallbackAttached = true;
        window.addEventListener(
          "load",
          onLoadFallback,
          {
            once: true,
          },
        );
      }
    }
  } else if (
    document.readyState
    === "complete"
  ) {
    scheduleFallbackAfterLoad();
  } else {
    loadFallbackAttached = true;
    window.addEventListener(
      "load",
      onLoadFallback,
      {
        once: true,
      },
    );
  }

  return () => {
    cancelled = true;

    observer?.disconnect();
    observer = null;

    if (loadFallbackAttached) {
      window.removeEventListener(
        "load",
        onLoadFallback,
      );
    }

    window.cancelAnimationFrame(
      firstFrame,
    );

    window.cancelAnimationFrame(
      secondFrame,
    );

    window.cancelAnimationFrame(
      postPaintFrame,
    );

    if (
      idleHandle !== null
      && typeof idleWindow
        .cancelIdleCallback
        === "function"
    ) {
      idleWindow.cancelIdleCallback(
        idleHandle,
      );
    }

    if (timeoutHandle !== null) {
      window.clearTimeout(
        timeoutHandle,
      );
    }
  };
}

export default function DeferredAnalyticsBoundary() {
  const [
    analyticsEnabled,
    setAnalyticsEnabled,
  ] = useState(false);

  useEffect(
    () =>
      scheduleAfterFirstVisualMilestone(
        () => {
          setAnalyticsEnabled(true);
        },
      ),
    [],
  );

  if (!analyticsEnabled) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <DeferredPageViewTracker />
      <DeferredGtagInjector />
    </Suspense>
  );
}
