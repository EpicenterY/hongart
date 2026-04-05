"use client";

import { Menu } from "lucide-react";

interface HeaderProps {
  title?: string;
}

export default function Header({ title = "홍아트" }: HeaderProps) {
  return (
    <header className="lg:hidden sticky top-0 z-40 flex items-center h-14 px-4 bg-white border-b border-gray-200">
      <button className="p-2 -ml-2 text-gray-600 lg:hidden">
        <Menu className="w-5 h-5" />
      </button>
      <h1 className="ml-2 text-lg font-bold text-gray-900">{title}</h1>
    </header>
  );
}
