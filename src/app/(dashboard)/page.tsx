"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent } from "@dnd-kit/core";
import { Clock, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Card, Badge, EmptyState, Tabs, Modal, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { DraggableChip } from "@/components/schedule/DraggableChip";
import { DroppableCell } from "@/components/schedule/DroppableCell";
import { SchedulePopover } from "@/components/schedule/SchedulePopover";

interface ScheduleSlot { day: string; time: string; }

interface ScheduleEntry {
  studentId: string;
  studentName: string;
  schedule: ScheduleSlot[];
  daysPerWeek: number;
  startDate: string;
}

interface PublicHoliday {
  date: string;
  name: string;
}

interface VacationPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface AttendanceInfo {
  id: string;
  status: string;
  note: string | null;
  scheduleTime?: string | null;
  studentName?: string;
}

interface ScheduleOverrideInfo {
  id: string;
  studentId: string;
  originalDate: string;
  newDate: string;
  newTime: string;
}

interface AttendanceEntry {
  studentId: string;
  studentName: string;
  scheduleTime: string | null;
  attendance: AttendanceInfo | null;
  remainingClasses: number | null;
}

const ALL_WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const DAY_LABELS: Record<string, string> = {
  SUN: "일", MON: "월", TUE: "화", WED: "수", THU: "목", FRI: "금", SAT: "토",
};
const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const TIME_SLOTS = ["14:00", "15:00", "16:00", "17:00", "18:00"];
const TIME_LABELS: Record<string, string> = {
  "14:00": "2시", "15:00": "3시", "16:00": "4시", "17:00": "5시", "18:00": "6시",
};

const STUDENT_COLORS = [
  "bg-blue-100 text-blue-800 border-blue-200",
  "bg-emerald-100 text-emerald-800 border-emerald-200",
  "bg-violet-100 text-violet-800 border-violet-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-rose-100 text-rose-800 border-rose-200",
  "bg-cyan-100 text-cyan-800 border-cyan-200",
  "bg-orange-100 text-orange-800 border-orange-200",
  "bg-pink-100 text-pink-800 border-pink-200",
];

const ATTENDANCE_STYLES: Record<string, { bg: string; label: string }> = {
  PRESENT: { bg: "bg-green-100 text-green-800 border-green-300", label: "출석" },
  ABSENT: { bg: "bg-red-100 text-red-800 border-red-300", label: "결석" },
  LATE: { bg: "bg-yellow-100 text-yellow-800 border-yellow-300", label: "지각" },
};

const ATTENDANCE_BUTTONS = [
  { status: "PRESENT", label: "출석", color: "bg-green-500 hover:bg-green-600" },
  { status: "ABSENT", label: "결석", color: "bg-red-500 hover:bg-red-600" },
];

const MONTH_NAMES = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

const VIEW_TABS = [
  { key: "daily", label: "일간" },
  { key: "weekly", label: "주간" },
  { key: "monthly", label: "월간" },
  { key: "yearly", label: "연간" },
];

type DailyStatus = "PRESENT" | "ABSENT";

interface DailyAttendanceEntry {
  studentId: string;
  studentName: string;
  scheduleTime: string | null;
  attendance: { id: string; status: string; note: string | null } | null;
  totalSessions: number | null;
  usedSessions: number | null;
  remainingClasses: number | null;
  paymentState: string;
}

interface DailyAttendanceResponse {
  status: "normal" | "holiday" | "vacation" | "disabled_day";
  entries: DailyAttendanceEntry[];
  holiday?: string;
  vacation?: string;
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const cells: { date: number; month: number; year: number; isCurrentMonth: boolean }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevDays - i;
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    cells.push({ date: d, month: pm, year: py, isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: d, month, year, isCurrentMonth: true });
  }
  const remainder = cells.length % 7;
  const pad = remainder === 0 ? 0 : 7 - remainder;
  for (let d = 1; d <= pad; d++) {
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    cells.push({ date: d, month: nm, year: ny, isCurrentMonth: false });
  }
  return cells;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addWeeks(d: Date, weeks: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + weeks * 7);
  return result;
}

function formatWeekRange(monday: Date): string {
  const sat = new Date(monday);
  sat.setDate(sat.getDate() + 5);
  const mStr = `${monday.getMonth() + 1}/${monday.getDate()}`;
  const sStr = `${sat.getMonth() + 1}/${sat.getDate()}`;
  if (monday.getFullYear() !== sat.getFullYear()) {
    return `${monday.getFullYear()}. ${mStr} ~ ${sat.getFullYear()}. ${sStr}`;
  }
  return `${monday.getFullYear()}. ${mStr} ~ ${sStr}`;
}

