import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  padding?: boolean;
  onClick?: () => void;
}

export function Card({
  header,
  footer,
  children,
  className,
  padding = true,
  onClick,
}: CardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl shadow-sm border border-gray-200",
        className
      )}
      onClick={onClick}
    >
      {header && (
        <div className="px-5 py-4 border-b border-gray-200">{header}</div>
      )}
      <div className={cn(padding && "px-5 py-4")}>{children}</div>
      {footer && (
        <div className="px-5 py-4 border-t border-gray-200">{footer}</div>
      )}
    </div>
  );
}
