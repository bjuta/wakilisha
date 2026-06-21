import { useState, useRef, useEffect } from "react";

interface ImageEditorProps {
  url: string;
  onApply: (blob: Blob, width: number, height: number) => void;
  onCancel: () => void;
  onSaveAsNew?: (blob: Blob, width: number, height: number) => void;
}

export function ImageEditor({ url, onApply, onCancel, onSaveAsNew }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<HTMLCanvasElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [corsLimited, setCorsLimited] = useState(false);

  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  const [cropMode, setCropMode] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const cropRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const [targetWidth, setTargetWidth] = useState(0);
  const [targetHeight, setTargetHeight] = useState(0);
  const [lockAspect, setLockAspect] = useState(true);

  const [activeOp, setActiveOp] = useState<string | null>(null);

  /* ── Load image into source canvas ── */
  useEffect(() => {
    setImgLoaded(false);
    setLoadError(null);
    setCorsLimited(false);
    sourceRef.current = null;

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d")!.drawImage(image, 0, 0);
      sourceRef.current = canvas;
      setTargetWidth(image.naturalWidth);
      setTargetHeight(image.naturalHeight);
      setImgLoaded(true);
    };
    image.onerror = () => {
      // Fallback: try without crossOrigin (canvas will be tainted)
      const fallback = new Image();
      fallback.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = fallback.naturalWidth;
        canvas.height = fallback.naturalHeight;
        canvas.getContext("2d")!.drawImage(fallback, 0, 0);
        sourceRef.current = canvas;
        setTargetWidth(fallback.naturalWidth);
        setTargetHeight(fallback.naturalHeight);
        setCorsLimited(true);
        setImgLoaded(true);
      };
      fallback.onerror = () => {
        setLoadError("Failed to load image. It may be unavailable or blocked.");
        setImgLoaded(true);
      };
      fallback.src = url;
    };
    image.src = url;
  }, [url]);

  /* ── Render canvas (with optional crop override) ── */
  const renderCanvas = (overrideCrop?: typeof crop) => {
    if (!canvasRef.current || !sourceRef.current) return;
    const canvas = canvasRef.current;
    const source = sourceRef.current;
    const ctx = canvas.getContext("2d")!;

    const rad = (rotation * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));
    const w = Math.round(source.width * cos + source.height * sin);
    const h = Math.round(source.width * sin + source.height * cos);

    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(rad);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.translate(-source.width / 2, -source.height / 2);
    ctx.drawImage(source, 0, 0);
    ctx.restore();

    const c = overrideCrop ?? crop;
    if (cropMode && c.w > 0 && c.h > 0) {
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      // Top strip
      ctx.fillRect(0, 0, canvas.width, c.y);
      // Bottom strip
      ctx.fillRect(0, c.y + c.h, canvas.width, canvas.height - c.y - c.h);
      // Left strip
      ctx.fillRect(0, c.y, c.x, c.h);
      // Right strip
      ctx.fillRect(c.x + c.w, c.y, canvas.width - c.x - c.w, c.h);

      // Border around crop area
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
      ctx.setLineDash([]);

      // Rule of thirds grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 1;
      const gx1 = c.x + Math.round(c.w / 3);
      const gx2 = c.x + Math.round((2 * c.w) / 3);
      const gy1 = c.y + Math.round(c.h / 3);
      const gy2 = c.y + Math.round((2 * c.h) / 3);
      ctx.beginPath();
      ctx.moveTo(gx1, c.y);
      ctx.lineTo(gx1, c.y + c.h);
      ctx.moveTo(gx2, c.y);
      ctx.lineTo(gx2, c.y + c.h);
      ctx.moveTo(c.x, gy1);
      ctx.lineTo(c.x + c.w, gy1);
      ctx.moveTo(c.x, gy2);
      ctx.lineTo(c.x + c.w, gy2);
      ctx.stroke();

      // Corner handles
      const hs = 8;
      const half = hs / 2;
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
      ctx.lineWidth = 1;
      const corners = [
        { x: c.x, y: c.y },
        { x: c.x + c.w, y: c.y },
        { x: c.x, y: c.y + c.h },
        { x: c.x + c.w, y: c.y + c.h },
      ];
      corners.forEach((p) => {
        ctx.fillRect(p.x - half, p.y - half, hs, hs);
        ctx.strokeRect(p.x - half, p.y - half, hs, hs);
      });

      // Edge handles (midpoints)
      const edges = [
        { x: c.x + c.w / 2, y: c.y },
        { x: c.x + c.w, y: c.y + c.h / 2 },
        { x: c.x + c.w / 2, y: c.y + c.h },
        { x: c.x, y: c.y + c.h / 2 },
      ];
      edges.forEach((p) => {
        ctx.fillRect(Math.round(p.x) - half, Math.round(p.y) - half, hs, hs);
        ctx.strokeRect(Math.round(p.x) - half, Math.round(p.y) - half, hs, hs);
      });

      // Dimension label
      ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
      const label = `${c.w} x ${c.h}`;
      const pad = 6;
      const fontSize = 11;
      ctx.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;
      const tw = ctx.measureText(label).width;
      ctx.beginPath();
      ctx.roundRect(c.x + (c.w - tw) / 2 - pad, c.y + c.h + 4, tw + pad * 2, fontSize + pad * 2, 4);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(label, c.x + (c.w - tw) / 2, c.y + c.h + 4 + fontSize + 3);

      ctx.restore();
    }
  };

  /* ── Re-render when rotation/flip/crop mode changes ── */
  useEffect(() => {
    renderCanvas();
  }, [rotation, flipH, flipV, cropMode, imgLoaded]);

  /* ── Re-render when crop state changes (for undo etc) ── */
  useEffect(() => {
    if (cropMode && crop.w > 0) {
      renderCanvas();
    }
  }, [crop]);

  /* ── Mouse helpers ── */
  const getCoords = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = canvasRef.current!.width / rect.width;
    const scaleY = canvasRef.current!.height / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!cropMode || corsLimited) return;
    const coords = getCoords(e);
    isDraggingRef.current = true;
    dragStartRef.current = coords;
    cropRef.current = { x: coords.x, y: coords.y, w: 0, h: 0 };
    setCrop(cropRef.current);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !cropMode || corsLimited) return;
    const coords = getCoords(e);
    cropRef.current = {
      x: Math.min(dragStartRef.current.x, coords.x),
      y: Math.min(dragStartRef.current.y, coords.y),
      w: Math.abs(coords.x - dragStartRef.current.x),
      h: Math.abs(coords.y - dragStartRef.current.y),
    };
    renderCanvas(cropRef.current);
  };

  const handleMouseUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setCrop(cropRef.current);
  };

  /* ── Operations ── */
  const applyCrop = () => {
    if (!canvasRef.current || !sourceRef.current || crop.w <= 0 || crop.h <= 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const imageData = ctx.getImageData(crop.x, crop.y, crop.w, crop.h);
    const newCanvas = document.createElement("canvas");
    newCanvas.width = crop.w;
    newCanvas.height = crop.h;
    newCanvas.getContext("2d")!.putImageData(imageData, 0, 0);
    sourceRef.current = newCanvas;
    setCrop({ x: 0, y: 0, w: 0, h: 0 });
    setCropMode(false);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setTargetWidth(crop.w);
    setTargetHeight(crop.h);
    setActiveOp(null);
  };

  const applyResize = () => {
    if (!sourceRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(sourceRef.current, 0, 0, targetWidth, targetHeight);
    sourceRef.current = canvas;
    setTargetWidth(canvas.width);
    setTargetHeight(canvas.height);
    setTimeout(() => renderCanvas(), 0);
    setActiveOp("resize");
    setTimeout(() => setActiveOp(null), 600);
  };

  const rotateCW = () => {
    setRotation((r) => (r + 90) % 360);
    setActiveOp("rotate");
    setTimeout(() => setActiveOp(null), 600);
  };

  const rotateCCW = () => {
    setRotation((r) => (r - 90 + 360) % 360);
    setActiveOp("rotate");
    setTimeout(() => setActiveOp(null), 600);
  };

  const toggleFlipH = () => {
    setFlipH((f) => !f);
    setActiveOp("flip");
    setTimeout(() => setActiveOp(null), 600);
  };

  const toggleFlipV = () => {
    setFlipV((f) => !f);
    setActiveOp("flip");
    setTimeout(() => setActiveOp(null), 600);
  };

  const reset = () => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d")!.drawImage(image, 0, 0);
      sourceRef.current = canvas;
      setRotation(0);
      setFlipH(false);
      setFlipV(false);
      setCrop({ x: 0, y: 0, w: 0, h: 0 });
      setCropMode(false);
      setTargetWidth(image.naturalWidth);
      setTargetHeight(image.naturalHeight);
      setActiveOp("reset");
      setTimeout(() => setActiveOp(null), 600);
      setCorsLimited(false);
      setLoadError(null);
    };
    image.onerror = () => {
      const fallback = new Image();
      fallback.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = fallback.naturalWidth;
        canvas.height = fallback.naturalHeight;
        canvas.getContext("2d")!.drawImage(fallback, 0, 0);
        sourceRef.current = canvas;
        setRotation(0);
        setFlipH(false);
        setFlipV(false);
        setCrop({ x: 0, y: 0, w: 0, h: 0 });
        setCropMode(false);
        setTargetWidth(fallback.naturalWidth);
        setTargetHeight(fallback.naturalHeight);
        setActiveOp("reset");
        setTimeout(() => setActiveOp(null), 600);
        setCorsLimited(true);
        setLoadError(null);
      };
      fallback.onerror = () => {
        setLoadError("Failed to reload image.");
      };
      fallback.src = url;
    };
    image.src = url;
  };

  const handleApply = async () => {
    if (!canvasRef.current) return;
    if (corsLimited) {
      setLoadError("Cannot export: image is hosted on a domain without CORS support.");
      return;
    }
    const canvas = canvasRef.current;
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), "image/png");
    });
    onApply(blob, canvas.width, canvas.height);
  };

  const handleSaveAsNew = async () => {
    if (!canvasRef.current) return;
    if (corsLimited) {
      setLoadError("Cannot export: image is hosted on a domain without CORS support.");
      return;
    }
    if (!onSaveAsNew) return;
    const canvas = canvasRef.current;
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), "image/png");
    });
    onSaveAsNew(blob, canvas.width, canvas.height);
  };

  const handleWidthChange = (val: number) => {
    setTargetWidth(val);
    if (lockAspect && sourceRef.current) {
      const ratio = sourceRef.current.height / sourceRef.current.width;
      setTargetHeight(Math.round(val * ratio));
    }
  };

  const handleHeightChange = (val: number) => {
    setTargetHeight(val);
    if (lockAspect && sourceRef.current) {
      const ratio = sourceRef.current.width / sourceRef.current.height;
      setTargetWidth(Math.round(val * ratio));
    }
  };

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 bg-[var(--wk-bg)]">
        <div className="w-12 h-12 flex items-center justify-center rounded-full bg-wk-danger-soft">
          <i className="ri-image-line text-wk-danger text-xl" />
        </div>
        <p className="text-sm text-wk-text-soft text-center max-w-xs">{loadError}</p>
        <button
          onClick={onCancel}
          className="flex items-center gap-1 rounded-md px-4 py-1.5 text-[11px] font-bold bg-wk-brand text-wk-brand-on hover:opacity-90 transition-all"
        >
          <i className="ri-close-line text-[12px]" />
          Close
        </button>
      </div>
    );
  }

  if (!imgLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--wk-bg)]">
        <div className="animate-spin w-6 h-6 border-2 border-wk-brand border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Canvas area */}
      <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden bg-[var(--wk-bg)]">
        {corsLimited && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 rounded-full bg-wk-warning-soft border border-wk-warning/20 px-4 py-1.5 text-[11px] font-semibold text-wk-warning shadow-sm whitespace-nowrap">
            <i className="ri-alert-line text-[12px] mr-1.5" />
            View-only: image hosted without CORS support
          </div>
        )}
        <div className="relative" style={{ maxWidth: "100%", maxHeight: "100%" }}>
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ maxWidth: "100%", maxHeight: "100%", display: "block" }}
            className={`${cropMode ? "cursor-crosshair" : "cursor-default"}`}
          />
          {cropMode && crop.w === 0 && crop.h === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="rounded-full bg-black/60 px-4 py-2 text-[12px] font-semibold text-white shadow-lg flex items-center gap-2">
                <i className="ri-cursor-line" />
                Click and drag on the image to select a crop area
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="shrink-0 border-t border-wk-border bg-wk-surface px-4 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            {/* Crop */}
            <button
              onClick={() => {
                if (corsLimited) return;
                setCropMode(!cropMode);
                if (cropMode) {
                  setCrop({ x: 0, y: 0, w: 0, h: 0 });
                }
              }}
              disabled={corsLimited}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold border transition-all ${
                corsLimited
                  ? "border-wk-border/50 text-wk-text-faint cursor-not-allowed"
                  : cropMode
                  ? "bg-wk-brand text-wk-brand-on border-wk-brand"
                  : "border-wk-border text-wk-text-soft hover:bg-wk-surface-raised"
              }`}
            >
              <i className="ri-crop-line text-[12px]" />
              Crop
            </button>
            {cropMode && crop.w > 0 && (
              <button
                onClick={applyCrop}
                disabled={corsLimited}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold border transition-all ${
                  corsLimited
                    ? "bg-wk-surface-strong text-wk-text-muted cursor-not-allowed"
                    : "bg-wk-success text-white border-wk-success"
                }`}
              >
                <i className="ri-check-line text-[12px]" />
                Apply Crop
              </button>
            )}

            {/* Rotate */}
            <button
              onClick={rotateCCW}
              disabled={corsLimited}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold border transition-all ${
                corsLimited
                  ? "border-wk-border/50 text-wk-text-faint cursor-not-allowed"
                  : "border-wk-border text-wk-text-soft hover:bg-wk-surface-raised"
              }`}
            >
              <i className="ri-anticlockwise-line text-[12px]" />
              -90
            </button>
            <button
              onClick={rotateCW}
              disabled={corsLimited}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold border transition-all ${
                corsLimited
                  ? "border-wk-border/50 text-wk-text-faint cursor-not-allowed"
                  : "border-wk-border text-wk-text-soft hover:bg-wk-surface-raised"
              }`}
            >
              <i className="ri-clockwise-line text-[12px]" />
              +90
            </button>

            {/* Flip */}
            <button
              onClick={toggleFlipH}
              disabled={corsLimited}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold border transition-all ${
                corsLimited
                  ? "border-wk-border/50 text-wk-text-faint cursor-not-allowed"
                  : flipH
                  ? "bg-wk-brand text-wk-brand-on border-wk-brand"
                  : "border-wk-border text-wk-text-soft hover:bg-wk-surface-raised"
              }`}
            >
              <i className="ri-arrow-left-right-line text-[12px]" />
              Flip H
            </button>
            <button
              onClick={toggleFlipV}
              disabled={corsLimited}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold border transition-all ${
                corsLimited
                  ? "border-wk-border/50 text-wk-text-faint cursor-not-allowed"
                  : flipV
                  ? "bg-wk-brand text-wk-brand-on border-wk-brand"
                  : "border-wk-border text-wk-text-soft hover:bg-wk-surface-raised"
              }`}
            >
              <i className="ri-arrow-up-down-line text-[12px]" />
              Flip V
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Resize */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-wk-text-faint">Resize:</span>
              <input
                type="number"
                value={targetWidth}
                onChange={(e) => handleWidthChange(Number(e.target.value))}
                disabled={corsLimited}
                className={`w-16 rounded-md border px-2 py-1 text-[11px] outline-none ${
                  corsLimited
                    ? "border-wk-border/50 bg-wk-surface-strong text-wk-text-faint"
                    : "border-wk-border bg-wk-bg text-wk-text"
                }`}
              />
              <span className="text-[11px] text-wk-text-faint">x</span>
              <input
                type="number"
                value={targetHeight}
                onChange={(e) => handleHeightChange(Number(e.target.value))}
                disabled={corsLimited}
                className={`w-16 rounded-md border px-2 py-1 text-[11px] outline-none ${
                  corsLimited
                    ? "border-wk-border/50 bg-wk-surface-strong text-wk-text-faint"
                    : "border-wk-border bg-wk-bg text-wk-text"
                }`}
              />
              <button
                onClick={() => setLockAspect(!lockAspect)}
                disabled={corsLimited}
                className={`text-[11px] p-1 rounded-md border transition-all ${
                  corsLimited
                    ? "border-wk-border/50 text-wk-text-faint cursor-not-allowed"
                    : lockAspect
                    ? "bg-wk-brand text-wk-brand-on border-wk-brand"
                    : "border-wk-border text-wk-text-faint"
                }`}
                title="Lock aspect ratio"
              >
                <i className="ri-lock-line text-[12px]" />
              </button>
              <button
                onClick={applyResize}
                disabled={corsLimited}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold border transition-all ${
                  corsLimited
                    ? "border-wk-border/50 text-wk-text-faint cursor-not-allowed"
                    : "border-wk-border text-wk-text-soft hover:bg-wk-surface-raised"
                }`}
              >
                <i className="ri-aspect-ratio-line text-[12px]" />
                Resize
              </button>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-wk-border">
          <button
            onClick={reset}
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-[11px] font-semibold border border-wk-border text-wk-text-soft hover:bg-wk-surface-raised transition-all"
          >
            <i className="ri-refresh-line text-[12px]" />
            Reset
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-[11px] font-semibold border border-wk-border text-wk-text-soft hover:bg-wk-surface-raised transition-all"
          >
            <i className="ri-close-line text-[12px]" />
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={corsLimited}
            className={`flex items-center gap-1 rounded-md px-4 py-1.5 text-[11px] font-bold transition-all ${
              corsLimited
                ? "bg-wk-surface-strong text-wk-text-muted cursor-not-allowed"
                : "bg-wk-brand text-wk-brand-on hover:opacity-90"
            }`}
          >
            <i className="ri-check-line text-[12px]" />
            Apply
          </button>
          {onSaveAsNew && (
            <button
              onClick={handleSaveAsNew}
              disabled={corsLimited}
              title="Save as a new media asset with current dimensions"
              className={`flex items-center gap-1 rounded-md px-4 py-1.5 text-[11px] font-bold transition-all ${
                corsLimited
                  ? "bg-wk-surface-strong text-wk-text-muted cursor-not-allowed"
                  : "bg-wk-success text-white hover:opacity-90"
              }`}
            >
              <i className="ri-add-line text-[12px]" />
              Save as New
            </button>
          )}
        </div>

        {/* Active operation hint */}
        {activeOp && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 rounded-full bg-wk-brand px-4 py-1.5 text-[11px] font-bold text-wk-brand-on shadow-lg animate-pulse">
            {activeOp === "rotate" && "Rotated"}
            {activeOp === "flip" && "Flipped"}
            {activeOp === "resize" && "Resized"}
            {activeOp === "reset" && "Reset"}
          </div>
        )}
      </div>
    </div>
  );
}