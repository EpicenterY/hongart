"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudentItem {
  id: string;
  name: string;
  remaining: number;
}

interface MakeupPickerProps {
  dateStr: string;
  timeSlot: string;
  existingStudentIds: string[];
  onAdd: (studentId: string, studentName: string) => void;
  onClose: () => void;
  anchorRect: { top: number; left: number };
}

export function MakeupPicker({
  existingStudentIds,
  onAdd,
  onClose,
  anchorRect,
}: MakeupPickerProps) {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/students/with-absences")
      .then((r) => r.json())
      .then((data: { id: string; name: string; remaining: number }[]) => {
        setStudents(data.map((s) => ({ id: s.id, name: s.name, remaining: s.remaining })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
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

  const excludeSet = new Set(existingStudentIds);
  const filtered = students
    .filter((s) => !excludeSet.has(s.id))
    .filter((s) => !query || s.name.includes(query));

  // Position
  const popoverHeight = 260;
  let top = anchorRect.top + 32;
  if (top + popoverHeight > window.innerHeight) {
    top = anchorRect.top - popoverHeight - 8;
  }
  const left = Math.max(8, Math.min(anchorRect.left - 80, window.innerWidth - 220));

  return (
    <div
      ref={ref}
      className="fixed z-[60] w-52 bg-white rounded-xl shadow-lg border border-gray-200 animate-in fade-in zoom-in-95 duration-150"
      style={{ top: `${top}px`, left: `${left}px` }}
    >
      <div className="px-3 pt-3 pb-2">
        <div className="text-xs font-semibold text-purple-700 mb-2">보강 학생 추가</div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="이름 검색..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-7 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
        </div>
      </div>
      <div className="max-h-[160px] overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="text-xs text-gray-400 text-center py-4">로딩중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-4">
            {query ? "검색 결과 없음" : "추가 가능한 학생 없음"}
          </div>
        ) : (
          filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => onAdd(s.id, s.name)}
              className={cn(
                "w-full text-left text-xs px-2.5 py-2 rounded-lg transition-colors flex items-center justify-between",
                "hover:bg-purple-50 text-gray-700 hover:text-purple-800",
              )}
            >
              <span>{s.name}</span>
              <span className="text-[10px] text-purple-500 font-medium">{s.remaining}회</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
