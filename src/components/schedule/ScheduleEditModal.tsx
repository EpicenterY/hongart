"use client";

import { useState, useEffect } from "react";
import { Modal, Button } from "@/components/ui";
import { cn } from "@/lib/utils";

interface ScheduleSlot { day: string; time: string; }

const ALL_DAYS = [
  { key: "MON", label: "월" },
  { key: "TUE", label: "화" },
  { key: "WED", label: "수" },
  { key: "THU", label: "목" },
  { key: "FRI", label: "금" },
  { key: "SAT", label: "토" },
];

const TIME_OPTIONS = [
  { value: "14:00", label: "2시" },
  { value: "15:00", label: "3시" },
  { value: "16:00", label: "4시" },
  { value: "17:00", label: "5시" },
  { value: "18:00", label: "6시" },
];

type ChangeMode = "recurring" | "once";

interface ScheduleEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  currentSchedule: ScheduleSlot[];
  enabledDays: string[];
  showModeChoice?: boolean; // true = 일간 뷰 (이번만/앞으로 선택)
  selectedDate?: string;    // 일간 뷰에서만 사용
  onSaveRecurring: (schedule: ScheduleSlot[]) => void;
  onSaveOnce?: (data: { originalDate: string; newDate: string; newTime: string }) => void;
  isPending?: boolean;
}

export function ScheduleEditModal({
  isOpen,
  onClose,
  studentName,
  currentSchedule,
  enabledDays,
  showModeChoice = false,
  selectedDate,
  onSaveRecurring,
  onSaveOnce,
  isPending = false,
}: ScheduleEditModalProps) {
  const [mode, setMode] = useState<ChangeMode>("recurring");
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [onceTime, setOnceTime] = useState("15:00");
  const [onceDate, setOnceDate] = useState("");

  useEffect(() => {
    if (isOpen) {
      setSchedule([...currentSchedule]);
      setMode("recurring");
      if (selectedDate) {
        setOnceDate(selectedDate);
        const daySlot = currentSchedule.find(s => {
          const d = new Date(selectedDate + "T00:00:00");
          const DAY_MAP = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
          return s.day === DAY_MAP[d.getDay()];
        });
        setOnceTime(daySlot?.time || "15:00");
      }
    }
  }, [isOpen, currentSchedule, selectedDate]);

  const toggleDay = (day: string) => {
    setSchedule((prev) => {
      const existing = prev.find(s => s.day === day);
      if (existing) {
        return prev.filter(s => s.day !== day);
      }
      // Add with default time (most common time in current schedule, or "15:00")
      const defaultTime = prev.length > 0 ? prev[0].time : "15:00";
      return [...prev, { day, time: defaultTime }];
    });
  };

  const setDayTime = (day: string, time: string) => {
    setSchedule((prev) =>
      prev.map(s => s.day === day ? { ...s, time } : s)
    );
  };

  const DAYS = ALL_DAYS.filter(d => enabledDays.includes(d.key));
  const selectedDays = schedule.map(s => s.day);

  const handleSave = () => {
    if (mode === "recurring") {
      onSaveRecurring(schedule);
    } else if (onSaveOnce && selectedDate) {
      onSaveOnce({
        originalDate: selectedDate,
        newDate: onceDate || selectedDate,
        newTime: onceTime,
      });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${studentName} — 시간 변경`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button onClick={handleSave} loading={isPending}>
            {mode === "once" ? "이번만 변경" : "변경 저장"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Mode choice (daily view only) */}
        {showModeChoice && (
          <div className="flex gap-2">
            <button
              onClick={() => setMode("recurring")}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-lg border-2 transition-colors",
                mode === "recurring"
                  ? "border-primary-500 bg-primary-50 text-primary-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              )}
            >
              앞으로 계속
            </button>
            <button
              onClick={() => setMode("once")}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-lg border-2 transition-colors",
                mode === "once"
                  ? "border-primary-500 bg-primary-50 text-primary-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              )}
            >
              이번만 변경
            </button>
          </div>
        )}

        {mode === "recurring" ? (
          <>
            {/* Day selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">요일 선택</label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => toggleDay(day.key)}
                    className={cn(
                      "w-10 h-10 rounded-lg text-sm font-medium transition-colors",
                      selectedDays.includes(day.key)
                        ? "bg-primary-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Per-day time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">요일별 시간</label>
              <div className="space-y-2">
                {schedule
                  .sort((a, b) => DAYS.findIndex(d => d.key === a.day) - DAYS.findIndex(d => d.key === b.day))
                  .map((slot) => {
                    const dayLabel = DAYS.find(d => d.key === slot.day)?.label || slot.day;
                    return (
                      <div key={slot.day} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700 w-8">{dayLabel}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {TIME_OPTIONS.map((t) => (
                            <button
                              key={t.value}
                              type="button"
                              onClick={() => setDayTime(slot.day, t.value)}
                              className={cn(
                                "px-3 h-8 rounded-md text-xs font-medium transition-colors",
                                slot.time === t.value
                                  ? "bg-primary-600 text-white"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              )}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                {schedule.length === 0 && (
                  <p className="text-sm text-gray-400">요일을 선택하세요</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Once-only: date + time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">변경 날짜</label>
              <input
                type="date"
                value={onceDate}
                onChange={(e) => setOnceDate(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">변경 시간</label>
              <div className="flex flex-wrap gap-2">
                {TIME_OPTIONS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setOnceTime(t.value)}
                    className={cn(
                      "px-4 h-10 rounded-lg text-sm font-medium transition-colors",
                      onceTime === t.value
                        ? "bg-primary-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
