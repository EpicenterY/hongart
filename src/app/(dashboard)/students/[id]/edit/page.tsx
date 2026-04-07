"use client";

import { useState, use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, AlertTriangle, CheckCircle } from "lucide-react";
import { Button, Input, Card, Select, Modal } from "@/components/ui";
import { cn } from "@/lib/utils";

interface Plan {
  daysPerWeek: number;
  label: string;
  monthlyFee: number;
}

interface StudentDetail {
  id: string;
  name: string;
  phone: string | null;
  parentPhone: string | null;
  school: string | null;
  grade: string | null;
  status: string;
  note: string | null;
  subscription: {
    daysPerWeek: number;
    scheduleDays: string[];
    scheduleTime: string;
    startDate: string;
    monthlyFee: number;
  } | null;
}

interface PlanChangePreview {
  noPrior?: boolean;
  noProration?: boolean;
  currentPlan: {
    daysPerWeek: number;
    label: string;
    monthlyFee: number;
    totalSessions: number;
  };
  newPlan: {
    daysPerWeek: number;
    label: string;
    monthlyFee: number;
    totalSessions: number;
  };
  usedSessions: number;
  unitPrice: number;
  usedAmount: number;
  remainingBalance: number;
  proratedAmount: number;
  isCredit: boolean;
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

export default function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("ACTIVE");

  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [originalDaysPerWeek, setOriginalDaysPerWeek] = useState<number | null>(
    null
  );
  const [scheduleDays, setScheduleDays] = useState<string[]>([]);
  const [scheduleTime, setScheduleTime] = useState("15:00");
  const [startDate, setStartDate] = useState("");

