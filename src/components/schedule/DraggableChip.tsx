"use client";

import type { ReactNode } from "react";
import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

interface DraggableChipProps {
  id: string;
  studentId: string;
  studentName: string;
  colorClass: string;
  day: string;
  time: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  suffix?: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function DraggableChip({
  id,
  studentId,
  studentName,
  colorClass,
  day,
  time,
  onClick,
  suffix,
  className: extraClassName,
  disabled,
}: DraggableChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { studentId, day, time },
    disabled,
  });

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        "text-xs font-medium px-2 py-2 rounded-md border transition-colors hover:opacity-80 text-left",
        disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        colorClass,
        isDragging && "opacity-50",
        extraClassName,
      )}
    >
      <span className="flex items-center justify-between gap-1 w-full">
        <span>{studentName}</span>
        {suffix}
      </span>
    </button>
  );
}
