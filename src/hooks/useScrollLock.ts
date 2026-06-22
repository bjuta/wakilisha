import { useEffect, useRef } from "react";

/**
 * iOS-safe scroll lock using position:fixed technique.
 *
 * WHY: `overflow: hidden` on body in iOS Safari causes `position: fixed` elements
 * (like the bottom nav, mini-player) to visually jump or lose their anchor because
 * the browser re-computes the fixed viewport when body scroll is locked. It also
 * causes the sheet's entrance animation to glitch.
 *
 * FIX: Use the `position: fixed; top: -scrollY` technique. This prevents scroll
 * without changing the stacking context for fixed elements, so the nav stays put
 * and sheets animate in correctly.
 */

let lockCount = 0;
let savedScrollY = 0;

function lock() {
  if (lockCount === 0) {
    savedScrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.position = "fixed";
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    // Do NOT set overflow:hidden — it breaks fixed children on iOS
  }
  lockCount++;
}

function unlock() {
  if (lockCount <= 0) {
    lockCount = 0;
    return;
  }
  lockCount--;

  if (lockCount === 0) {
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    document.body.style.paddingRight = "";
    // Restore scroll position silently
    window.scrollTo({ top: savedScrollY, behavior: "instant" });
  }
}

export function useScrollLock(locked: boolean) {
  const wasLocked = useRef(false);

  useEffect(() => {
    if (locked && !wasLocked.current) {
      lock();
      wasLocked.current = true;
    } else if (!locked && wasLocked.current) {
      unlock();
      wasLocked.current = false;
    }

    return () => {
      if (wasLocked.current) {
        unlock();
        wasLocked.current = false;
      }
    };
  }, [locked]);
}