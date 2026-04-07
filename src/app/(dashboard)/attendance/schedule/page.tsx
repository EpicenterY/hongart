"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Clock, Calendar, User } from "lucide-react";
import { Card, Badge, EmptyState, Tabs } from "@/components/ui";
import { cn } from "@/lib/utils";

// ── Shared Types & Constants ──

interface ScheduleEntry {
  studentId: string;
  studentName: string;
  scheduleTime: string;
  scheduleDays: string[];
  daysPerWeek: number;
}

interface AttendanceEntry {
  studentId: string;
  studentName: string;
  scheduleTime: string | null;
  attendance: { id: string; status: string; note: string | null } | null;
  totalSessions: number | null;
  usedSessions: number | null;
  remainingClasses: number | null;
  isPaid: boolean;
}

interface AttendanceResponse {
  status: "normal" | "holiday" | "vacation" | "disabled_day";
  entries: AttendanceEntry[];
  holiday?: string;
  vacation?: string;
}

type Status = "PRESENT" | "ABSENT";

const ATTENDANCE_BUTTONS = [
  { status: "PRESENT", label: "출석", color: "bg-green-500 hover:bg-green-600" },
  { status: "ABSENT", label: "결석", color: "bg-red-500 hover:bg-red-600" },
];

const ATTENDANCE_STYLES: Record<string, { bg: string; label: string }> = {
  PRESENT: { bg: "bg-green-100 text-green-800 border-green-300", label: "출석" },
  ABSENT: { bg: "bg-red-100 text-red-800 border-red-300", label: "결석" },
  LATE: { bg: "bg-yellow-100 text-yellow-800 border-yellow-300", label: "지각" },
};

const ALL_WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const DAY_LABELS: Record<string, string> = {
  MON: "월", TUE: "화", WED: "수", THU: "목", FRI: "금", SAT: "토", SUN: "일",
};
const DAY_MAP = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

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

