import {
  type CSSProperties,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useScrollLock } from "@/hooks/useScrollLock";

export type MediaPresentationMode =
  | "inline"
  | "floating"
  | "modal";

export interface MediaPresentationRenderState {
  dragging: boolean;
  dragHandleProps: {
    onPointerDown: (
      event: ReactPointerEvent<HTMLElement>,
    ) => void;
    onPointerMove: (
      event: ReactPointerEvent<HTMLElement>,
    ) => void;
    onPointerUp: (
      event: ReactPointerEvent<HTMLElement>,
    ) => void;
    onPointerCancel: (
      event: ReactPointerEvent<HTMLElement>,
    ) => void;
    style: CSSProperties;
    "data-wk-media-drag-handle": "true";
  };
}

interface MediaPresentationSurfaceProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  mode: MediaPresentationMode;
  draggable?: boolean;
  lockScroll?: boolean;
  onEscape?: () => void;
  children:
    | ReactNode
    | ((state: MediaPresentationRenderState) => ReactNode);
}

interface FloatingPosition {
  left: number;
  top: number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  left: number;
  top: number;
}

export function MediaPresentationSurface({
  mode,
  draggable = false,
  lockScroll = false,
  onEscape,
  children,
  className,
  style,
  ...rest
}: MediaPresentationSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);
  const [floatingPosition, setFloatingPosition] =
    useState<FloatingPosition | null>(null);

  useScrollLock(lockScroll && mode === "modal");

  const clampPosition = useCallback((
    left: number,
    top: number,
  ): FloatingPosition => {
    const surface = surfaceRef.current;
    const rect = surface?.getBoundingClientRect();
    const width = rect?.width || 0;
    const height = rect?.height || 0;
    const maxLeft = Math.max(0, window.innerWidth - width);
    const maxTop = Math.max(0, window.innerHeight - height);

    return {
      left: Math.max(0, Math.min(left, maxLeft)),
      top: Math.max(0, Math.min(top, maxTop)),
    };
  }, []);

  useEffect(() => {
    if (mode === "floating") return;
    dragRef.current = null;
    setDragging(false);
    setFloatingPosition(null);
  }, [mode]);

  useEffect(() => {
    if (
      mode !== "floating"
      || floatingPosition === null
    ) {
      return;
    }

    const handleResize = () => {
      setFloatingPosition((current) => (
        current
          ? clampPosition(current.left, current.top)
          : current
      ));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [
    clampPosition,
    floatingPosition,
    mode,
  ]);

  useEffect(() => {
    if (mode !== "modal" || !onEscape) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onEscape();
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [mode, onEscape]);

  const onPointerDown = useCallback((
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (!draggable || mode !== "floating") return;

    const surface = surfaceRef.current;
    if (!surface) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const rect = surface.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
    };
    setDragging(true);
  }, [draggable, mode]);

  const onPointerMove = useCallback((
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    const drag = dragRef.current;
    if (
      !drag
      || drag.pointerId !== event.pointerId
      || !event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      return;
    }

    event.preventDefault();
    setFloatingPosition(
      clampPosition(
        drag.left + event.clientX - drag.startX,
        drag.top + event.clientY - drag.startY,
      ),
    );
  }, [clampPosition]);

  const finishDrag = useCallback((
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragRef.current = null;
    setDragging(false);
  }, []);

  const dragHandleProps = useMemo(
    () => ({
      onPointerDown,
      onPointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: finishDrag,
      style: {
        cursor: draggable
          ? dragging
            ? "grabbing"
            : "grab"
          : undefined,
        touchAction: draggable ? "none" : undefined,
      } satisfies CSSProperties,
      "data-wk-media-drag-handle": "true" as const,
    }),
    [
      draggable,
      dragging,
      finishDrag,
      onPointerDown,
      onPointerMove,
    ],
  );

  const resolvedStyle: CSSProperties = {
    ...style,
    ...(mode === "floating" && floatingPosition
      ? {
          position: "fixed",
          left: floatingPosition.left,
          top: floatingPosition.top,
          right: "auto",
          bottom: "auto",
        }
      : {}),
  };

  const renderState: MediaPresentationRenderState = {
    dragging,
    dragHandleProps,
  };

  return (
    <div
      ref={surfaceRef}
      className={className}
      style={resolvedStyle}
      data-wk-media-presentation={mode}
      {...rest}
    >
      {typeof children === "function"
        ? children(renderState)
        : children}
    </div>
  );
}
