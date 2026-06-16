import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const SCROLL_KEY_PREFIX = "wakilisha-scroll-";

function scrollKey(pathname: string, search: string): string {
  return `${SCROLL_KEY_PREFIX}${pathname}${search}`;
}

export default function ScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const initializedRef = useRef(false);

  useLayoutEffect(() => {
    // Tell the browser to stay out of our way — we handle scroll ourselves
    if (!initializedRef.current) {
      window.history.scrollRestoration = "manual";
      initializedRef.current = true;
    }
  }, []);

  useLayoutEffect(() => {
    const key = scrollKey(location.pathname, location.search);
    const savedY = sessionStorage.getItem(key);

    if (navigationType === "POP") {
      // Back / forward — restore where they were, or top if never visited
      requestAnimationFrame(() => {
        window.scrollTo(0, savedY !== null ? parseInt(savedY, 10) : 0);
      });
    } else {
      // Fresh navigation (link click, programmatic push) — always top
      window.scrollTo(0, 0);
    }

    let saveTimer: ReturnType<typeof setTimeout>;

    const persist = () => {
      sessionStorage.setItem(key, String(window.scrollY));
    };

    const onScroll = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(persist, 150);
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(saveTimer);
      persist();
    };
  }, [location.pathname, location.search, navigationType]);

  return null;
}