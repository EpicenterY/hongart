"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { celebrate } from "@/lib/celebrate";

export default function Sidebar() {
  const pathname = usePathname();

  const { data: unpaidCount = 0 } = useQuery<number>({
    queryKey: ["unpaid-count"],
    queryFn: async () => {
      const res = await fetch("/api/unpaid-count");
      if (!res.ok) return 0;
      const data = await res.json();
      return data.count ?? 0;
    },
    staleTime: 0,
    refetchInterval: 30_000,
  });

  const prevUnpaidRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevUnpaidRef.current !== null && prevUnpaidRef.current > 0 && unpaidCount === 0) {
      celebrate("allPaid");
    }
    prevUnpaidRef.current = unpaidCount;
  }, [unpaidCount]);

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0 bg-white border-r border-gray-200">
      <div className="flex items-center h-16 px-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-primary-600">홍아트</h1>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const showBadge = item.href === "/payments" && unpaidCount > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
              {showBadge && (
                <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full">
                  {unpaidCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