  const [nameError, setNameError] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  function formatPhone(value: string): string {
    const nums = value.replace(/\D/g, "").slice(0, 11);
    if (nums.length <= 3) return nums;
    if (nums.length <= 7) return `${nums.slice(0, 3)}-${nums.slice(3)}`;
    return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7)}`;
  }

  const { data: student, isLoading: studentLoading } =
    useQuery<StudentDetail>({
      queryKey: ["student", id],
      queryFn: async () => {
        const res = await fetch(`/api/students/${id}`);
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      },
    });

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

  const isPlanChanged =
    selectedPlan !== null &&
    originalDaysPerWeek !== null &&
    selectedPlan !== originalDaysPerWeek;

  const { data: planPreview, isFetching: previewLoading } =
    useQuery<PlanChangePreview>({
      queryKey: ["planChangePreview", id, selectedPlan],
      queryFn: async () => {
        const res = await fetch(
          `/api/students/${id}/plan-change-preview?newDaysPerWeek=${selectedPlan}`
        );
        if (!res.ok) throw new Error("Failed to fetch preview");
        return res.json();
      },
      enabled: isPlanChanged,
    });

  const SCHEDULE_DAYS = ALL_SCHEDULE_DAYS.filter(
    (d) => classDays?.enabledDays.includes(d.key) ?? true
  );

  // Pre-fill form when student data loads
  useEffect(() => {
    if (student && !initialized) {
      setName(student.name);
      setPhone(student.phone ?? "");
      setParentPhone(student.parentPhone ?? "");
      setSchool(student.school ?? "");
      setGrade(student.grade ?? "");
      setNote(student.note ?? "");
      setStatus(student.status);
      if (student.subscription) {
        setSelectedPlan(student.subscription.daysPerWeek);
        setOriginalDaysPerWeek(student.subscription.daysPerWeek);
        setScheduleDays(student.subscription.scheduleDays);
        setScheduleTime(student.subscription.scheduleTime);
        setStartDate(student.subscription.startDate);
      }
      setInitialized(true);
    }
  }, [student, initialized]);

  const currentPlan = plans.find((p) => p.daysPerWeek === selectedPlan);

  const toggleDay = (day: string) => {
    setScheduleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // Whether proration is needed for this plan change
  const needsProration =
    planPreview && !planPreview.noPrior && !planPreview.noProration;

  const mutation = useMutation({
    mutationFn: async () => {
      // Update student info
      const res = await fetch(`/api/students/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: phone || null,
          parentPhone: parentPhone || null,
          school: school || null,
          grade: grade || null,
          note: note || null,
          status,
        }),
      });
      if (!res.ok) throw new Error("학생 정보 수정에 실패했습니다.");

      // Update subscription if plan is selected
      if (currentPlan) {
        const subBody: Record<string, unknown> = {
          daysPerWeek: currentPlan.daysPerWeek,
          scheduleDays,
          scheduleTime,
          monthlyFee: currentPlan.monthlyFee,
        };

        // 플랜 변경 시 차액 정보 포함
        if (isPlanChanged && planPreview) {
          subBody.planChange = {
            previousPlan: planPreview.currentPlan.label,
            newPlan: planPreview.newPlan.label,
            proratedAmount: planPreview.proratedAmount,
            isCredit: planPreview.isCredit,
            noPrior: planPreview.noPrior || false,
          };
        }

        const subRes = await fetch(`/api/students/${id}/subscription`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subBody),
        });
        if (!subRes.ok) throw new Error("수강 정보 수정에 실패했습니다.");
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", id] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["unpaid-count"] });
      router.push(`/students/${id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNameError("");
    if (!name.trim()) {
      setNameError("이름을 입력해주세요.");
      return;
    }
    // 플랜이 변경되고 차액이 있는 경우 확인 모달 표시
    if (isPlanChanged && needsProration) {
      setShowConfirmModal(true);
      return;
    }
    mutation.mutate();
  };

  const handleConfirmPlanChange = () => {
    setShowConfirmModal(false);
    mutation.mutate();
  };

  function formatWon(n: number) {
    return "₩" + n.toLocaleString("ko-KR");
  }

  if (studentLoading) {
    return (
      <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-32" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto">
        <p className="text-gray-500">학생을 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto">
      <button
        onClick={() => router.push(`/students/${id}`)}
        className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        학생 상세
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        학생 정보 수정
      </h1>

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
            <Select
              label="상태"
              options={[
                { value: "ACTIVE", label: "활성" },
                { value: "PAUSED", label: "휴원" },
                { value: "WITHDRAWN", label: "퇴원" },
              ]}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
          </div>
        </Card>

        <Card
          header={
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                수강 정보
              </h2>
              {originalDaysPerWeek && planPreview && !previewLoading && needsProration && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                  현재: {planPreview.currentPlan.label} · 사용{" "}
                  {planPreview.usedSessions}/{planPreview.currentPlan.totalSessions}회
                </span>
              )}
            </div>
          }
        >
          <div className="space-y-4">
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
                    <span
                      className={cn(
                        "text-sm font-bold",
                        selectedPlan === plan.daysPerWeek
                          ? "text-primary-700"
                          : "text-gray-900"
                      )}
                    >
                      {plan.label}
                    </span>
                    <span
                      className={cn(
                        "text-xs",
                        selectedPlan === plan.daysPerWeek
                          ? "text-primary-600"
                          : "text-gray-500"
                      )}
                    >
                      {formatWon(plan.monthlyFee)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 플랜 변경: 결제이력 없음 or 잔여 소진 → 단순 변경 안내 */}
            {isPlanChanged && planPreview && !previewLoading && !needsProration && (
              <div className="rounded-xl border-2 border-green-300 bg-green-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-semibold text-green-800">
                    추가 비용 없이 플랜을 변경할 수 있습니다
                  </span>
                </div>
                <p className="text-sm text-green-700">
                  {planPreview.noPrior
                    ? "결제 이력이 없어 바로 플랜을 변경합니다."
                    : "잔여 횟수가 소진되어 바로 새 플랜으로 변경합니다."}
                  {" "}변경 후 새로운 {planPreview.newPlan.totalSessions}회차가 제공됩니다.
                </p>
              </div>
            )}

            {/* 플랜 변경 차액 미리보기 */}
            {isPlanChanged && planPreview && !previewLoading && needsProration && (
              <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-800">
                    플랜 변경 차액 계산
                  </span>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-700">
                    <span>현재 플랜 수강료</span>
                    <span>{formatWon(planPreview.currentPlan.monthlyFee)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>
                      회당 단가 (÷{planPreview.currentPlan.totalSessions})
                    </span>
                    <span>{formatWon(planPreview.unitPrice)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>사용 금액 ({planPreview.usedSessions}회)</span>
                    <span>{formatWon(planPreview.usedAmount)}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>잔여 금액</span>
                    <span>{formatWon(planPreview.remainingBalance)}</span>
                  </div>
                  <div className="border-t border-amber-300 my-2" />
                  <div className="flex justify-between text-gray-700">
                    <span>새 플랜 수강료</span>
                    <span>{formatWon(planPreview.newPlan.monthlyFee)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-amber-900 text-base pt-1">
                    <span>
                      {planPreview.isCredit ? "환불 금액" : "추가 납부액"}
                    </span>
                    <span>
                      {planPreview.isCredit ? "-" : ""}
                      {formatWon(planPreview.proratedAmount)}
                    </span>
                  </div>
                  <p className="text-xs text-amber-700 pt-2">
                    변경 후 새로운 {planPreview.newPlan.totalSessions}회차가 제공됩니다.
                  </p>
                </div>
              </div>
            )}

            {isPlanChanged && previewLoading && (
              <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4 animate-pulse">
                <div className="h-4 bg-amber-200 rounded w-40 mb-3" />
                <div className="space-y-2">
                  <div className="h-3 bg-amber-100 rounded w-full" />
                  <div className="h-3 bg-amber-100 rounded w-3/4" />
                </div>
              </div>
            )}

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
            onClick={() => router.push(`/students/${id}`)}
          >
            취소
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            저장
          </Button>
        </div>
      </form>

      {/* 플랜 변경 확인 모달 */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="플랜 변경 확인"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowConfirmModal(false)}
            >
              취소
            </Button>
            <Button onClick={handleConfirmPlanChange} loading={mutation.isPending}>
              변경 확인
            </Button>
          </>
        }
      >
        {planPreview && (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">{planPreview.currentPlan.label}</span>
              {" → "}
              <span className="font-semibold">{planPreview.newPlan.label}</span>
              로 플랜을 변경합니다.
            </p>
            <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">기존 플랜 사용 회차</span>
                <span className="font-medium">
                  {planPreview.usedSessions}/{planPreview.currentPlan.totalSessions}회
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">새 플랜 제공 회차</span>
                <span className="font-medium text-primary-600">
                  {planPreview.newPlan.totalSessions}회
                </span>
              </div>
              <div className="flex justify-between font-semibold pt-1 border-t border-gray-200 mt-1">
                <span>
                  {planPreview.isCredit ? "환불 금액" : "추가 납부액"}
                </span>
                <span className={planPreview.isCredit ? "text-green-600" : "text-amber-600"}>
                  {planPreview.isCredit ? "-" : "+"}
                  {formatWon(planPreview.proratedAmount)}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              변경 확인 시 결제 내역에 자동으로 기록됩니다.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