// ── Helpers ──

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatKoreanDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_LABELS[DAY_MAP[d.getDay()]]})`
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

function getTodayStr(): string {
  return toDateStr(new Date());
}

function getTodayDay(): string {
  return DAY_MAP[new Date().getDay()];
}

// ── Component ──

export default function SchedulePage() {
  const todayStr = getTodayStr();
  const todayDay = getTodayDay();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState("weekly");
  useEffect(() => {
    if (window.innerWidth < 640) setViewMode("daily");
  }, []);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const isToday = selectedDate === todayStr;

  // ── Data: Class days setting ──
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

  // ── Data: Weekly schedule (for weekly view) ──
  const { data: schedule = [], isLoading: scheduleLoading } = useQuery<ScheduleEntry[]>({
    queryKey: ["schedule", "weekly"],
    queryFn: async () => {
      const res = await fetch("/api/schedule/weekly");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // ── Data: Attendance for selected date (for daily view) ──
  const { data: attendanceResponse, isLoading: attendanceLoading } = useQuery<AttendanceResponse>({
    queryKey: ["attendance", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/attendance?date=${selectedDate}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: viewMode === "daily",
  });

  const attendanceEntries = attendanceResponse?.entries ?? [];
  const dateStatus = attendanceResponse?.status ?? "normal";

  // ── Mutation: Attendance check ──
  const mutation = useMutation({
    mutationFn: async ({ studentId, status }: { studentId: string; status: Status }) => {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, date: selectedDate, status }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onMutate: async ({ studentId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["attendance", selectedDate] });
      const previous = queryClient.getQueryData<AttendanceResponse>(["attendance", selectedDate]);
      queryClient.setQueryData<AttendanceResponse>(["attendance", selectedDate], (old) => {
        if (!old) return old;
        const COUNTED = ["PRESENT", "LATE"];
        return {
          ...old,
          entries: old.entries.map((entry) => {
            if (entry.studentId !== studentId) return entry;
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
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["attendance", selectedDate], context.previous);
      }
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ["attendance", selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["weekAttendance"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student", variables.studentId] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["unpaid-count"] });
    },
  });

  // ── Computed: Weekly grid ──
  const studentColorMap = new Map<string, string>();
  schedule.forEach((entry, i) => {
    if (!studentColorMap.has(entry.studentId)) {
      studentColorMap.set(entry.studentId, STUDENT_COLORS[i % STUDENT_COLORS.length]);
    }
  });

  const grid: Record<string, Record<string, ScheduleEntry[]>> = {};
  for (const time of TIME_SLOTS) {
    grid[time] = {};
    for (const day of ALL_WEEKDAYS) {
      grid[time][day] = [];
    }
  }
  for (const entry of schedule) {
    for (const day of entry.scheduleDays) {
      if (grid[entry.scheduleTime]?.[day]) {
        grid[entry.scheduleTime][day].push(entry);
      }
    }
  }

  const dayCounts: Record<string, number> = {};
  for (const day of ALL_WEEKDAYS) {
    const set = new Set<string>();
    for (const time of TIME_SLOTS) {
      for (const e of (grid[time][day] || [])) set.add(e.studentId);
    }
    dayCounts[day] = set.size;
  }

  // ── Computed: Daily attendance groups ──
  const dailyColorMap = new Map<string, string>();
  attendanceEntries.forEach((entry, i) => {
    if (!dailyColorMap.has(entry.studentId)) {
      dailyColorMap.set(entry.studentId, STUDENT_COLORS[i % STUDENT_COLORS.length]);
    }
  });

  const timeMap = new Map<string, AttendanceEntry[]>();
  for (const entry of attendanceEntries) {
    const time = entry.scheduleTime || "00:00";
    if (!timeMap.has(time)) timeMap.set(time, []);
    timeMap.get(time)!.push(entry);
  }

  const usedTimes = Array.from(timeMap.keys()).sort();
  const minSlot = usedTimes.length > 0 ? TIME_SLOTS.indexOf(usedTimes[0]) : -1;
  const maxSlot = usedTimes.length > 0 ? TIME_SLOTS.indexOf(usedTimes.at(-1)!) : -1;
  const displaySlots = minSlot >= 0 && maxSlot >= 0 ? TIME_SLOTS.slice(minSlot, maxSlot + 1) : [];

  const timeGroups = displaySlots.map((time) => ({
    time,
    label: TIME_LABELS[time] || time,
    students: timeMap.get(time) || [],
  }));

  const presentCount = attendanceEntries.filter(
    (e) => e.attendance?.status === "PRESENT"
  ).length;
  const totalCount = attendanceEntries.length;

  const viewTabs = [
    { key: "daily", label: "일간" },
    { key: "weekly", label: "주간" },
  ];

  return (
    <div className="px-4 py-6 lg:px-8">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">시간표</h1>
        <Tabs tabs={viewTabs} activeTab={viewMode} onTabChange={setViewMode} />
      </div>

      {/* ── Daily View ── */}
      {viewMode === "daily" && (
        <>
          {/* Date Navigator */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <button onClick={() => setSelectedDate(addDaysStr(selectedDate, -1))} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={() => setSelectedDate(todayStr)}
              className={cn("text-sm font-medium px-3 py-1 rounded-full transition-colors", isToday ? "bg-primary-100 text-primary-700" : "text-gray-500 hover:bg-gray-100")}
            >
              오늘
            </button>
            <div className="relative">
              <input type="date" value={selectedDate} onChange={(e) => e.target.value && setSelectedDate(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full" />
              <span className="text-sm font-semibold text-gray-900 pointer-events-none">{formatKoreanDate(selectedDate)}</span>
            </div>
            <button onClick={() => setSelectedDate(addDaysStr(selectedDate, 1))} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Daily Content */}
          {attendanceLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-64 bg-gray-200 rounded-xl" />
            </div>
          ) : dateStatus === "holiday" ? (
            <Card>
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 mb-4">
                <span className="text-sm font-semibold text-red-700">공휴일 — {attendanceResponse?.holiday}</span>
              </div>
              <EmptyState icon={Calendar} title="공휴일입니다" description={`${formatKoreanDate(selectedDate)}은(는) ${attendanceResponse?.holiday}로 수업이 없습니다.`} />
            </Card>
          ) : dateStatus === "vacation" ? (
            <Card>
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 mb-4">
                <span className="text-sm font-semibold text-blue-700">방학 — {attendanceResponse?.vacation}</span>
              </div>
              <EmptyState icon={Calendar} title="방학 기간입니다" description={`${formatKoreanDate(selectedDate)}은(는) ${attendanceResponse?.vacation} 기간으로 수업이 없습니다.`} />
            </Card>
          ) : dateStatus === "disabled_day" ? (
            <Card>
              <EmptyState icon={Calendar} title="수업이 없는 요일입니다" description={`${formatKoreanDate(selectedDate)}은(는) 수업이 없는 요일입니다.`} />
            </Card>
          ) : attendanceEntries.length === 0 ? (
            <Card>
              <EmptyState icon={Calendar} title="수업이 없습니다" description={`${formatKoreanDate(selectedDate)}에는 예정된 수업이 없습니다.`} />
            </Card>
          ) : (
            <Card padding={false}>
              {timeGroups.map(({ time, label, students }, groupIdx) => (
                <div key={time} className={cn(groupIdx > 0 && "border-t border-gray-200")}>
                  <div className="px-4 py-2 bg-gray-50/50 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500">{label}</span>
                    {students.length > 0 ? (
                      <span className="text-xs text-gray-400">{students.length}명</span>
                    ) : (
                      <span className="text-xs text-gray-300">공강</span>
                    )}
                  </div>
                  {students.length > 0 && (
                    <div className="divide-y divide-gray-50">
                      {students.map((entry) => {
                        const currentStatus = entry.attendance?.status as Status | undefined;
                        const attStyle = currentStatus ? ATTENDANCE_STYLES[currentStatus] : null;
                        const colorClass = dailyColorMap.get(entry.studentId) || "";
                        return (
                          <div key={entry.studentId} className="px-4 py-2.5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={cn("text-xs font-medium px-2.5 py-1 rounded-md border hover:opacity-80 flex items-center gap-1 min-w-0", attStyle ? attStyle.bg : colorClass)}>
                                <span className="truncate">{entry.studentName}</span>
                                {attStyle && <span className="text-[10px] opacity-75 flex-shrink-0">{attStyle.label}</span>}
                              </span>
                              {!entry.isPaid ? (
                                <Badge variant="overdue" size="sm">미결제</Badge>
                              ) : entry.remainingClasses !== null && (
                                <Badge variant={entry.remainingClasses <= 2 ? "overdue" : "pending"} size="sm">잔여 {entry.remainingClasses}회</Badge>
                              )}
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0">
                              {ATTENDANCE_BUTTONS.map((btn) => {
                                const isActive = currentStatus === btn.status;
                                return (
                                  <button
                                    key={btn.status}
                                    onClick={() => mutation.mutate({ studentId: entry.studentId, status: btn.status as Status })}
                                    disabled={mutation.isPending}
                                    className={cn(
                                      "px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors",
                                      isActive ? cn(btn.color, "text-white") : "text-gray-400 border border-gray-200 bg-white hover:bg-gray-50",
                                    )}
                                  >
                                    {btn.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
              {totalCount > 0 && (
                <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50/50 flex justify-end">
                  <Badge variant={presentCount === totalCount ? "active" : "pending"} size="md">
                    출석 {presentCount}/{totalCount}
                  </Badge>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* ── Weekly View ── */}
      {viewMode === "weekly" && (
        <>
          {scheduleLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-64 bg-gray-200 rounded-xl" />
            </div>
          ) : schedule.length === 0 ? (
            <EmptyState icon={Clock} title="등록된 시간표가 없습니다" description="활성 학생의 수강권이 없습니다." />
          ) : (
            <>
              {/* Desktop Grid */}
              <Card padding={false} className="hidden sm:block overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-3 px-3 text-left text-xs font-semibold text-gray-500 w-16">시간</th>
                      {WEEKDAYS.map((day) => (
                        <th key={day} className={cn("py-3 px-2 text-center text-sm font-semibold", day === todayDay ? "text-primary-700 bg-primary-50" : "text-gray-700")}>
                          <div>{DAY_LABELS[day]}</div>
                          <div className="text-xs font-normal text-gray-400 mt-0.5">{dayCounts[day]}명</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TIME_SLOTS.map((time) => (
                      <tr key={time} className="border-b border-gray-100 last:border-0">
                        <td className="py-3 px-3 text-sm font-medium text-gray-500 align-top">{TIME_LABELS[time]}</td>
                        {WEEKDAYS.map((day) => {
                          const students = grid[time][day] || [];
                          return (
                            <td key={day} className={cn("py-2 px-2 align-top", day === todayDay && "bg-primary-50/50")}>
                              <div className="flex flex-col gap-1 min-h-[40px]">
                                {students.map((s) => (
                                  <a key={s.studentId} href={`/students/${s.studentId}`} className={cn("text-xs font-medium px-2 py-1.5 rounded-md border transition-colors hover:opacity-80", studentColorMap.get(s.studentId))}>
                                    {s.studentName}
                                  </a>
                                ))}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              {/* Mobile: Day-by-day cards */}
              <div className="sm:hidden space-y-3">
                {WEEKDAYS.map((day) => {
                  const dayStudents: { time: string; entries: ScheduleEntry[] }[] = [];
                  for (const time of TIME_SLOTS) {
                    if ((grid[time][day] || []).length > 0) {
                      dayStudents.push({ time, entries: grid[time][day] });
                    }
                  }
                  if (dayStudents.length === 0) return null;
                  return (
                    <Card key={day} padding={false}>
                      <div className={cn("px-4 py-2.5 border-b border-gray-100 flex items-center justify-between", day === todayDay && "bg-primary-50")}>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-bold", day === todayDay ? "text-primary-700" : "text-gray-900")}>{DAY_LABELS[day]}요일</span>
                          {day === todayDay && <Badge variant="active" size="sm">오늘</Badge>}
                        </div>
                        <span className="text-xs text-gray-500">{dayCounts[day]}명</span>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {dayStudents.map(({ time, entries }) => (
                          <div key={time} className="px-4 py-2.5 flex items-start gap-3">
                            <span className="text-xs font-medium text-gray-400 w-8 pt-0.5 flex-shrink-0">{TIME_LABELS[time]}</span>
                            <div className="flex flex-wrap gap-1.5">
                              {entries.map((s) => (
                                <a key={s.studentId} href={`/students/${s.studentId}`} className={cn("text-xs font-medium px-2.5 py-1 rounded-md border", studentColorMap.get(s.studentId))}>
                                  {s.studentName}
                                </a>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-4">
                <Card>
                  <div className="text-sm font-semibold text-gray-700 mb-2">학생 목록</div>
                  <div className="flex flex-wrap gap-2">
                    {schedule.map((entry) => (
                      <div key={entry.studentId} className={cn("text-xs font-medium px-2.5 py-1.5 rounded-md border flex items-center gap-1.5", studentColorMap.get(entry.studentId))}>
                        <User className="w-3 h-3" />
                        {entry.studentName}
                        <span className="opacity-60">주{entry.daysPerWeek}회 · {entry.scheduleTime}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
