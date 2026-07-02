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

export function ImageZoom({ src, alt, children, className }) {
  const [pos, setPos] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const ref = useRef(null);
  const lastPointerType = useRef("mouse");

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

  function handlePointerDown(e) {
    lastPointerType.current = e.pointerType;
  }

  function handleClick(e) {
    e.stopPropagation();
    if (lastPointerType.current === "touch") {
      setLightboxOpen(true);
      return;
    }
    pos ? setPos(null) : showZoom();
  }

  return (
    <>
      <div
        ref={ref}
        onMouseEnter={showZoom}
        onMouseLeave={() => setPos(null)}
        onPointerDown={handlePointerDown}
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
      {lightboxOpen && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
          >
            <X size={28} />
          </button>
          <img src={src} alt={alt} className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>,
        document.body
      )}
    </>
  );
}
