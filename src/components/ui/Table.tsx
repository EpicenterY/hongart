"use client";

import { type ReactNode } from "react";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  isLoading?: boolean;
}

function TableSkeleton({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: columns }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 bg-gray-200 rounded animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function MobileCardSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-lg border border-gray-200 p-4 space-y-3"
        >
          {Array.from({ length: 3 }).map((_, j) => (
            <div key={j} className="flex justify-between items-center">
              <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  emptyMessage = "데이터가 없습니다",
  isLoading = false,
}: TableProps<T>) {
  const isMobile = useIsMobile();

  const getCellValue = (item: T, col: Column<T>): ReactNode => {
    if (col.render) return col.render(item);
    const value = item[col.key];
    if (value === null || value === undefined) return "-";
    return String(value);
  };

  if (isMobile) {
    return (
      <div className="space-y-3">
        {isLoading ? (
          <MobileCardSkeleton />
        ) : data.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">
            {emptyMessage}
          </div>
        ) : (
          data.map((item, idx) => (
            <div
              key={idx}
              className={cn(
                "bg-white rounded-lg border border-gray-200 p-4 space-y-2",
                onRowClick && "cursor-pointer active:bg-gray-50"
              )}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((col) => (
                <div
                  key={col.key}
                  className="flex justify-between items-center text-sm"
                >
                  <span className="text-gray-500 font-medium">
                    {col.header}
                  </span>
                  <span className={cn("text-gray-900", col.className)}>
                    {getCellValue(item, col)}
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-4 py-3 text-left font-medium text-gray-500",
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {isLoading ? (
            <TableSkeleton columns={columns.length} />
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-gray-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, idx) => (
              <tr
                key={idx}
                className={cn(
                  "hover:bg-gray-50 transition-colors",
                  onRowClick && "cursor-pointer"
                )}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn("px-4 py-3 text-gray-900", col.className)}
                  >
                    {getCellValue(item, col)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
