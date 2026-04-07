import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant =
  | "active"
  | "paused"
  | "withdrawn"
  | "present"
  | "absent"
  | "late"
  | "makeup"
  | "paid"
  | "pending"
  | "overdue";

type BadgeSize = "sm" | "md";

interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
  size?: BadgeSize;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  active: "bg-green-50 text-green-700 ring-green-600/20",
  paused: "bg-amber-50 text-amber-700 ring-amber-600/20",
  withdrawn: "bg-gray-50 text-gray-600 ring-gray-500/20",
  present: "bg-green-50 text-green-700 ring-green-600/20",
  absent: "bg-red-50 text-red-700 ring-red-600/20",
  late: "bg-amber-50 text-amber-700 ring-amber-600/20",
  makeup: "bg-purple-50 text-purple-700 ring-purple-600/20",
  paid: "bg-green-50 text-green-700 ring-green-600/20",
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  overdue: "bg-red-50 text-red-700 ring-red-600/20",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
};

export function Badge({
  variant,
  children,
  size = "sm",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium ring-1 ring-inset",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
}
