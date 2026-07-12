export type RedocApi = {
  init: (
    spec: unknown,
    options: Record<string, unknown>,
    element: HTMLElement,
    callback?: () => void,
  ) => void;
};

declare global {
  interface Window {
    Redoc?: RedocApi;
    __WAKILISHA_REDOC_PROMISE__?: Promise<RedocApi>;
  }
}

const REDOC_SCRIPT_URL =
  "https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js";

const REDOC_SCRIPT_SELECTOR =
  'script[data-wakilisha-redoc-loader="true"]';

export function loadRedoc(): Promise<RedocApi> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Redoc requires a browser."),
    );
  }

  if (window.Redoc) {
    return Promise.resolve(window.Redoc);
  }

  if (window.__WAKILISHA_REDOC_PROMISE__) {
    return window.__WAKILISHA_REDOC_PROMISE__;
  }

  window.__WAKILISHA_REDOC_PROMISE__ =
    new Promise<RedocApi>((resolve, reject) => {
      const existing =
        document.querySelector<HTMLScriptElement>(
          REDOC_SCRIPT_SELECTOR,
        );

      const script =
        existing ?? document.createElement("script");

      const handleLoad = () => {
        if (window.Redoc) {
          resolve(window.Redoc);
          return;
        }

        window.__WAKILISHA_REDOC_PROMISE__ =
          undefined;

        reject(
          new Error(
            "Redoc loaded without exposing its API.",
          ),
        );
      };

      const handleError = () => {
        window.__WAKILISHA_REDOC_PROMISE__ =
          undefined;

        if (!existing) {
          script.remove();
        }

        reject(
          new Error(
            "The API reference renderer could not load.",
          ),
        );
      };

      script.addEventListener(
        "load",
        handleLoad,
        { once: true },
      );

      script.addEventListener(
        "error",
        handleError,
        { once: true },
      );

      if (!existing) {
        script.async = true;
        script.src = REDOC_SCRIPT_URL;
        script.setAttribute(
          "data-wakilisha-redoc-loader",
          "true",
        );
        document.head.appendChild(script);
      }
    });

  return window.__WAKILISHA_REDOC_PROMISE__;
}
