import {
  CalendarDays,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "시간표", href: "/", icon: CalendarDays },
  { label: "학생", href: "/students", icon: Users },
  { label: "결제", href: "/payments", icon: CreditCard },
  { label: "통계", href: "/analytics", icon: BarChart3 },
  { label: "설정", href: "/settings", icon: Settings },
];

export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { label: "시간표", href: "/", icon: CalendarDays },
  { label: "학생", href: "/students", icon: Users },
  { label: "결제", href: "/payments", icon: CreditCard },
  { label: "통계", href: "/analytics", icon: BarChart3 },
  { label: "설정", href: "/settings", icon: Settings },
];
