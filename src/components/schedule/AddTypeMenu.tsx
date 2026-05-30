"use client";

import { useEffect, useRef } from "react";

interface AddTypeMenuProps {
  anchorRect: { top: number; left: number };
  onSelect: (type: "makeup" | "walkin") => void;
  onClose: () => void;
}

export function AddTypeMenu({ anchorRect, onSelect, onClose }: AddTypeMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const menuHeight = 80;
  let top = anchorRect.top + 32;
  if (top + menuHeight > window.innerHeight) {
    top = anchorRect.top - menuHeight - 8;
  }
  const left = Math.max(8, Math.min(anchorRect.left - 40, window.innerWidth - 150));

  return (
    <div
      ref={ref}
      className="fixed z-[60] w-36 bg-white rounded-xl shadow-lg border border-gray-200 animate-in fade-in zoom-in-95 duration-150 py-1"
      style={{ top: `${top}px`, left: `${left}px` }}
    >
      <button
        onClick={() => onSelect("makeup")}
        className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors flex items-center gap-2"
      >
        <span className="w-4 h-4 rounded bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-bold">보</span>
        보강
      </button>
      <button
        onClick={() => onSelect("walkin")}
        className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2"
      >
        <span className="w-4 h-4 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">추</span>
        추가 수업
      </button>
    </div>
  );
}
