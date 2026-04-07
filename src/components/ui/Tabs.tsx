"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Tab {
  key: string;
  label: string;
  count?: number;
  badge?: number; // 빨간 알림 뱃지 (미결제 등)
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  children?: ReactNode;
}

export function Tabs({ tabs, activeTab, onTabChange, children }: TabsProps) {
  return (
    <div>
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => onTabChange(tab.key)}
              className={cn(
                "whitespace-nowrap pb-3 px-1 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.key
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                  {tab.badge}
                </span>
              )}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "ml-2 rounded-full px-2 py-0.5 text-xs",
                    activeTab === tab.key
                      ? "bg-primary-100 text-primary-700"
                      : "bg-gray-100 text-gray-600"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
