"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Edit,
  Trash2,
  Plus,
  Calendar,
  CreditCard,
  AlertTriangle,
} from "lucide-react";
import { Button, Badge, Card, Modal, Tabs, Select, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatDate, formatDateShort, formatCurrency, formatTime, DAY_LABELS } from "@/lib/format";
import { celebrate } from "@/lib/celebrate";

type StudentStatus = "ACTIVE" | "PAUSED" | "WITHDRAWN";
type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "MAKEUP";
type PaymentMethod = "CASH" | "CARD" | "TRANSFER";
type MemoCategory = "GENERAL" | "PROGRESS" | "ISSUE" | "PARENT_CONTACT" | "OTHER";

interface ScheduleSlot { day: string; time: string; }

interface Subscription {
  id: string;
  daysPerWeek: number;
  schedule: ScheduleSlot[];
  startDate: string;
  monthlyFee: number;
  isActive: boolean;
}

interface PaymentSession {
  id: string;
  studentId: string;
  capacity: number;
  frozen: boolean;
  amount: number;
  method: PaymentMethod;
  daysPerWeek: number;
  monthlyFee: number;
  note: string | null;
  createdAt: string;
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  status: AttendanceStatus;
  checkInAt: string | null;
  note: string | null;
  createdAt: string;
}

interface Memo {
  id: string;
  category: MemoCategory;
  content: string;
  createdAt: string;
}

interface BalanceInfo {
  remaining: number;
  totalCapacity: number;
  totalConsuming: number;
  currentSessionUsed: number;
  currentSessionTotal: number;
  currentSessionRemaining: number;
  paymentState: "OK" | "NEEDS_PAYMENT" | "NEW" | "NO_SUBSCRIPTION";
  hasPaymentHistory: boolean;
}

interface Plan {
  daysPerWeek: number;
  label: string;
  monthlyFee: number;
}

interface PlanChangePreview {
  noPrior?: boolean;
  currentPlan: { daysPerWeek: number; label: string; monthlyFee: number; totalSessions: number };
  newPlan: { daysPerWeek: number; label: string; monthlyFee: number; totalSessions: number };
  usedSessions: number;
  unusedCount: number;
  unusedCredit: number;
  recommendedAmount: number;
  isCredit: boolean;
}

interface PendingPlanChange {
  id: string;
  studentId: string;
  previousDaysPerWeek: number;
  previousSchedule: ScheduleSlot[];
  previousMonthlyFee: number;
  frozenSessionId: string | null;
  recommendedAmount: number;
  isCredit: boolean;
  createdAt: string;
}

interface StudentDetail {
  id: string;
  name: string;
  phone: string | null;
  parentPhone: string | null;
  school: string | null;
  grade: string | null;
  status: StudentStatus;
  note: string | null;
  createdAt: string;
  subscription: Subscription | null;
  paymentSessions: PaymentSession[];
  attendance: AttendanceRecord[];
  memos: Memo[];
  balanceInfo: BalanceInfo;
  pendingPlanChange: PendingPlanChange | null;
}

const statusBadgeMap: Record<StudentStatus, { variant: "active" | "paused" | "withdrawn"; label: string }> = {
  ACTIVE: { variant: "active", label: "활성" },
  PAUSED: { variant: "paused", label: "휴원" },
  WITHDRAWN: { variant: "withdrawn", label: "퇴원" },
};

const attendanceBadgeMap: Record<AttendanceStatus, { variant: "present" | "absent" | "late" | "makeup"; label: string }> = {
  PRESENT: { variant: "present", label: "출석" },
  ABSENT: { variant: "absent", label: "결석" },
  LATE: { variant: "late", label: "지각" },
  MAKEUP: { variant: "makeup", label: "보강" },
};

const memoCategoryMap: Record<MemoCategory, { variant: "active" | "paused" | "withdrawn" | "present" | "late"; label: string }> = {
  GENERAL: { variant: "active", label: "일반" },
  PROGRESS: { variant: "present", label: "학습" },
  ISSUE: { variant: "late", label: "이슈" },
  PARENT_CONTACT: { variant: "paused", label: "학부모 상담" },
  OTHER: { variant: "withdrawn", label: "기타" },
};

