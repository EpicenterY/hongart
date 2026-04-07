"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge, Card, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

interface AttendanceEntry {
  studentId: string;
  studentName: string;
  scheduleTime: string | null;
  attendance: { id: string; status: string; note: string | null } | null;
  totalSessions: number | null;
  usedSessions: number | null;
  remainingClasses: number | null;
  paymentState: string;
}

interface AttendanceResponse {
  status: "normal" | "holiday" | "vacation" | "disabled_day";
  entries: AttendanceEntry[];
  holiday?: string;
  vacation?: string;
}

type Status = "PRESENT" | "ABSENT" | "MAKEUP";

const STATUS_CONFIG: Record<
  Status,
  { label: string; activeColor: string }
> = {
  PRESENT: {
    label: "출석",
    activeColor: "bg-green-600 text-white border-green-600",
  },
  ABSENT: {
    label: "결석",
    activeColor: "bg-red-600 text-white border-red-600",
  },
  MAKEUP: {
    label: "보강",
    activeColor: "bg-purple-600 text-white border-purple-600",
  },
};

const STATUS_ORDER: Status[] = ["PRESENT", "ABSENT", "MAKEUP"];

const TIME_LABELS: Record<string, string> = {
  "14:00": "2시",
  "15:00": "3시",
  "16:00": "4시",
  "17:00": "5시",
  "18:00": "6시",
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

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getToday(): string {
  return toDateStr(new Date());
}

function formatKoreanDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${dayLabels[d.getDay()]})`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

export default function AttendancePage() {
  const today = getToday();
  const [selectedDate, setSelectedDate] = useState(today);
  const queryClient = useQueryClient();
  const isToday = selectedDate === today;

  const { data: response, isLoading } = useQuery<AttendanceResponse>({
    queryKey: ["attendance", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/attendance?date=${selectedDate}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const entries = response?.entries ?? [];
  const dateStatus = response?.status ?? "normal";

  const mutation = useMutation({
    mutationFn: async ({
      studentId,
      status,
    }: {
      studentId: string;
      status: Status;
    }) => {
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
      const previous = queryClient.getQueryData<AttendanceResponse>([
        "attendance",
        selectedDate,
      ]);

      queryClient.setQueryData<AttendanceResponse>(
        ["attendance", selectedDate],
        (old) => {
          if (!old) return old;
          const COUNTED_STATUSES = ["PRESENT", "LATE", "MAKEUP"];
          return {
            ...old,
            entries: old.entries.map((entry) => {
              if (entry.studentId !== studentId) return entry;
              const wasCountedBefore = entry.attendance
                ? COUNTED_STATUSES.includes(entry.attendance.status)
                : false;
              const isCountedNow = COUNTED_STATUSES.includes(status);
              const delta = (isCountedNow ? 1 : 0) - (wasCountedBefore ? 1 : 0);
              return {
                ...entry,
                attendance: {
                  id: entry.attendance?.id || "temp",
                  status,
                  note: entry.attendance?.note || null,
                },
                usedSessions: entry.usedSessions !== null ? entry.usedSessions + delta : null,
                remainingClasses: entry.remainingClasses !== null ? entry.remainingClasses - delta : null,
              };
            }),
          };
        }
      );

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

  const presentCount = entries.filter(
    (e) =>
      e.attendance?.status === "PRESENT" ||
      e.attendance?.status === "MAKEUP"
  ).length;
  const totalCount = entries.length;

  // Build student color map
  const studentColorMap = new Map<string, string>();
  entries.forEach((entry, i) => {
    if (!studentColorMap.has(entry.studentId)) {
      studentColorMap.set(entry.studentId, STUDENT_COLORS[i % STUDENT_COLORS.length]);
    }
  });

  // Group entries by scheduleTime, fill gaps with empty slots
  const timeMap = new Map<string, AttendanceEntry[]>();
  for (const entry of entries) {
    const time = entry.scheduleTime || "00:00";
    if (!timeMap.has(time)) timeMap.set(time, []);
    timeMap.get(time)!.push(entry);
  }

  const TIME_SLOTS = ["14:00", "15:00", "16:00", "17:00", "18:00"];
  const usedTimes = Array.from(timeMap.keys());
  const minSlot = usedTimes.length > 0 ? TIME_SLOTS.indexOf(usedTimes.sort()[0]) : -1;
  const maxSlot = usedTimes.length > 0 ? TIME_SLOTS.indexOf(usedTimes.sort().at(-1)!) : -1;
  const displaySlots = minSlot >= 0 && maxSlot >= 0
    ? TIME_SLOTS.slice(minSlot, maxSlot + 1)
    : [];

  const timeGroups = displaySlots.map((time) => ({
    time,
    label: TIME_LABELS[time] || time,
    students: timeMap.get(time) || [],
  }));

  return (
    <div className="px-4 py-6 lg:px-8">
      {/* Header with date navigation */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">출석 체크</h1>
          <Badge variant={presentCount === totalCount && totalCount > 0 ? "active" : "pending"} size="md">
            출석 {presentCount}/{totalCount}
          </Badge>
        </div>

        {/* Date navigation */}
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-2">
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, -1))}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedDate(today)}
              className={cn(
                "text-sm font-medium px-3 py-1 rounded-full transition-colors",
                isToday
                  ? "bg-primary-100 text-primary-700"
                  : "text-gray-500 hover:bg-gray-100"
              )}
            >
              오늘
            </button>
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full"
              />
              <span className="text-sm font-semibold text-gray-900 pointer-events-none">
                {formatKoreanDate(selectedDate)}
              </span>
            </div>
          </div>

          <button
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl" />
          ))}
        </div>
      ) : dateStatus === "holiday" ? (
        <Card>
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 mb-4">
            <span className="text-sm font-semibold text-red-700">🔴 공휴일 — {response?.holiday}</span>
          </div>
          <EmptyState
            icon={Calendar}
            title="공휴일입니다"
            description={`${formatKoreanDate(selectedDate)}은(는) ${response?.holiday}로 수업이 없습니다.`}
          />
        </Card>
      ) : dateStatus === "vacation" ? (
        <Card>
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 mb-4">
            <span className="text-sm font-semibold text-blue-700">🔵 방학 — {response?.vacation}</span>
          </div>
          <EmptyState
            icon={Calendar}
            title="방학 기간입니다"
            description={`${formatKoreanDate(selectedDate)}은(는) ${response?.vacation} 기간으로 수업이 없습니다.`}
          />
        </Card>
      ) : dateStatus === "disabled_day" ? (
        <Card>
          <EmptyState
            icon={Calendar}
            title="수업이 없는 요일입니다"
            description={`${formatKoreanDate(selectedDate)}은(는) 수업이 없는 요일입니다.`}
          />
        </Card>
      ) : entries.length === 0 ? (
        <Card>
          <EmptyState
            icon={Calendar}
            title="수업이 없습니다"
            description={`${formatKoreanDate(selectedDate)}에는 예정된 수업이 없습니다.`}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {timeGroups.map(({ time, label, students }) => (
            <Card key={time} padding={false}>
              <div className={cn(
                "px-4 py-2.5 flex items-center justify-between",
                students.length > 0 && "border-b border-gray-100"
              )}>
                <span className={cn(
                  "text-sm font-bold",
                  students.length > 0 ? "text-gray-900" : "text-gray-400"
                )}>
                  {label}
                </span>
                {students.length > 0 ? (
                  <span className="text-xs text-gray-500">{students.length}명</span>
                ) : (
                  <span className="text-xs text-gray-400">공강</span>
                )}
              </div>
              {students.length > 0 && <div className="divide-y divide-gray-50">
                {students.map((entry) => {
                  const currentStatus = entry.attendance?.status as Status | undefined;
                  const colorClass = studentColorMap.get(entry.studentId) || "";

                  return (
                    <div
                      key={entry.studentId}
                      className="px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={cn(
                            "text-sm font-medium px-2.5 py-1 rounded-md border truncate",
                            colorClass
                          )}
                        >
                          {entry.studentName}
                        </span>
                        {entry.paymentState === "NEEDS_PAYMENT" || entry.paymentState === "PENDING_CREDIT" ? (
                          <Badge variant="overdue" size="sm">미결제</Badge>
                        ) : entry.remainingClasses !== null && (
                          <Badge
                            variant={entry.remainingClasses <= 2 ? "overdue" : "pending"}
                            size="sm"
                          >
                            잔여 {entry.remainingClasses}회
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        {STATUS_ORDER.map((status) => {
                          const config = STATUS_CONFIG[status];
                          const isActive = currentStatus === status;
                          return (
                            <button
                              key={status}
                              onClick={() =>
                                mutation.mutate({
                                  studentId: entry.studentId,
                                  status,
                                })
                              }
                              disabled={mutation.isPending}
                              className={cn(
                                "min-w-[44px] min-h-[36px] px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors",
                                isActive
                                  ? config.activeColor
                                  : "text-gray-400 border-gray-200 bg-white hover:bg-gray-50"
                              )}
                            >
                              {config.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
