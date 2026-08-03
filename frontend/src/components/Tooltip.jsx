import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function Tooltip({ content, children }) {
  const [pos, setPos] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!pos) return;
    function dismiss(e) {
      if (ref.current && !ref.current.contains(e.target)) setPos(null);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [pos]);

  function getPos() {
    if (!ref.current) return null;
    const el = ref.current.firstElementChild || ref.current;
    if (el.scrollWidth <= el.clientWidth) return null;
    const r = ref.current.getBoundingClientRect();
    return { top: r.top - 6, left: r.left + r.width / 2 };
  }

  function handlePointerEnter(e) {
    if (e.pointerType !== "mouse") return;
    setPos(getPos());
  }

  function handlePointerLeave(e) {
    if (e.pointerType !== "mouse") return;
    setPos(null);
  }

  function handleClick(e) {
    e.stopPropagation();
    setPos((prev) => prev ? null : getPos());
  }

  return (
    <>
      <div
        ref={ref}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
        className="min-w-0 cursor-default"
      >
        {children}
      </div>
      {pos && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{ top: pos.top, left: pos.left, transform: "translate(-50%, -100%)" }}
        >
          <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg px-3 py-2 shadow-xl max-w-[280px] whitespace-normal leading-snug font-medium">
            {content}
          </div>
          <div className="absolute left-1/2 top-full -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-gray-700" />
        </div>,
        document.body
      )}
    </>
  );
}

const HOVER_POPUP_SIZE = 512;
const MIN_SCALE = 1;
const MAX_SCALE = 4;

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function Lightbox({ src, alt, onClose }) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const pointers = useRef(new Map());
  const gesture = useRef(null); // { mode: "pinch" | "pan", ... }
  const moved = useRef(false);

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { mode: "pinch", startDist: dist(a, b), startScale: scale };
    } else if (pointers.current.size === 1) {
      gesture.current = { mode: "pan", startX: e.clientX, startY: e.clientY, startTx: tx, startTy: ty };
    }
  }

  function onPointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!gesture.current) return;

    if (gesture.current.mode === "pinch" && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, gesture.current.startScale * (dist(a, b) / gesture.current.startDist)));
      moved.current = true;
      setScale(newScale);
    } else if (gesture.current.mode === "pan" && pointers.current.size === 1 && scale > 1) {
      const dx = e.clientX - gesture.current.startX;
      const dy = e.clientY - gesture.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
      setTx(gesture.current.startTx + dx);
      setTy(gesture.current.startTy + dy);
    }
  }

  function onPointerUp(e) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      gesture.current = null;
      if (scale <= 1.02) {
        setScale(1);
        setTx(0);
        setTy(0);
      }
    } else if (pointers.current.size === 1) {
      const [only] = [...pointers.current.entries()];
      gesture.current = { mode: "pan", startX: only[1].x, startY: only[1].y, startTx: tx, startTy: ty };
    }
  }

  function handleBackdropClick() {
    if (moved.current) return;
    onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-gray-950/90 backdrop-blur-sm flex items-center justify-center p-6 overflow-hidden select-none"
      style={{ touchAction: "none" }}
      onClick={handleBackdropClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-gray-950/80 text-white shadow-lg hover:bg-gray-950 transition-colors"
      >
        <X size={20} />
      </button>
      <div
        className="max-w-full max-h-full rounded-xl shadow-xl border border-white/10 bg-white overflow-hidden p-3"
        style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transition: gesture.current ? "none" : "transform 0.15s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <img src={src} alt={alt} className="max-w-full max-h-[80vh] object-contain rounded-lg" draggable={false} />
      </div>
    </div>,
    document.body
  );
}

export function ImageZoom({ src, alt, children, className }) {
  const [pos, setPos] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!pos) return;
    function dismiss(e) {
      if (ref.current && !ref.current.contains(e.target)) setPos(null);
    }
    document.addEventListener("click", dismiss);
    return () => document.removeEventListener("click", dismiss);
  }, [pos]);

  function showZoom() {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const margin = 12;
    const top = Math.min(
      Math.max(r.top + r.height / 2, HOVER_POPUP_SIZE / 2 + margin),
      window.innerHeight - HOVER_POPUP_SIZE / 2 - margin
    );
    const openRight = r.left < HOVER_POPUP_SIZE + margin;
    setPos({ top, left: openRight ? r.right + 10 : r.left - 10, openRight });
  }

  function handleClick(e) {
    e.stopPropagation();
    setPos(null);
    setLightboxOpen(true);
  }

  return (
    <>
      <div
        ref={ref}
        onMouseEnter={showZoom}
        onMouseLeave={() => setPos(null)}
        onClick={handleClick}
        className={`cursor-zoom-in ${className || ""}`}
      >
        {children}
      </div>
      {pos && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: pos.top,
            left: pos.left,
            transform: pos.openRight ? "translate(0, -50%)" : "translate(-100%, -50%)",
          }}
        >
          <div
            className="rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 bg-white overflow-hidden p-[5px]"
            style={{ width: HOVER_POPUP_SIZE, height: HOVER_POPUP_SIZE }}
          >
            <img src={src} alt={alt} className="w-full h-full object-contain" />
          </div>
        </div>,
        document.body
      )}
      {lightboxOpen && <Lightbox src={src} alt={alt} onClose={() => setLightboxOpen(false)} />}
    </>
  );
}