const paymentMethodLabel: Record<PaymentMethod, string> = {
  CASH: "현금",
  CARD: "카드",
  TRANSFER: "계좌이체",
};

const MEMO_CATEGORY_OPTIONS = [
  { value: "GENERAL", label: "일반" },
  { value: "PROGRESS", label: "학습" },
  { value: "ISSUE", label: "이슈" },
  { value: "PARENT_CONTACT", label: "학부모 상담" },
  { value: "OTHER", label: "기타" },
];

const BASE_TABS = [
  { key: "attendance", label: "출석" },
  { key: "payments", label: "결제" },
  { key: "subscription", label: "수강권" },
  { key: "memos", label: "메모" },
];

/** 소모성 출석 여부 */
function isConsuming(status: string): boolean {
  return status !== "ABSENT";
}

/** FilledSession for display */
interface FilledSessionDisplay {
  session: PaymentSession;
  assigned: AttendanceRecord[];
  absents: AttendanceRecord[];
  filledCount: number;
  remaining: number;
}

/** Client-side filling computation */
function computeFillingClient(
  sessions: PaymentSession[],
  records: AttendanceRecord[],
): { filledSessions: FilledSessionDisplay[]; unassigned: AttendanceRecord[] } {
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const sortedRecords = [...records].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const filledSessions: FilledSessionDisplay[] = sortedSessions.map((session) => ({
    session,
    assigned: [],
    absents: [],
    filledCount: 0,
    remaining: session.capacity,
  }));

  const unassigned: AttendanceRecord[] = [];

  let sessionIdx = 0;
  for (const record of sortedRecords) {
    const consuming = isConsuming(record.status);

    if (consuming) {
      while (sessionIdx < filledSessions.length && filledSessions[sessionIdx].remaining <= 0) {
        sessionIdx++;
      }
      if (sessionIdx < filledSessions.length) {
        filledSessions[sessionIdx].assigned.push(record);
        filledSessions[sessionIdx].filledCount++;
        filledSessions[sessionIdx].remaining--;
      } else {
        unassigned.push(record);
      }
    } else {
      const idx = Math.min(sessionIdx, filledSessions.length - 1);
      if (idx >= 0) {
        filledSessions[idx].absents.push(record);
      }
    }
  }

  return { filledSessions, unassigned };
}

