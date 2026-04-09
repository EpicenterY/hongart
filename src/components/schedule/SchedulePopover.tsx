"use client";

import { useEffect, useRef } from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

interface AttendanceButton {
  status: string;
  label: string;
  color: string;
}

interface SchedulePopoverProps {
  anchorRect: { top: number; left: number; width: number; height: number } | null;
  onClose: () => void;
  onNavigate: () => void;
  currentAttendanceStatus?: string | null;
  attendanceButtons?: AttendanceButton[];
  onAttendance?: (status: string) => void;
  onCancelMakeup?: () => void;
}

export function SchedulePopover({
  anchorRect,
  onClose,
  onNavigate,
  currentAttendanceStatus,
  attendanceButtons,
  onAttendance,
  onCancelMakeup,
}: SchedulePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
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

  if (!anchorRect) return null;

  const popoverHeight = 140;
  let top = anchorRect.top + anchorRect.height + 8;
  if (top + popoverHeight > window.innerHeight) {
    top = anchorRect.top - popoverHeight - 8;
  }
  const left = Math.max(8, Math.min(anchorRect.left + anchorRect.width / 2 - 100, window.innerWidth - 208));

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-52 bg-white rounded-xl shadow-lg border border-gray-200 animate-in fade-in zoom-in-95 duration-150"
      style={{ top: `${top}px`, left: `${left}px` }}
    >
      {currentAttendanceStatus === "MAKEUP" && onCancelMakeup ? (
        <div className="px-3 py-2.5">
          <button
            onClick={onCancelMakeup}
            className="w-full py-2.5 rounded-lg text-xs font-bold transition-colors bg-purple-500 hover:bg-purple-600 text-white"
          >
            보강 취소
          </button>
        </div>
      ) : attendanceButtons && onAttendance ? (
        <div className="px-3 py-2.5 flex gap-2">
          {attendanceButtons.map((btn) => {
            const isActive = currentAttendanceStatus === btn.status;
            return (
              <button
                key={btn.status}
                onClick={() => onAttendance(btn.status)}
                className={cn(
                  "flex-1 py-2.5 rounded-lg text-xs font-bold transition-colors",
                  isActive
                    ? `${btn.color} text-white`
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                )}
              >
                {btn.label}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className={cn("px-3 py-2", attendanceButtons && onAttendance && "border-t border-gray-100")}>
        <button
          onClick={onNavigate}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <User className="w-3.5 h-3.5" />
          학생 상세
        </button>
      </div>
    </div>
  );
}
