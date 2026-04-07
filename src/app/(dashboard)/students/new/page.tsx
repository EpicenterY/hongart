"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { Button, Input, Card } from "@/components/ui";
import { cn } from "@/lib/utils";

interface Plan {
  daysPerWeek: number;
  label: string;
  monthlyFee: number;
}

const ALL_SCHEDULE_DAYS = [
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

export default function NewStudentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState("");
  const [note, setNote] = useState("");

  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [scheduleDays, setScheduleDays] = useState<string[]>([]);
  const [scheduleTime, setScheduleTime] = useState("15:00");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [nameError, setNameError] = useState("");

  function formatPhone(value: string): string {
    const nums = value.replace(/\D/g, "").slice(0, 11);
    if (nums.length <= 3) return nums;
    if (nums.length <= 7) return `${nums.slice(0, 3)}-${nums.slice(3)}`;
    return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7)}`;
  }

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await fetch("/api/settings/plans");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: classDays } = useQuery<{ enabledDays: string[] }>({
    queryKey: ["classDays"],
    queryFn: async () => {
      const res = await fetch("/api/settings/class-days");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const SCHEDULE_DAYS = ALL_SCHEDULE_DAYS.filter(
    (d) => classDays?.enabledDays.includes(d.key) ?? true,
  );

  const currentPlan = plans.find((p) => p.daysPerWeek === selectedPlan);

  const toggleDay = (day: string) => {
    setScheduleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!currentPlan) throw new Error("플랜을 선택해주세요.");
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: phone || undefined,
          parentPhone: parentPhone || undefined,
          school: school || undefined,
          grade: grade || undefined,
          note: note || undefined,
          subscription: {
            daysPerWeek: currentPlan.daysPerWeek,
            scheduleDays,
            scheduleTime,
            monthlyFee: currentPlan.monthlyFee,
            startDate,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "학생 등록에 실패했습니다.");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      router.push(`/students/${data.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNameError("");

    if (!name.trim()) {
      setNameError("이름을 입력해주세요.");
      return;
    }

    mutation.mutate();
  };

  function formatWon(n: number) {
    return "₩" + n.toLocaleString("ko-KR");
  }

  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto">
      <button
        onClick={() => router.push("/students")}
        className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        학생 목록
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">학생 등록</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card
          header={
            <h2 className="text-lg font-semibold text-gray-900">기본 정보</h2>
          }
        >
          <div className="space-y-4">
            <Input
              label="이름"
              placeholder="학생 이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={nameError}
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="연락처"
                placeholder="010-0000-0000"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
              />
              <Input
                label="학부모 연락처"
                placeholder="010-0000-0000"
                value={parentPhone}
                onChange={(e) => setParentPhone(formatPhone(e.target.value))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="학교"
                placeholder="학교명"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
              />
              <Input
                label="학년"
                placeholder="예: 초5, 중2"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
              />
            </div>
          </div>
        </Card>

        <Card
          header={
            <h2 className="text-lg font-semibold text-gray-900">수강 정보</h2>
          }
        >
          <div className="space-y-4">
            {/* Plan Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                수강 플랜
              </label>
              <div className="grid grid-cols-3 gap-2">
                {plans.map((plan) => (
                  <button
                    key={plan.daysPerWeek}
                    type="button"
                    onClick={() => setSelectedPlan(plan.daysPerWeek)}
                    className={cn(
                      "flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 transition-colors",
                      selectedPlan === plan.daysPerWeek
                        ? "border-primary-500 bg-primary-50"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <span className={cn(
                      "text-sm font-bold",
                      selectedPlan === plan.daysPerWeek
                        ? "text-primary-700"
                        : "text-gray-900"
                    )}>
                      {plan.label}
                    </span>
                    <span className={cn(
                      "text-xs",
                      selectedPlan === plan.daysPerWeek
                        ? "text-primary-600"
                        : "text-gray-500"
                    )}>
                      {formatWon(plan.monthlyFee)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Schedule Days */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                요일 선택
              </label>
              <div className="flex flex-wrap gap-2">
                {SCHEDULE_DAYS.map((day) => (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => toggleDay(day.key)}
                    className={cn(
                      "w-10 h-10 rounded-lg text-sm font-medium transition-colors",
                      scheduleDays.includes(day.key)
                        ? "bg-primary-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Schedule Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                수업 시간
              </label>
              <div className="flex flex-wrap gap-2">
                {TIME_OPTIONS.map((time) => (
                  <button
                    key={time.value}
                    type="button"
                    onClick={() => setScheduleTime(time.value)}
                    className={cn(
                      "px-4 h-10 rounded-lg text-sm font-medium transition-colors",
                      scheduleTime === time.value
                        ? "bg-primary-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    {time.label}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="시작일"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
        </Card>

        <Card
          header={
            <h2 className="text-lg font-semibold text-gray-900">메모</h2>
          }
        >
          <textarea
            placeholder="학생에 대한 메모를 입력하세요..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
          />
        </Card>

        {mutation.isError && (
          <p className="text-sm text-red-600">
            {mutation.error instanceof Error
              ? mutation.error.message
              : "오류가 발생했습니다."}
          </p>
        )}

        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push("/students")}
          >
            취소
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            등록하기
          </Button>
        </div>
      </form>
    </div>
  );
}
