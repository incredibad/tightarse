import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

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

export function ImageZoom({ src, alt, children, className }) {
  const [pos, setPos] = useState(null);
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
    setPos({ top: r.top + r.height / 2, left: r.left });
  }

  return (
    <>
      <div
        ref={ref}
        onMouseEnter={showZoom}
        onMouseLeave={() => setPos(null)}
        onClick={(e) => { e.stopPropagation(); pos ? setPos(null) : showZoom(); }}
        className={`cursor-zoom-in ${className || ""}`}
      >
        {children}
      </div>
      {pos && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{ top: pos.top, left: pos.left - 10, transform: "translate(-100%, -50%)" }}
        >
          <div className="w-64 h-64 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 bg-white overflow-hidden p-[5px]">
            <img src={src} alt={alt} className="w-full h-full object-contain" />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
