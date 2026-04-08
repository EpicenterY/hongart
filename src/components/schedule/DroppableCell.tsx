"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface DroppableCellProps {
  id: string;
  day: string;
  time: string;
  isToday: boolean;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function DroppableCell({ id, day, time, isToday, children, disabled, className: extraClassName }: DroppableCellProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: { day, time },
    disabled,
  });

  if (disabled) {
    return (
      <td className={cn("py-2 px-2 align-top", extraClassName)}>
        <div className="min-h-[40px]">{children}</div>
      </td>
    );
  }

  return (
    <td
      ref={setNodeRef}
      className={cn(
        "py-2 px-2 align-top transition-colors",
        isToday && "bg-primary-50/50",
        isOver && "bg-primary-100/70 ring-2 ring-inset ring-primary-300",
        extraClassName,
      )}
    >
      <div className="flex flex-col gap-1 min-h-[40px]">
        {children}
      </div>
    </td>
  );
}