export default function SchedulePage() {
  const router = useRouter();
  const today = new Date();
  const todayDateStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());
  const [view, setView] = useState("weekly");
  useEffect(() => {
    if (window.innerWidth < 640) setView("daily");
  }, []);
  const [weekMonday, setWeekMonday] = useState(() => getMonday(today));
  const [monthYear, setMonthYear] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [yearView, setYearView] = useState(today.getFullYear());
  const [dailyDate, setDailyDate] = useState(todayDateStr);
  const isDailyToday = dailyDate === todayDateStr;

  // ─── Student highlight state ────────────────────
  const [highlightStudentId, setHighlightStudentId] = useState<string | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchHighlightIdx, setSearchHighlightIdx] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchListRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();

  // ─── DnD state ─────────────────────────────────────
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDragEntry, setActiveDragEntry] = useState<{ studentName: string; colorClass: string } | null>(null);

  // ─── DnD confirmation state ────────────────────────
  const [dndConfirm, setDndConfirm] = useState<{
    studentId: string;
    studentName: string;
    from: { day: string; time: string };
    to: { day: string; time: string };
  } | null>(null);

  // ─── Popover state (unified daily/weekly) ──────────
  const [popover, setPopover] = useState<{
    studentId: string;
    dateStr: string;
    timeSlot: string;
    anchorRect: { top: number; left: number; width: number; height: number };
  } | null>(null);

  const isThisWeek = getMonday(today).getTime() === weekMonday.getTime();

  function getWeekDate(dayIdx: number): Date {
    const d = new Date(weekMonday);
    d.setDate(d.getDate() + dayIdx);
    return d;
  }

  // ─── Data queries ──────────────────────────────────
  const { data: classDays } = useQuery<{ enabledDays: string[] }>({
    queryKey: ["classDays"],
    queryFn: async () => {
      const res = await fetch("/api/settings/class-days");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const WEEKDAYS = ALL_WEEKDAYS.filter(
    (d) => classDays?.enabledDays.includes(d) ?? true,
  );
  const enabledSet = new Set(classDays?.enabledDays ?? [...ALL_WEEKDAYS]);

  const { data: schedule = [], isLoading } = useQuery<ScheduleEntry[]>({
    queryKey: ["schedule", "weekly"],
    queryFn: async () => {
      const res = await fetch("/api/schedule/weekly");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: holidayData } = useQuery<{ holidays: PublicHoliday[] }>({
    queryKey: ["holidays"],
    queryFn: async () => {
      const res = await fetch("/api/settings/holidays");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
  const holidayMap = new Map<string, string>();
  for (const h of holidayData?.holidays ?? []) holidayMap.set(h.date, h.name);

  const { data: vacations = [] } = useQuery<VacationPeriod[]>({
    queryKey: ["vacations"],
    queryFn: async () => {
      const res = await fetch("/api/settings/vacations");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const weekDatesMap = useMemo(() => {
    const map: Record<string, string> = {};
    const offsets: Record<string, number> = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5 };
    for (const [day, offset] of Object.entries(offsets)) {
      const d = new Date(weekMonday);
      d.setDate(d.getDate() + offset);
      map[day] = toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
    }
    return map;
  }, [weekMonday]);

  // ─── Schedule overrides for the current week ────────
  const { data: weekOverrides = [] } = useQuery<ScheduleOverrideInfo[]>({
    queryKey: ["weekOverrides", weekMonday.toISOString()],
    queryFn: async () => {
      const dates = Object.values(weekDatesMap);
      const results = await Promise.all(
        dates.map(async (date) => {
          const res = await fetch(`/api/schedule/override?date=${date}`);
          if (!res.ok) return [];
          return res.json();
        })
      );
      // Deduplicate by id
      const seen = new Set<string>();
      const all: ScheduleOverrideInfo[] = [];
      for (const arr of results) {
        for (const o of arr) {
          if (!seen.has(o.id)) { seen.add(o.id); all.push(o); }
        }
      }
      return all;
    },
    enabled: view === "weekly",
  });

  const { data: weekAttendance } = useQuery<Record<string, Record<string, AttendanceInfo>>>({
    queryKey: ["weekAttendance", weekMonday.toISOString()],
    queryFn: async () => {
      const dates = Object.values(weekDatesMap);
      const results = await Promise.all(
        dates.map(async (date) => {
          const res = await fetch(`/api/attendance?date=${date}`);
          if (!res.ok) return { date, entries: [] as AttendanceEntry[] };
          const data = await res.json();
          return { date, entries: (data.entries ?? []) as AttendanceEntry[] };
        })
      );
      const map: Record<string, Record<string, AttendanceInfo>> = {};
      for (const r of results) {
        map[r.date] = {};
        for (const e of r.entries) {
          if (e.attendance) {
            const key = `${e.studentId}_${e.scheduleTime}`;
            map[r.date][key] = {
              ...e.attendance,
              scheduleTime: e.scheduleTime ?? null,
              studentName: e.studentName,
            };
          }
        }
      }
      return map;
    },
    enabled: view === "weekly",
  });

  // ─── Schedule mutations ────────────────────────────
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const scheduleMutation = useMutation({
    mutationFn: async ({ studentId, schedule: newSchedule }: { studentId: string; schedule: ScheduleSlot[] }) => {
      const res = await fetch(`/api/students/${studentId}/subscription`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule: newSchedule }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["weekAttendance"] });
      queryClient.invalidateQueries({ queryKey: ["weekOverrides"] });
      setDndConfirm(null);
      setScheduleError(null);
    },
    onError: (err: Error) => {
      setScheduleError(err.message);
    },
  });

  const overrideMutation = useMutation({
    mutationFn: async (payload: { studentId: string; originalDate: string; newDate: string; newTime: string }) => {
      const res = await fetch("/api/schedule/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["weekAttendance"] });
      queryClient.invalidateQueries({ queryKey: ["weekOverrides"] });
      setDndConfirm(null);
      setScheduleError(null);
    },
    onError: (err: Error) => {
      setScheduleError(err.message);
    },
  });

  // ─── Attendance mutation (unified for popover) ─────
  const attendanceMutation = useMutation({
    mutationFn: async (payload: { studentId: string; date: string; status: string; timeSlot: string }) => {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onMutate: async ({ studentId, status, date, timeSlot }) => {
      // Optimistic update for daily view
      if (view === "daily" && date === dailyDate) {
        await queryClient.cancelQueries({ queryKey: ["attendance", dailyDate] });
        const previous = queryClient.getQueryData<DailyAttendanceResponse>(["attendance", dailyDate]);
        queryClient.setQueryData<DailyAttendanceResponse>(["attendance", dailyDate], (old) => {
          if (!old) return old;
          const COUNTED = ["PRESENT", "LATE"];
          return {
            ...old,
            entries: old.entries.map((entry) => {
              if (entry.studentId !== studentId || entry.scheduleTime !== timeSlot) return entry;
              const wasCounted = entry.attendance ? COUNTED.includes(entry.attendance.status) : false;
              const isCounted = COUNTED.includes(status);
              const delta = (isCounted ? 1 : 0) - (wasCounted ? 1 : 0);
              return {
                ...entry,
                attendance: { id: entry.attendance?.id || "temp", status, note: entry.attendance?.note || null },
                usedSessions: entry.usedSessions !== null ? entry.usedSessions + delta : null,
                remainingClasses: entry.remainingClasses !== null ? entry.remainingClasses - delta : null,
              };
            }),
          };
        });
        return { previous };
      }
    },
    onError: (_err, vars, context) => {
      if (context?.previous) queryClient.setQueryData(["attendance", vars.date], context.previous);
    },
    onSuccess: () => {
      setPopover(null);
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["weekAttendance"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student", variables.studentId] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["unpaid-count"] });
    },
  });

  // ─── Daily view query ──────────────────────────────
  const { data: dailyResponse, isLoading: dailyLoading } = useQuery<DailyAttendanceResponse>({
    queryKey: ["attendance", dailyDate],
    queryFn: async () => {
      const res = await fetch(`/api/attendance?date=${dailyDate}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: view === "daily",
  });

  const dailyEntries = dailyResponse?.entries ?? [];
  const dailyDateStatus = dailyResponse?.status ?? "normal";

  const dailyTimeMap = new Map<string, DailyAttendanceEntry[]>();
  for (const entry of dailyEntries) {
    const time = entry.scheduleTime || "00:00";
    if (!dailyTimeMap.has(time)) dailyTimeMap.set(time, []);
    dailyTimeMap.get(time)!.push(entry);
  }
  const dailyUsedTimes = Array.from(dailyTimeMap.keys()).sort();
  const dMinSlot = dailyUsedTimes.length > 0 ? TIME_SLOTS.indexOf(dailyUsedTimes[0]) : -1;
  const dMaxSlot = dailyUsedTimes.length > 0 ? TIME_SLOTS.indexOf(dailyUsedTimes.at(-1)!) : -1;
  const dailyDisplaySlots = dMinSlot >= 0 && dMaxSlot >= 0 ? TIME_SLOTS.slice(dMinSlot, dMaxSlot + 1) : [];
  const dailyTimeGroups = dailyDisplaySlots.map((time) => ({
    time,
    label: TIME_LABELS[time] || time,
    students: dailyTimeMap.get(time) || [],
  }));
  const dailyPresentCount = dailyEntries.filter((e) => e.attendance?.status === "PRESENT").length;
  const dailyTotalCount = dailyEntries.length;

  const dailyColorMap = new Map<string, string>();
  dailyEntries.forEach((entry, i) => {
    if (!dailyColorMap.has(entry.studentId)) {
      dailyColorMap.set(entry.studentId, STUDENT_COLORS[i % STUDENT_COLORS.length]);
    }
  });

  function addDaysDaily(dateStr: string, days: number): string {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + days);
    return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function formatDailyDate(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_LABELS[DAY_NAMES[d.getDay()]]})`;
  }

  function getVacation(dateStr: string): string | null {
    for (const v of vacations) {
      if (dateStr >= v.startDate && dateStr <= v.endDate) return v.name;
    }
    return null;
  }

  // ─── Student color map ─────────────────────────────
  const studentColorMap = new Map<string, string>();
  schedule.forEach((entry, i) => {
    if (!studentColorMap.has(entry.studentId)) {
      studentColorMap.set(entry.studentId, STUDENT_COLORS[i % STUDENT_COLORS.length]);
    }
  });

  // ─── Student search list ─────────────────────────
  const uniqueStudents = useMemo(() => {
    const seen = new Map<string, string>();
    for (const entry of schedule) {
      if (!seen.has(entry.studentId)) seen.set(entry.studentId, entry.studentName);
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [schedule]);

  const filteredStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return uniqueStudents;
    const q = studentSearchQuery.trim().toLowerCase();
    return uniqueStudents.filter(s => s.name.toLowerCase().includes(q));
  }, [uniqueStudents, studentSearchQuery]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (searchHighlightIdx < 0 || !searchListRef.current) return;
    const items = searchListRef.current.children;
    if (items[searchHighlightIdx]) {
      (items[searchHighlightIdx] as HTMLElement).scrollIntoView({ block: "nearest" });
    }
  }, [searchHighlightIdx]);

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ESC to clear highlight
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && highlightStudentId) {
        setHighlightStudentId(null);
        setStudentSearchQuery("");
        setSearchFocused(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [highlightStudentId]);

  function getStudentsForDay(dayName: string, dateStr?: string): ScheduleEntry[] {
    return schedule.filter((e) => {
      if (!e.schedule.some(s => s.day === dayName)) return false;
      if (dateStr && e.startDate > dateStr) return false;
      return true;
    });
  }

  function getDateInfo(dateStr: string, dayName: string) {
    const holiday = holidayMap.get(dateStr);
    if (holiday) return { type: "holiday" as const, label: holiday };
    const vacation = getVacation(dateStr);
    if (vacation) return { type: "vacation" as const, label: vacation };
    if (!enabledSet.has(dayName)) return { type: "disabled" as const, label: null };
    return { type: "normal" as const, label: null };
  }

  // ─── Weekly grid ───────────────────────────────────
  const grid: Record<string, Record<string, ScheduleEntry[]>> = {};
  for (const time of TIME_SLOTS) {
    grid[time] = {};
    for (const day of WEEKDAYS) grid[time][day] = [];
  }
  for (const entry of schedule) {
    for (const slot of entry.schedule) {
      if (grid[slot.time]?.[slot.day]) grid[slot.time][slot.day].push(entry);
    }
  }

  function getGridEntries(time: string, day: string, dateStr: string): ScheduleEntry[] {
    const base = (grid[time]?.[day] ?? []).filter(e => e.startDate <= dateStr);

    // Remove students whose originalDate matches this cell (they moved away)
    const removed = new Set(
      weekOverrides
        .filter(o => o.originalDate === dateStr)
        .map(o => o.studentId)
    );
    const filtered = base.filter(e => !removed.has(e.studentId));

    // Add students whose newDate+newTime matches this cell (they moved here)
    const added = weekOverrides.filter(o => o.newDate === dateStr && o.newTime === time);
    for (const o of added) {
      if (filtered.some(e => e.studentId === o.studentId)) continue;
      const entry = schedule.find(e => e.studentId === o.studentId);
      if (entry && entry.startDate <= dateStr) filtered.push(entry);
    }

    // Add attendance-only entries (students with attendance but no longer scheduled)
    if (weekAttendance?.[dateStr]) {
      for (const [studentId, att] of Object.entries(weekAttendance[dateStr])) {
        if (filtered.some(e => e.studentId === studentId)) continue;
        if (att.scheduleTime !== time) continue;
        filtered.push({
          studentId,
          studentName: att.studentName ?? studentId,
          schedule: [],
          daysPerWeek: 0,
          startDate: "1970-01-01",
        });
      }
    }

    return filtered;
  }

  function getDayCount(day: string, dateStr: string): number {
    const set = new Set<string>();
    for (const time of TIME_SLOTS) {
      for (const e of getGridEntries(time, day, dateStr)) set.add(e.studentId);
    }
    return set.size;
  }

  // ─── DnD handlers ──────────────────────────────────
  const justDraggedRef = useRef(false);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    const data = active.data.current as { studentId: string; day: string; time: string } | undefined;
    if (data) {
      const entry = schedule.find(e => e.studentId === data.studentId);
      if (entry) {
        setActiveDragEntry({
          studentName: entry.studentName,
          colorClass: studentColorMap.get(entry.studentId) || STUDENT_COLORS[0],
        });
      }
    }
    setPopover(null);
  }, [schedule, studentColorMap]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    setActiveDragEntry(null);
    // Prevent click events right after drag from opening popover/triggering attendance
    justDraggedRef.current = true;
    setTimeout(() => { justDraggedRef.current = false; }, 200);

    const { active, over } = event;
    if (!over) return;

    const from = active.data.current as { studentId: string; day: string; time: string } | undefined;
    const to = over.data.current as { day: string; time: string } | undefined;
    if (!from || !to) return;
    if (from.day === to.day && from.time === to.time) return;

    const entry = schedule.find(e => e.studentId === from.studentId);
    if (!entry) return;

    // Block: student already occupies the target via subscription (not vacated by override)
    const targetDate = weekDatesMap[to.day];
    const alreadyInSubscription = entry.schedule.some(s => {
      if (s.day !== to.day || s.time !== to.time) return false;
      if (s.day === from.day && s.time === from.time) return false;
      // Allow if this slot is vacated by an override
      const slotDate = weekDatesMap[s.day];
      const isVacated = weekOverrides.some(
        o => o.studentId === from.studentId && o.originalDate === slotDate
      );
      return !isVacated;
    });
    // Block: student already occupies the target via an override
    const alreadyFromOverride = weekOverrides.some(
      o => o.studentId === from.studentId && o.newDate === targetDate && o.newTime === to.time
    );
    if (alreadyInSubscription || alreadyFromOverride) return;

    // Show confirmation dialog instead of immediate mutation
    setDndConfirm({
      studentId: from.studentId,
      studentName: entry.studentName,
      from: { day: from.day, time: from.time },
      to: { day: to.day, time: to.time },
    });
  }, [schedule, weekOverrides, weekDatesMap]);

  // ─── DnD confirm handlers ─────────────────────────
  // Reverse map: dateStr → day name (e.g. "2026-04-09" → "THU")
  const dateToDayMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const [day, date] of Object.entries(weekDatesMap)) m[date] = day;
    return m;
  }, [weekDatesMap]);

  // Find if the drag source was an override-positioned chip
  const resolveSourceOverride = useCallback((studentId: string, fromDay: string, fromTime: string) => {
    const fromDate = weekDatesMap[fromDay];
    return weekOverrides.find(
      o => o.studentId === studentId && o.newDate === fromDate && o.newTime === fromTime
    ) ?? null;
  }, [weekOverrides, weekDatesMap]);

  const handleDndRecurring = useCallback(() => {
    if (!dndConfirm) return;
    const entry = schedule.find(e => e.studentId === dndConfirm.studentId);
    if (!entry) return;

    const sourceOverride = resolveSourceOverride(
      dndConfirm.studentId, dndConfirm.from.day, dndConfirm.from.time
    );

    // If source is from an override, resolve the actual subscription slot
    const actualFromDay = sourceOverride
      ? dateToDayMap[sourceOverride.originalDate] ?? dndConfirm.from.day
      : dndConfirm.from.day;
    const actualFromTime = sourceOverride
      ? (entry.schedule.find(s => s.day === actualFromDay)?.time ?? dndConfirm.from.time)
      : dndConfirm.from.time;

    const newSchedule = entry.schedule.map(s =>
      s.day === actualFromDay && s.time === actualFromTime
        ? { day: dndConfirm.to.day, time: dndConfirm.to.time }
        : s
    );

    // If there was a source override, delete it before applying recurring change
    if (sourceOverride) {
      fetch(`/api/schedule/override?id=${sourceOverride.id}`, { method: "DELETE" })
        .then(() => scheduleMutation.mutate({ studentId: dndConfirm.studentId, schedule: newSchedule }));
    } else {
      scheduleMutation.mutate({ studentId: dndConfirm.studentId, schedule: newSchedule });
    }
  }, [dndConfirm, schedule, scheduleMutation, resolveSourceOverride, dateToDayMap]);

  const handleDndOnce = useCallback(() => {
    if (!dndConfirm) return;

    const entry = schedule.find(e => e.studentId === dndConfirm.studentId);
    const sourceOverride = resolveSourceOverride(
      dndConfirm.studentId, dndConfirm.from.day, dndConfirm.from.time
    );

    // If source is from an override, use the original override's originalDate
    // so the upsert correctly replaces the existing override
    const actualOriginalDate = sourceOverride
      ? sourceOverride.originalDate
      : weekDatesMap[dndConfirm.from.day];

    // If moving back to the original subscription slot, just delete the override
    if (sourceOverride && entry) {
      const originalDay = dateToDayMap[sourceOverride.originalDate];
      const originalSlot = entry.schedule.find(s => s.day === originalDay);
      if (originalSlot && dndConfirm.to.day === originalDay && dndConfirm.to.time === originalSlot.time) {
        fetch(`/api/schedule/override?id=${sourceOverride.id}`, { method: "DELETE" })
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ["weekOverrides"] });
            queryClient.invalidateQueries({ queryKey: ["schedule"] });
            queryClient.invalidateQueries({ queryKey: ["attendance"] });
            setDndConfirm(null);
          });
        return;
      }
    }

    overrideMutation.mutate({
      studentId: dndConfirm.studentId,
      originalDate: actualOriginalDate,
      newDate: weekDatesMap[dndConfirm.to.day],
      newTime: dndConfirm.to.time,
    });
  }, [dndConfirm, weekDatesMap, overrideMutation, resolveSourceOverride, dateToDayMap, schedule, queryClient]);

  // ─── Popover open (unified) ────────────────────────
  const openPopover = useCallback((e: React.MouseEvent, studentId: string, dateStr: string, timeSlot: string) => {
    // Prevent popover from opening right after a drag operation or while DnD modal is showing
    if (justDraggedRef.current || dndConfirm) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopover({
      studentId,
      dateStr,
      timeSlot,
      anchorRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
    });
  }, [dndConfirm]);

  // Compute popover attendance status dynamically
  const popoverAttStatus = popover
    ? (view === "daily"
      ? (dailyEntries.find(e => e.studentId === popover.studentId && e.scheduleTime === popover.timeSlot)?.attendance?.status ?? null)
      : (weekAttendance?.[popover.dateStr]?.[`${popover.studentId}_${popover.timeSlot}`]?.status ?? null))
    : null;

  // ─── Month navigation ──────────────────────────────
  function prevMonth() {
    setMonthYear((p) => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
  }
  function nextMonth() {
    setMonthYear((p) => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });
  }
  function goToday() {
    setMonthYear({ year: today.getFullYear(), month: today.getMonth() });
  }

  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  // ─── Render ────────────────────────────────────────
  return (
    <div className="px-4 py-6 lg:px-8">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">시간표</h1>
        <Tabs tabs={VIEW_TABS} activeTab={view} onTabChange={setView} />
      </div>

      {/* ─── Student Search ─────────────────── */}
      {(view === "daily" || view === "weekly") && schedule.length > 0 && (
        <div ref={searchRef} className="relative mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="학생 검색..."
              value={highlightStudentId ? (uniqueStudents.find(s => s.id === highlightStudentId)?.name ?? "") : studentSearchQuery}
              onChange={(e) => {
                setStudentSearchQuery(e.target.value);
                setHighlightStudentId(null);
                setSearchFocused(true);
                setSearchHighlightIdx(-1);
              }}
              onFocus={() => setSearchFocused(true)}
              onKeyDown={(e) => {
                if (!searchFocused || highlightStudentId) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSearchHighlightIdx((prev) => Math.min(prev + 1, filteredStudents.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSearchHighlightIdx((prev) => Math.max(prev - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const idx = searchHighlightIdx >= 0 ? searchHighlightIdx : 0;
                  const target = filteredStudents[idx];
                  if (target) {
                    setHighlightStudentId(target.id);
                    setStudentSearchQuery("");
                    setSearchFocused(false);
                    setSearchHighlightIdx(-1);
                  }
                } else if (e.key === "Escape") {
                  setSearchFocused(false);
                  setSearchHighlightIdx(-1);
                }
              }}
              className={cn(
                "w-full pl-9 pr-9 py-2 text-sm border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400",
                highlightStudentId ? "border-primary-400 bg-primary-50" : "border-gray-200",
              )}
            />
            {(highlightStudentId || studentSearchQuery) && (
              <button
                onClick={() => {
                  setHighlightStudentId(null);
                  setStudentSearchQuery("");
                  setSearchFocused(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>
          {searchFocused && !highlightStudentId && (
            <div ref={searchListRef} className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredStudents.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-400">일치하는 학생이 없습니다</div>
              ) : (
                filteredStudents.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setHighlightStudentId(s.id);
                      setStudentSearchQuery("");
                      setSearchFocused(false);
                      setSearchHighlightIdx(-1);
                    }}
                    onMouseEnter={() => setSearchHighlightIdx(idx)}
                    className={cn(
                      "w-full px-4 py-3 text-sm text-left transition-colors flex items-center gap-2",
                      idx === searchHighlightIdx ? "bg-primary-50" : "hover:bg-primary-50",
                    )}
                  >
                    <span className={cn("w-2.5 h-2.5 rounded-full border", studentColorMap.get(s.id) || STUDENT_COLORS[0])} />
                    <span>{s.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── DAILY VIEW ──────────────────────── */}
      {view === "daily" && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <button onClick={() => setDailyDate(addDaysDaily(dailyDate, -1))} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={() => setDailyDate(todayDateStr)}
              className={cn("text-sm font-medium px-3 py-1 rounded-full transition-colors", isDailyToday ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:bg-gray-100")}
            >
              오늘
            </button>
            <div className="relative">
              <input type="date" value={dailyDate} onChange={(e) => e.target.value && setDailyDate(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full" />
              <span className="text-sm font-semibold text-gray-900 pointer-events-none truncate">{formatDailyDate(dailyDate)}</span>
            </div>
            <button onClick={() => setDailyDate(addDaysDaily(dailyDate, 1))} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {dailyDateStatus === "normal" && dailyTotalCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="font-medium text-gray-700">{dailyPresentCount}/{dailyTotalCount}</span>
              <span>출석</span>
            </div>
          )}

          {dailyLoading ? (
            <div className="animate-pulse space-y-4"><div className="h-64 bg-gray-200 rounded-xl" /></div>
          ) : dailyDateStatus === "holiday" ? (
            <Card>
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 mb-4">
                <span className="text-sm font-semibold text-red-700">공휴일 — {dailyResponse?.holiday}</span>
              </div>
              <EmptyState icon={Clock} title="공휴일입니다" description={`${formatDailyDate(dailyDate)}은(는) ${dailyResponse?.holiday}로 수업이 없습니다.`} />
            </Card>
          ) : dailyDateStatus === "vacation" ? (
            <Card>
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 mb-4">
                <span className="text-sm font-semibold text-blue-700">방학 — {dailyResponse?.vacation}</span>
              </div>
              <EmptyState icon={Clock} title="방학 기간입니다" description={`${formatDailyDate(dailyDate)}은(는) ${dailyResponse?.vacation} 기간으로 수업이 없습니다.`} />
            </Card>
          ) : dailyDateStatus === "disabled_day" ? (
            <Card><EmptyState icon={Clock} title="수업이 없는 요일입니다" description={`${formatDailyDate(dailyDate)}은(는) 수업이 없는 요일입니다.`} /></Card>
          ) : dailyEntries.length === 0 ? (
            <Card><EmptyState icon={Clock} title="수업이 없습니다" description={`${formatDailyDate(dailyDate)}에는 예정된 수업이 없습니다.`} /></Card>
          ) : (
            <Card padding={false}>
              {dailyTimeGroups.map(({ time, label, students }, groupIdx) => {
                const nowHour = today.getHours();
                const slotHour = parseInt(time.split(":")[0], 10);
                const isCurrent = isDailyToday && nowHour === slotHour;
                return (
                <div key={time} className={cn(groupIdx > 0 && "border-t border-gray-200")}>
                  <div className={cn("px-4 py-2 flex items-center justify-between", isCurrent ? "bg-primary-50" : "bg-gray-50/50")}>
                    <div className="flex items-center gap-1.5">
                      {isCurrent && <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />}
                      <span className={cn("text-xs font-semibold", isCurrent ? "text-primary-700" : "text-gray-500")}>{label}</span>
                    </div>
                    {students.length > 0 ? (
                      <span className="text-xs text-gray-400">{students.length}명</span>
                    ) : (
                      <span className="text-xs text-gray-300">공강</span>
                    )}
                  </div>
                  {students.length > 0 && (
                    <div className="px-3 py-2 flex flex-col gap-1">
                      {students.map((entry) => {
                        const att = entry.attendance;
                        const style = att ? ATTENDANCE_STYLES[att.status] : null;
                        const colorClass = dailyColorMap.get(entry.studentId) || "";
                        const remaining = entry.remainingClasses;
                        return (
                          <button
                            key={entry.studentId}
                            onClick={(e) => openPopover(e, entry.studentId, dailyDate, entry.scheduleTime || "14:00")}
                            className={cn(
                              "text-xs font-medium px-3 py-2.5 rounded-md border transition-all w-full text-left",
                              style ? style.bg : colorClass,
                              popover?.studentId === entry.studentId && popover?.dateStr === dailyDate && popover?.timeSlot === (entry.scheduleTime || "14:00") && "ring-2 ring-primary-400",
                              highlightStudentId && highlightStudentId === entry.studentId && "ring-2 ring-primary-400",
                              highlightStudentId && highlightStudentId !== entry.studentId && "opacity-30",
                            )}
                          >
                            <span className="flex items-center justify-between gap-1 w-full">
                              <span className="flex items-center gap-1.5">
                                <span>{entry.studentName}</span>
                                {remaining != null && (
                                  <span className={cn("text-[10px] opacity-60", remaining <= 2 && "text-red-600 opacity-100 font-semibold")}>
                                    잔여 {remaining}회
                                  </span>
                                )}
                              </span>
                              {style && <span className="text-[10px] opacity-75">{style.label}</span>}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                );
              })}
            </Card>
          )}
        </div>
      )}

      {isLoading ? (
        view !== "daily" && (
          <div className="animate-pulse space-y-4"><div className="h-64 bg-gray-200 rounded-xl" /></div>
        )
      ) : schedule.length === 0 ? (
        view !== "daily" && (
          <EmptyState icon={Clock} title="등록된 시간표가 없습니다" description="활성 학생의 수강권이 없습니다." />
        )
      ) : (
        <>
          {/* ─── WEEKLY VIEW ─────────────────────── */}
          {view === "weekly" && (() => {
              const dayOffsetMap: Record<string, number> = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5 };
              const weekDayInfos = WEEKDAYS.map((day) => {
                const offset = dayOffsetMap[day] ?? 0;
                const date = getWeekDate(offset);
                const dateStr = toDateStr(date.getFullYear(), date.getMonth(), date.getDate());
                const info = getDateInfo(dateStr, day);
                return { day, date, dateStr, info };
              });

              return (
            <>
              <div className="flex items-center justify-center gap-3 mb-4">
                <button onClick={() => setWeekMonday((m) => addWeeks(m, -1))} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <button
                  onClick={() => setWeekMonday(getMonday(today))}
                  className={cn("text-sm font-medium px-3 py-1 rounded-full transition-colors", isThisWeek ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:bg-gray-100")}
                >이번 주</button>
                <span className="text-sm font-semibold text-gray-900 truncate min-w-0">{formatWeekRange(weekMonday)}</span>
                <button onClick={() => setWeekMonday((m) => addWeeks(m, 1))} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Desktop Grid with DnD */}
              <Card padding={false} className="hidden sm:block overflow-x-auto">
                <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <table className="w-full min-w-[600px] table-fixed">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-3 px-3 text-left text-xs font-semibold text-gray-500 w-16">시간</th>
                      {weekDayInfos.map(({ day, date, dateStr, info }) => {
                        const isToday = dateStr === todayStr;
                        return (
                          <th key={day} className={cn(
                            "py-3 px-2 text-center text-sm font-semibold",
                            isToday ? "text-primary-700 bg-primary-50"
                              : info.type === "holiday" ? "text-red-500 bg-red-50/50"
                              : info.type === "vacation" ? "text-blue-500 bg-blue-50/50"
                              : "text-gray-700",
                          )}>
                            <button
                              onClick={() => { setDailyDate(dateStr); setView("daily"); }}
                              className="w-full cursor-pointer hover:opacity-70 transition-opacity"
                            >
                              <div className="flex items-center justify-center gap-1">
                                <span>{DAY_LABELS[day]}</span>
                                <span className={cn("text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full", isToday && "bg-primary-600 text-white")}>
                                  {date.getDate()}
                                </span>
                              </div>
                              {info.type === "holiday" && <div className="text-[10px] font-normal text-red-500 mt-0.5">{info.label}</div>}
                              {info.type === "vacation" && <div className="text-[10px] font-normal text-blue-500 mt-0.5">{info.label}</div>}
                              {info.type === "normal" && <div className="text-xs font-normal text-gray-400 mt-0.5">{getDayCount(day, dateStr)}명</div>}
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {TIME_SLOTS.map((time) => (
                      <tr key={time} className="border-b border-gray-100 last:border-0">
                        <td className="py-3 px-3 text-sm font-medium text-gray-500 align-top">{TIME_LABELS[time]}</td>
                        {weekDayInfos.map(({ day, dateStr, info }) => {
                          const isToday = dateStr === todayStr;
                          const isOff = info.type !== "normal";
                          const students = getGridEntries(time, day, dateStr);
                          const cellId = `${day}-${time}`;
                          return (
                            <DroppableCell
                              key={day}
                              id={cellId}
                              day={day}
                              time={time}
                              isToday={isToday}
                              disabled={isOff}
                              className={cn(isOff && !isToday && "bg-gray-50/50")}
                            >
                              {students.map((s) => {
                                // Only show attendance if chip is NOT from a different-date override
                                const overrideForChip = weekOverrides.find(
                                  o => o.studentId === s.studentId && o.newDate === dateStr && o.newTime === time
                                );
                                const isFromDifferentDate = overrideForChip && overrideForChip.originalDate !== dateStr;
                                const att = isFromDifferentDate ? null : weekAttendance?.[dateStr]?.[`${s.studentId}_${time}`];
                                const attStyle = att ? ATTENDANCE_STYLES[att.status] : null;
                                const chipId = `${s.studentId}-${day}-${time}`;
                                return (
                                  <DraggableChip
                                    key={chipId}
                                    id={chipId}
                                    studentId={s.studentId}
                                    studentName={s.studentName}
                                    colorClass={attStyle ? attStyle.bg : (studentColorMap.get(s.studentId) || STUDENT_COLORS[0])}
                                    day={day}
                                    time={time}
                                    onClick={(e) => openPopover(e, s.studentId, dateStr, time)}
                                    suffix={attStyle ? <span className="text-[10px] opacity-75">{attStyle.label}</span> : undefined}
                                    className={cn(
                                      "w-full",
                                      highlightStudentId && highlightStudentId === s.studentId && "ring-2 ring-primary-400",
                                      highlightStudentId && highlightStudentId !== s.studentId && "opacity-30",
                                    )}
                                    disabled={!!att}
                                  />
                                );
                              })}
                            </DroppableCell>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <DragOverlay dropAnimation={null}>
                  {activeDragEntry && (
                    <div className={cn("text-xs font-medium px-2 py-1.5 rounded-md border shadow-lg", activeDragEntry.colorClass)}>
                      {activeDragEntry.studentName}
                    </div>
                  )}
                </DragOverlay>
                </DndContext>
              </Card>

              {/* Mobile */}
              <div className="sm:hidden space-y-3">
                {weekDayInfos.map(({ day, date, dateStr, info }) => {
                  const isToday = dateStr === todayStr;
                  const isOff = info.type !== "normal";
                  const dayStudents: { time: string; entries: ScheduleEntry[] }[] = [];
                  if (!isOff) {
                    for (const time of TIME_SLOTS) {
                      const entries = getGridEntries(time, day, dateStr);
                      if (entries.length > 0) dayStudents.push({ time, entries });
                    }
                  }
                  return (
                    <Card key={day} padding={false}>
                      <button
                        onClick={() => { setDailyDate(dateStr); setView("daily"); }}
                        className={cn(
                          "w-full px-4 py-2.5 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity",
                          isToday && "bg-primary-50",
                          info.type === "holiday" && !isToday && "bg-red-50/50",
                          info.type === "vacation" && !isToday && "bg-blue-50/50",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-bold", isToday ? "text-primary-700" : info.type === "holiday" ? "text-red-500" : info.type === "vacation" ? "text-blue-500" : "text-gray-900")}>
                            {DAY_LABELS[day]}요일 {date.getMonth() + 1}/{date.getDate()}
                          </span>
                          {isToday && <Badge variant="active" size="sm">오늘</Badge>}
                        </div>
                        {isOff ? (
                          <span className={cn("text-xs", info.type === "holiday" ? "text-red-500" : info.type === "vacation" ? "text-blue-500" : "text-gray-400")}>{info.label ?? "비수업일"}</span>
                        ) : (
                          <span className="text-xs text-gray-500">{getDayCount(day, dateStr)}명</span>
                        )}
                      </button>
                      {dayStudents.length > 0 && (
                        <div className="divide-y divide-gray-50">
                          {dayStudents.map(({ time, entries }) => (
                            <div key={time} className="px-4 py-2.5 flex items-start gap-3">
                              <span className="text-xs font-medium text-gray-400 w-8 pt-0.5 flex-shrink-0">{TIME_LABELS[time]}</span>
                              <div className="flex flex-wrap gap-1.5">
                                {entries.map((s) => {
                                  const att = weekAttendance?.[dateStr]?.[`${s.studentId}_${time}`];
                                  const style = att ? ATTENDANCE_STYLES[att.status] : null;
                                  return (
                                    <button
                                      key={`${s.studentId}_${time}`}
                                      onClick={(e) => openPopover(e, s.studentId, dateStr, time)}
                                      className={cn(
                                        "text-xs font-medium px-2.5 py-2 rounded-md border transition-all flex items-center gap-1",
                                        style ? style.bg : studentColorMap.get(s.studentId),
                                        highlightStudentId && highlightStudentId === s.studentId && "ring-2 ring-primary-400",
                                        highlightStudentId && highlightStudentId !== s.studentId && "opacity-30",
                                      )}
                                    >
                                      <span>{s.studentName}</span>
                                      {style && <span className="text-[10px] opacity-75">{style.label}</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </>
              );
          })()}

          {/* ─── MONTHLY VIEW ────────────────────── */}
          {view === "monthly" && (
            <>
              <div className="flex items-center justify-center gap-3 mb-4">
                <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 transition-colors"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
                <button onClick={goToday} className={cn("text-sm font-medium px-3 py-1 rounded-full transition-colors", monthYear.year === today.getFullYear() && monthYear.month === today.getMonth() ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:bg-gray-100")}>이번달</button>
                <span className="text-lg font-bold text-gray-900">{monthYear.year}년 {MONTH_NAMES[monthYear.month]}</span>
                <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 transition-colors"><ChevronRight className="w-5 h-5 text-gray-600" /></button>
              </div>
              <Card padding={false}>
                <div className="grid grid-cols-7 border-b border-gray-200">
                  {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
                    <div key={d} className={cn("py-2 text-center text-xs font-semibold", i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-500")}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {getCalendarDays(monthYear.year, monthYear.month).map((cell, idx) => {
                    const dateStr = toDateStr(cell.year, cell.month, cell.date);
                    const dayName = DAY_NAMES[new Date(cell.year, cell.month, cell.date).getDay()];
                    const info = getDateInfo(dateStr, dayName);
                    const students = info.type === "normal" ? getStudentsForDay(dayName, dateStr) : [];
                    const isToday = dateStr === todayStr;
                    const dayOfWeek = new Date(cell.year, cell.month, cell.date).getDay();
                    return (
                      <button
                        key={idx}
                        onClick={() => { setWeekMonday(getMonday(new Date(cell.year, cell.month, cell.date))); setView("weekly"); }}
                        className={cn(
                          "min-h-[72px] sm:min-h-[90px] p-1.5 border-b border-r border-gray-100 transition-colors text-left hover:bg-primary-50/40",
                          !cell.isCurrentMonth && "bg-gray-50/50",
                          info.type === "holiday" && cell.isCurrentMonth && "bg-red-50/60",
                          info.type === "vacation" && cell.isCurrentMonth && "bg-blue-50/60",
                          info.type === "disabled" && cell.isCurrentMonth && "bg-gray-50",
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <span className={cn(
                            "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                            !cell.isCurrentMonth && "text-gray-300",
                            cell.isCurrentMonth && dayOfWeek === 0 && "text-red-500",
                            cell.isCurrentMonth && dayOfWeek === 6 && "text-blue-500",
                            cell.isCurrentMonth && dayOfWeek > 0 && dayOfWeek < 6 && "text-gray-700",
                            isToday && "bg-primary-600 text-white",
                          )}>{cell.date}</span>
                          {cell.isCurrentMonth && students.length > 0 && <span className="text-[10px] font-medium text-primary-600 bg-primary-50 rounded px-1">{students.length}명</span>}
                        </div>
                        {cell.isCurrentMonth && info.type === "holiday" && <div className="mt-0.5 text-[10px] font-medium text-red-600 truncate">{info.label}</div>}
                        {cell.isCurrentMonth && info.type === "vacation" && <div className="mt-0.5 text-[10px] font-medium text-blue-600 truncate">{info.label}</div>}
                      </button>
                    );
                  })}
                </div>
              </Card>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-200" /> 공휴일</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-200" /> 방학</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 border border-gray-200" /> 비수업일</span>
              </div>
            </>
          )}

          {/* ─── YEARLY VIEW ─────────────────────── */}
          {view === "yearly" && (
            <>
              <div className="flex items-center justify-center gap-3 mb-4">
                <button onClick={() => setYearView((y) => y - 1)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
                <button onClick={() => setYearView(today.getFullYear())} className={cn("text-sm font-medium px-3 py-1 rounded-full transition-colors", yearView === today.getFullYear() ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:bg-gray-100")}>올해</button>
                <span className="text-lg font-bold text-gray-900">{yearView}년</span>
                <button onClick={() => setYearView((y) => y + 1)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors"><ChevronRight className="w-5 h-5 text-gray-600" /></button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 12 }, (_, m) => {
                  const cells = getCalendarDays(yearView, m);
                  let classDayCount = 0;
                  let holidayCount = 0;
                  for (const cell of cells) {
                    if (!cell.isCurrentMonth) continue;
                    const dateStr = toDateStr(cell.year, cell.month, cell.date);
                    const dayName = DAY_NAMES[new Date(cell.year, cell.month, cell.date).getDay()];
                    const info = getDateInfo(dateStr, dayName);
                    if (info.type === "normal" && getStudentsForDay(dayName, dateStr).length > 0) classDayCount++;
                    if (info.type === "holiday") holidayCount++;
                  }
                  return (
                    <Card key={m} padding={false} className="overflow-hidden">
                      <button onClick={() => { setMonthYear({ year: yearView, month: m }); setView("monthly"); }} className="w-full text-left hover:bg-gray-50 transition-colors">
                        <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                          <span className={cn("text-sm font-bold", yearView === today.getFullYear() && m === today.getMonth() ? "text-primary-700" : "text-gray-900")}>{MONTH_NAMES[m]}</span>
                          <span className="text-[10px] text-gray-400">{classDayCount}일 수업{holidayCount > 0 ? ` · ${holidayCount}일 휴일` : ""}</span>
                        </div>
                        <div className="px-2 py-1.5">
                          <div className="grid grid-cols-7 mb-0.5">
                            {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                              <div key={d} className="text-center text-[9px] text-gray-400 font-medium">{d}</div>
                            ))}
                          </div>
                          <div className="grid grid-cols-7 gap-px">
                            {cells.map((cell, idx) => {
                              const dateStr = toDateStr(cell.year, cell.month, cell.date);
                              const dayName = DAY_NAMES[new Date(cell.year, cell.month, cell.date).getDay()];
                              const info = cell.isCurrentMonth ? getDateInfo(dateStr, dayName) : null;
                              const hasClass = info?.type === "normal" && getStudentsForDay(dayName, dateStr).length > 0;
                              const isToday = dateStr === todayStr;
                              return (
                                <div key={idx} className="flex items-center justify-center h-5">
                                  <span className={cn(
                                    "text-[10px] w-4.5 h-4.5 flex items-center justify-center rounded-full leading-none",
                                    !cell.isCurrentMonth && "text-transparent",
                                    cell.isCurrentMonth && info?.type === "holiday" && "text-red-500 bg-red-50",
                                    cell.isCurrentMonth && info?.type === "vacation" && "text-blue-500 bg-blue-50",
                                    cell.isCurrentMonth && info?.type === "disabled" && "text-gray-300",
                                    cell.isCurrentMonth && hasClass && "text-gray-700 font-medium",
                                    cell.isCurrentMonth && info?.type === "normal" && !hasClass && "text-gray-400",
                                    isToday && "bg-primary-600 !text-white",
                                  )}>{cell.date}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </button>
                    </Card>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-50 border border-red-200" /> 공휴일</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-200" /> 방학</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-primary-600 border" /> 오늘</span>
              </div>
            </>
          )}
        </>
      )}

      {/* ─── SchedulePopover (unified daily/weekly) ── */}
      {popover && (
        <SchedulePopover
          anchorRect={popover.anchorRect}
          onClose={() => setPopover(null)}
          onNavigate={() => {
            const sid = popover.studentId;
            setPopover(null);
            router.push(`/students/${sid}`);
          }}
          currentAttendanceStatus={popoverAttStatus}
          attendanceButtons={ATTENDANCE_BUTTONS}
          onAttendance={(status) => {
            attendanceMutation.mutate({ studentId: popover.studentId, date: popover.dateStr, status, timeSlot: popover.timeSlot });
          }}
        />
      )}

      {/* ─── DnD Confirmation Modal ── */}
      <Modal
        isOpen={!!dndConfirm}
        onClose={() => { setDndConfirm(null); setScheduleError(null); }}
        title={`${dndConfirm?.studentName ?? ""} — 스케줄 이동`}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setDndConfirm(null); setScheduleError(null); }}>취소</Button>
          </>
        }
      >
        {dndConfirm && (
          <div className="space-y-4">
            <div className="text-sm text-gray-700 text-center py-2">
              <span className="font-semibold">{DAY_LABELS[dndConfirm.from.day]} {TIME_LABELS[dndConfirm.from.time]}</span>
              <span className="mx-2 text-gray-400">→</span>
              <span className="font-semibold">{DAY_LABELS[dndConfirm.to.day]} {TIME_LABELS[dndConfirm.to.time]}</span>
            </div>
            {scheduleError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {scheduleError}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleDndRecurring}
                disabled={scheduleMutation.isPending}
                className="flex-1 py-3 text-sm font-semibold rounded-xl border-2 border-primary-500 bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors disabled:opacity-50"
              >
                앞으로 계속
              </button>
              <button
                onClick={handleDndOnce}
                disabled={overrideMutation.isPending}
                className="flex-1 py-3 text-sm font-semibold rounded-xl border-2 border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                이번만 변경
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