export default function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const initialTab = searchParams.get("tab") || "attendance";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [memoCategory, setMemoCategory] = useState("GENERAL");
  const [memoContent, setMemoContent] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("TRANSFER");
  const [expandedCycles, setExpandedCycles] = useState<Set<number>>(new Set());
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [showPlanConfirmModal, setShowPlanConfirmModal] = useState(false);

  const { data: student, isLoading, dataUpdatedAt } = useQuery<StudentDetail>({
    queryKey: ["student", id],
    queryFn: async () => {
      const res = await fetch(`/api/students/${id}`);
      if (!res.ok) throw new Error("Failed to fetch student");
      return res.json();
    },
    staleTime: 0,
  });

  const prevUpdatedAt = useRef(dataUpdatedAt);
  useEffect(() => {
    if (dataUpdatedAt && dataUpdatedAt !== prevUpdatedAt.current) {
      prevUpdatedAt.current = dataUpdatedAt;
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["unpaid-count"] });
    }
  }, [dataUpdatedAt, queryClient]);

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await fetch("/api/settings/plans");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const isPlanChanged = selectedPlan !== null
    && student?.subscription
    && selectedPlan !== student.subscription.daysPerWeek;

  const { data: planPreview, isFetching: previewLoading } = useQuery<PlanChangePreview>({
    queryKey: ["planChangePreview", id, selectedPlan],
    queryFn: async () => {
      const res = await fetch(`/api/students/${id}/plan-change-preview?newDaysPerWeek=${selectedPlan}`);
      if (!res.ok) throw new Error("Failed to fetch preview");
      return res.json();
    },
    enabled: !!isPlanChanged,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/students/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      router.push("/students");
    },
  });

  const planChangeMutation = useMutation({
    mutationFn: async () => {
      if (!planPreview || !selectedPlan) throw new Error("No preview");
      const newPlan = plans.find((p) => p.daysPerWeek === selectedPlan);
      if (!newPlan || !student?.subscription) throw new Error("No plan");
      const res = await fetch(`/api/students/${id}/subscription`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          daysPerWeek: newPlan.daysPerWeek,
          schedule: student.subscription.schedule,
          monthlyFee: newPlan.monthlyFee,
          planChange: {
            previousPlan: planPreview.currentPlan.label,
            newPlan: planPreview.newPlan.label,
            noPrior: planPreview.noPrior ?? false,
            recommendedAmount: planPreview.recommendedAmount,
            isCredit: planPreview.isCredit,
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to change plan");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", id] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["unpaid-count"] });
      setSelectedPlan(null);
      setShowPlanConfirmModal(false);
      // 결제 탭으로 자동 이동 (대기 카드 표시)
      setActiveTab("payments");
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: id,
          amount: Number(paymentAmount),
          method: paymentMethod,
        }),
      });
      if (!res.ok) throw new Error("결제 처리에 실패했습니다.");
      return res.json();
    },
    onSuccess: () => {
      celebrate("payment");
      queryClient.invalidateQueries({ queryKey: ["student", id] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["unpaid-count"] });
      setShowPaymentModal(false);
    },
  });

  const cancelPlanChangeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/students/${id}/plan-change`, { method: "DELETE" });
      if (!res.ok) throw new Error("플랜 변경 취소에 실패했습니다.");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", id] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["unpaid-count"] });
    },
  });

  const confirmCreditMutation = useMutation({
    mutationFn: async () => {
      // Credit case: just delete pending (no payment session needed, keep new plan)
      const res = await fetch(`/api/students/${id}/plan-change`, { method: "POST" });
      if (!res.ok) throw new Error("환불 확인에 실패했습니다.");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", id] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["unpaid-count"] });
    },
  });

  const memoMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/students/${id}/memos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: memoCategory, content: memoContent }),
      });
      if (!res.ok) throw new Error("Failed to create memo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", id] });
      setMemoContent("");
    },
  });

  if (isLoading) {
    return (
      <div className="px-4 py-6 lg:px-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-40 bg-gray-200 rounded" />
          <div className="h-60 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="px-4 py-6 lg:px-8">
        <p className="text-gray-500">학생을 찾을 수 없습니다.</p>
        <Button variant="secondary" onClick={() => router.push("/students")} className="mt-4">
          목록으로
        </Button>
      </div>
    );
  }

  const statusBadge = statusBadgeMap[student.status];
  const { balanceInfo } = student;
  const remaining = balanceInfo.remaining;
  const currentSessionTotal = balanceInfo.currentSessionTotal;
  const currentSessionUsed = balanceInfo.currentSessionUsed;
  const currentSessionRemaining = balanceInfo.currentSessionRemaining;
  const hasCurrentPayment = balanceInfo.paymentState === "OK";
  const progressPercent = currentSessionTotal > 0 && hasCurrentPayment
    ? Math.round((currentSessionUsed / currentSessionTotal) * 100)
    : 0;

  // Compute FilledSessions for display
  const { filledSessions, unassigned } = computeFillingClient(
    student.paymentSessions,
    student.attendance,
  );

  // Display groups: reverse for most recent first
  const displayGroups = [...filledSessions].reverse();

  // Total stats
  const totalPaidSessions = student.paymentSessions.length;
  const totalCapacity = student.paymentSessions.reduce((sum, s) => sum + s.capacity, 0);
  const totalAttendance = student.attendance.filter((a) => isConsuming(a.status)).length;

  // Unpaid badge
  const unpaidBadge = balanceInfo.paymentState === "NEEDS_PAYMENT" || balanceInfo.paymentState === "NEW" ? 1 : 0;

  const detailTabs = BASE_TABS.map((tab) =>
    tab.key === "payments" && unpaidBadge > 0
      ? { ...tab, badge: unpaidBadge }
      : tab
  );

  return (
    <div className="px-4 py-6 lg:px-8">
      <button
        onClick={() => router.push("/students")}
        className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        학생 목록
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
            <Badge variant={statusBadge.variant} size="md">
              {statusBadge.label}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            등록일: {formatDate(student.createdAt)}
            {student.school && ` · ${student.school}`}
            {student.grade && ` ${student.grade}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => router.push(`/students/${id}/edit`)}>
            <Edit className="w-4 h-4" />
            수정
          </Button>
          <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
            <Trash2 className="w-4 h-4" />
            삭제
          </Button>
        </div>
      </div>

      {/* Unpaid banner */}
      {student.subscription && (balanceInfo.paymentState === "NEEDS_PAYMENT" || balanceInfo.paymentState === "NEW") && (
        <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span className="text-sm font-medium text-amber-800">
            {balanceInfo.paymentState === "NEW"
              ? "첫 결제가 필요합니다."
              : `결제가 필요합니다. (잔여 ${remaining}회)`}
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setActiveTab("payments")}
          >
            <CreditCard className="w-4 h-4" />
            결제 확인
          </Button>
        </div>
      )}

      {/* Summary cards */}
      {student.subscription && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <div className="text-sm text-gray-500 mb-1">수강 플랜</div>
            <div className="font-semibold text-gray-900">
              주 {student.subscription.daysPerWeek}회
            </div>
            <div className="text-sm text-gray-600">
              {student.subscription.schedule.map((s) => DAY_LABELS[s.day] || s.day).join(", ")}
            </div>
          </Card>
          <Card>
            <div className="text-sm text-gray-500 mb-1">잔여 횟수</div>
            {remaining < 0 ? (
              <div className="font-semibold text-red-600">
                {remaining}회 (초과)
              </div>
            ) : hasCurrentPayment ? (
              <>
                <div className="font-semibold text-gray-900 mb-2">
                  {currentSessionRemaining} / {currentSessionTotal}회
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </>
            ) : (
              <div className="font-semibold text-amber-600">
                {balanceInfo.paymentState === "NEEDS_PAYMENT" ? "결제 필요" : "미결제"}
              </div>
            )}
          </Card>
          <Card>
            <div className="text-sm text-gray-500 mb-1">월 수강료</div>
            <div className="font-semibold text-gray-900">
              {formatCurrency(student.subscription.monthlyFee)}
            </div>
          </Card>
        </div>
      )}

      <Tabs tabs={detailTabs} activeTab={activeTab} onTabChange={setActiveTab}>
        {/* Attendance Tab */}
        {activeTab === "attendance" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="bg-primary-50 rounded-lg p-3 text-center">
                <div className="text-xl sm:text-2xl font-bold text-primary-700">{totalPaidSessions}</div>
                <div className="text-xs text-primary-600">총 결제 회차</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-xl sm:text-2xl font-bold text-blue-700">{totalCapacity}</div>
                <div className="text-xs text-blue-600">총 결제 수업</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-xl sm:text-2xl font-bold text-green-700">{totalAttendance}</div>
                <div className="text-xs text-green-600">총 출석 일</div>
              </div>
            </div>

            {/* Unassigned overflow */}
            {unassigned.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/30 overflow-hidden">
                <div className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-semibold text-gray-900">미결제 출석</span>
                      <Badge variant="overdue">미결제</Badge>
                    </div>
                    <div className="text-sm font-semibold text-amber-600">
                      {unassigned.length}회
                    </div>
                  </div>
                </div>
                <div className="border-t border-amber-100 divide-y divide-amber-50">
                  {[...unassigned].reverse().map((record) => {
                    const badge = attendanceBadgeMap[record.status];
                    return (
                      <div key={record.id} className="flex items-center justify-between px-5 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-900">
                            {formatDateShort(record.date)}
                          </span>
                          {record.checkInAt && (
                            <span className="text-xs text-gray-500">{formatTime(record.checkInAt)}</span>
                          )}
                        </div>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {displayGroups.length === 0 && unassigned.length === 0 ? (
              <Card>
                <p className="text-sm text-gray-500 text-center py-4">
                  출석 기록이 없습니다.
                </p>
              </Card>
            ) : (
              displayGroups.map((group, idx) => {
                const isCurrent = idx === 0;
                const isExpanded = isCurrent
                  ? !expandedCycles.has(-1)
                  : expandedCycles.has(idx);
                const allRecords = [...group.assigned, ...group.absents]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                const creditPlan = `주 ${group.session.daysPerWeek}회`;
                const groupKey = `session-${group.session.id}`;

                return (
                  <div
                    key={groupKey}
                    className={cn(
                      "rounded-xl border overflow-hidden",
                      group.session.frozen
                        ? "border-gray-300 bg-gray-50/30"
                        : "border-gray-200 bg-white"
                    )}
                  >
                    {/* Session header */}
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedCycles((prev) => {
                          const next = new Set(prev);
                          if (isCurrent) {
                            if (next.has(-1)) next.delete(-1);
                            else next.add(-1);
                          } else {
                            if (next.has(idx)) next.delete(idx);
                            else next.add(idx);
                          }
                          return next;
                        });
                      }}
                      className="w-full px-5 py-3 hover:bg-gray-50/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          )}
                          <CreditCard className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="text-left min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-900">
                                {filledSessions.indexOf(group) + 1}회차
                                {isCurrent && !group.session.frozen && <span className="text-primary-600"> (현재)</span>}
                                {group.session.frozen && <span className="text-gray-500"> (종료)</span>}
                              </span>
                              <Badge variant="paid">완납</Badge>
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 truncate">
                              {formatDateShort(group.session.createdAt)} · {formatCurrency(group.session.amount)} · {creditPlan} · {group.session.capacity}회
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <div className="text-sm font-semibold text-gray-700">
                            {group.filledCount}/{group.session.capacity}
                          </div>
                          <div className="text-xs text-gray-500">
                            잔여 {Math.max(0, group.remaining)}회
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Attendance records */}
                    {isExpanded && (
                      <div className="border-t border-gray-100">
                        {allRecords.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-4">출석 기록 없음</p>
                        ) : (
                          <div className="divide-y divide-gray-50">
                            {allRecords.map((entry) => {
                              const badge = attendanceBadgeMap[entry.status];
                              return (
                                <div
                                  key={entry.id}
                                  className="flex items-center justify-between px-5 py-2.5"
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium text-gray-900">
                                      {formatDateShort(entry.date)}
                                    </span>
                                    {entry.checkInAt && (
                                      <span className="text-xs text-gray-500">
                                        {formatTime(entry.checkInAt)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {entry.note && (
                                      <span className="text-xs text-gray-400 truncate max-w-[120px]">{entry.note}</span>
                                    )}
                                    {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {/* Remaining sessions footer */}
                        {isCurrent && !group.session.frozen && group.remaining > 0 && (
                          <div className="border-t border-gray-100 px-5 py-2 bg-gray-50/50">
                            <p className="text-xs text-gray-500 text-center">
                              잔여 {group.remaining}회 남음
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === "payments" && (
          <div className="space-y-4">
            {/* Pending plan change card */}
            {student.pendingPlanChange && student.subscription && (
              <Card className="border-primary-300 bg-primary-50/50">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="w-4 h-4 text-primary-600" />
                  <span className="font-semibold text-gray-900">플랜 변경 대기</span>
                  <Badge variant="active">대기중</Badge>
                </div>
                <div className="text-sm space-y-1.5 mb-3">
                  <div className="flex justify-between text-gray-600">
                    <span>이전 플랜</span>
                    <span>주 {student.pendingPlanChange.previousDaysPerWeek}회 · {formatCurrency(student.pendingPlanChange.previousMonthlyFee)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>새 플랜</span>
                    <span>주 {student.subscription.daysPerWeek}회 · {formatCurrency(student.subscription.monthlyFee)}</span>
                  </div>
                  <div className="border-t border-primary-200 my-2" />
                  <div className="flex justify-between font-bold text-gray-900">
                    <span>{student.pendingPlanChange.isCredit ? "환불 추천액" : "추천 결제액"}</span>
                    <span className={student.pendingPlanChange.isCredit ? "text-green-600" : "text-amber-600"}>
                      {student.pendingPlanChange.isCredit ? "-" : ""}{formatCurrency(student.pendingPlanChange.recommendedAmount)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => cancelPlanChangeMutation.mutate()}
                    loading={cancelPlanChangeMutation.isPending}
                  >
                    취소
                  </Button>
                  {student.pendingPlanChange.isCredit ? (
                    <Button
                      size="sm"
                      onClick={() => confirmCreditMutation.mutate()}
                      loading={confirmCreditMutation.isPending}
                    >
                      환불 확인
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        setPaymentAmount(String(student.pendingPlanChange!.recommendedAmount));
                        setShowPaymentModal(true);
                      }}
                    >
                      결제하기
                    </Button>
                  )}
                </div>
              </Card>
            )}

            {/* Unpaid card */}
            {!student.pendingPlanChange && (balanceInfo.paymentState === "NEEDS_PAYMENT" || balanceInfo.paymentState === "NEW") && student.subscription && (
              <Card className="border-amber-300 bg-amber-50/50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span className="font-semibold text-gray-900">결제 필요</span>
                      <Badge variant="overdue">미결제</Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      잔여 {remaining}회 · {formatCurrency(student.subscription.monthlyFee)} · {student.subscription.daysPerWeek * 4}회
                    </p>
                  </div>
                  <Button size="sm" onClick={() => {
                    setPaymentAmount(String(student.subscription!.monthlyFee));
                    setShowPaymentModal(true);
                  }}>
                    결제 처리
                  </Button>
                </div>
              </Card>
            )}

            <Card padding={false}>
              {student.paymentSessions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  결제 내역이 없습니다.
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {[...student.paymentSessions].reverse().map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between px-5 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {formatDateShort(session.createdAt)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatCurrency(session.amount)}
                          {` · ${paymentMethodLabel[session.method]}`}
                          {` · ${session.capacity}회`}
                          {session.frozen && " · 종료"}
                        </div>
                        {session.note && (
                          <div className="text-xs text-gray-400 mt-0.5 truncate">
                            {session.note}
                          </div>
                        )}
                      </div>
                      <Badge variant="paid">완납</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Subscription Tab */}
        {activeTab === "subscription" && (
          <div className="space-y-4">
            {student.pendingPlanChange && (
              <div className="rounded-xl border-2 border-primary-300 bg-primary-50 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-primary-600" />
                  <span className="text-sm font-semibold text-primary-800">플랜 변경 대기 중</span>
                </div>
                <p className="text-sm text-primary-700">
                  결제 탭에서 플랜 변경을 완료하거나 취소해주세요.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  onClick={() => setActiveTab("payments")}
                >
                  결제 탭으로 이동
                </Button>
              </div>
            )}
            {student.subscription ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {plans.map((plan) => {
                    const isCurrent = plan.daysPerWeek === student.subscription!.daysPerWeek;
                    const isSelected = selectedPlan === plan.daysPerWeek;
                    const isActive = isSelected || (!selectedPlan && isCurrent);
                    const hasPending = !!student.pendingPlanChange;
                    return (
                      <button
                        key={plan.daysPerWeek}
                        type="button"
                        disabled={hasPending}
                        onClick={() => {
                          if (hasPending) return;
                          if (isCurrent) setSelectedPlan(null);
                          else setSelectedPlan(plan.daysPerWeek);
                        }}
                        className={cn(
                          "relative flex flex-col items-center gap-1 py-4 px-2 rounded-xl border-2 transition-colors",
                          hasPending
                            ? "border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed"
                            : isActive
                              ? "border-primary-500 bg-primary-50"
                              : "border-gray-200 hover:border-gray-300",
                        )}
                      >
                        {isCurrent && (
                          <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white bg-primary-600 px-2 py-0.5 rounded-full">
                            현재
                          </span>
                        )}
                        <span className={cn("text-sm font-bold", isActive ? "text-primary-700" : "text-gray-900")}>
                          {plan.label}
                        </span>
                        <span className={cn("text-xs", isActive ? "text-primary-600" : "text-gray-500")}>
                          {formatCurrency(plan.monthlyFee)}
                        </span>
                        <span className={cn("text-[10px]", isActive ? "text-primary-500" : "text-gray-400")}>
                          {plan.daysPerWeek * 4}회차
                        </span>
                      </button>
                    );
                  })}
                </div>

                {isPlanChanged && planPreview && !previewLoading && planPreview.noPrior && (
                  <div className="rounded-xl border-2 border-primary-300 bg-primary-50 p-4">
                    <p className="text-sm text-gray-700 mb-1">
                      <span className="font-semibold">{planPreview.currentPlan.label}</span>
                      {" → "}
                      <span className="font-semibold">{planPreview.newPlan.label}</span>
                      {" ("}{formatCurrency(planPreview.newPlan.monthlyFee)}{")"}
                    </p>
                    <p className="text-xs text-gray-500 mb-3">
                      결제 이력이 없어 바로 변경됩니다.
                    </p>
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setSelectedPlan(null)}>취소</Button>
                      <Button size="sm" onClick={() => planChangeMutation.mutate()} loading={planChangeMutation.isPending}>
                        플랜 변경
                      </Button>
                    </div>
                  </div>
                )}
                {isPlanChanged && planPreview && !previewLoading && !planPreview.noPrior && (
                  <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-semibold text-amber-800">플랜 변경 추천 금액</span>
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between text-gray-600">
                        <span>현재 사이클 사용</span>
                        <span>{planPreview.usedSessions}/{planPreview.currentPlan.totalSessions}회</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>미사용분 크레딧</span>
                        <span>{formatCurrency(planPreview.unusedCredit)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>새 플랜 수강료</span>
                        <span>{formatCurrency(planPreview.newPlan.monthlyFee)}</span>
                      </div>
                      <div className="border-t border-amber-300 my-2" />
                      <div className="flex justify-between font-bold text-amber-900">
                        <span>{planPreview.isCredit ? "환불 추천액" : "추천 결제액"}</span>
                        <span>{planPreview.isCredit ? "-" : ""}{formatCurrency(planPreview.recommendedAmount)}</span>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-3">
                      <Button variant="secondary" size="sm" onClick={() => setSelectedPlan(null)}>취소</Button>
                      <Button size="sm" onClick={() => setShowPlanConfirmModal(true)}>플랜 변경</Button>
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

                <Card>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">회차 사용 현황</span>
                      {hasCurrentPayment ? (
                        <span className="text-sm font-semibold text-gray-900">
                          {currentSessionUsed} / {currentSessionTotal}회
                        </span>
                      ) : (
                        <Badge variant="overdue">결제 필요</Badge>
                      )}
                    </div>
                    {hasCurrentPayment ? (
                      <>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className="bg-primary-600 h-2.5 rounded-full transition-all"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>사용 {currentSessionUsed}회</span>
                          <span>잔여 {currentSessionRemaining}회</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-amber-600">
                        결제가 완료되면 잔여 횟수가 표시됩니다.
                      </p>
                    )}
                  </div>
                </Card>

                <Card>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-500">수강 스케줄</div>
                      <div className="font-medium text-gray-900">
                        {student.subscription.schedule.map((s) => {
                          const dayLabel = DAY_LABELS[s.day] || s.day;
                          const hour = parseInt(s.time) - 12;
                          return `${dayLabel} ${hour}시`;
                        }).join(", ")}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">시작일</div>
                      <div className="font-medium text-gray-900">
                        {formatDate(student.subscription.startDate)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">상태</div>
                      <Badge variant={student.subscription.isActive ? "active" : "withdrawn"}>
                        {student.subscription.isActive ? "활성" : "비활성"}
                      </Badge>
                    </div>
                  </div>
                  <div className="pt-3 mt-3 border-t border-gray-100 flex justify-end">
                    <Button variant="secondary" size="sm" onClick={() => router.push(`/students/${id}/edit`)}>
                      <Edit className="w-4 h-4" />
                      상세 수정
                    </Button>
                  </div>
                </Card>
              </>
            ) : (
              <Card>
                <p className="text-sm text-gray-500 text-center py-4">
                  등록된 수강권이 없습니다.
                </p>
              </Card>
            )}
          </div>
        )}

        {/* Memos Tab */}
        {activeTab === "memos" && (
          <div className="space-y-4">
            <Card header={<span className="text-sm font-semibold text-gray-900">새 메모 작성</span>}>
              <div className="space-y-3">
                <Select
                  label="카테고리"
                  options={MEMO_CATEGORY_OPTIONS}
                  value={memoCategory}
                  onChange={(e) => setMemoCategory(e.target.value)}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">내용</label>
                  <textarea
                    value={memoContent}
                    onChange={(e) => setMemoContent(e.target.value)}
                    placeholder="메모 내용을 입력하세요..."
                    rows={3}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => memoMutation.mutate()}
                    disabled={!memoContent.trim()}
                    loading={memoMutation.isPending}
                  >
                    <Plus className="w-4 h-4" />
                    메모 추가
                  </Button>
                </div>
              </div>
            </Card>

            {student.memos.length === 0 ? (
              <Card>
                <p className="text-sm text-gray-500 text-center py-4">메모가 없습니다.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {student.memos.map((memo) => {
                  const cat = memoCategoryMap[memo.category] || memoCategoryMap.OTHER;
                  return (
                    <Card key={memo.id}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={cat.variant}>{cat.label}</Badge>
                            <span className="text-xs text-gray-400">{formatDate(memo.createdAt)}</span>
                          </div>
                          <p className="text-sm text-gray-700">{memo.content}</p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Tabs>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="학생 삭제"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>취소</Button>
            <Button variant="danger" onClick={() => deleteMutation.mutate()} loading={deleteMutation.isPending}>삭제</Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          <strong>{student.name}</strong> 학생을 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
        </p>
      </Modal>

      {/* Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="결제 처리"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowPaymentModal(false)}>취소</Button>
            <Button onClick={() => paymentMutation.mutate()} loading={paymentMutation.isPending} disabled={!paymentAmount}>결제 처리</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="금액" type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
          <Select
            label="결제 방법"
            options={[
              { value: "TRANSFER", label: "계좌이체" },
              { value: "CARD", label: "카드" },
              { value: "CASH", label: "현금" },
            ]}
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          />
        </div>
      </Modal>

      {/* Plan Change Confirm Modal */}
      <Modal
        isOpen={showPlanConfirmModal}
        onClose={() => setShowPlanConfirmModal(false)}
        title="플랜 변경 확인"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowPlanConfirmModal(false)}>취소</Button>
            <Button onClick={() => planChangeMutation.mutate()} loading={planChangeMutation.isPending}>변경 확인</Button>
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
                <span className="text-gray-600">현재 사이클 사용</span>
                <span className="font-medium">{planPreview.usedSessions}/{planPreview.currentPlan.totalSessions}회</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">미사용분 크레딧</span>
                <span className="font-medium">{formatCurrency(planPreview.unusedCredit)}</span>
              </div>
              <div className="flex justify-between font-semibold pt-1 border-t border-gray-200 mt-1">
                <span>{planPreview.isCredit ? "환불 추천액" : "추천 결제액"}</span>
                <span className={planPreview.isCredit ? "text-green-600" : "text-amber-600"}>
                  {planPreview.isCredit ? "-" : ""}{formatCurrency(planPreview.recommendedAmount)}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              현재 세션이 종료되고 새 플랜이 적용됩니다. 별도 결제가 필요합니다.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
