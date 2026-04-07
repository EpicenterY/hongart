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

type StudentStatus = "ACTIVE" | "PAUSED" | "WITHDRAWN";
type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "MAKEUP";
type PaymentStatus = "PAID" | "PENDING";
type PaymentMethod = "CASH" | "CARD" | "TRANSFER";
type MemoCategory = "GENERAL" | "PROGRESS" | "ISSUE" | "PARENT_CONTACT" | "OTHER";
type LedgerType = "CREDIT" | "DEBIT" | "PLAN_CHANGE";

interface Subscription {
  id: string;
  daysPerWeek: number;
  scheduleDays: string[];
  scheduleTime: string;
  startDate: string;
  monthlyFee: number;
  isActive: boolean;
}

interface LedgerEntry {
  id: string;
  studentId: string;
  type: LedgerType;
  date: string;
  seq: number;
  sessionDelta: number;
  balanceAfter: number;
  amount?: number;
  method?: PaymentMethod | null;
  paymentStatus?: PaymentStatus;
  attendanceStatus?: AttendanceStatus;
  checkInAt?: string | null;
  daysPerWeek?: number;
  monthlyFee?: number;
  note: string | null;
}

interface Memo {
  id: string;
  category: MemoCategory;
  content: string;
  createdAt: string;
}

interface BalanceInfo {
  balance: number;
  totalPerCycle: number;
  currentCycleUsed: number;
  currentCycleTotal: number;
  currentCycleRemaining: number;
  needsPayment: boolean;
  hasPaymentHistory: boolean;
  hasPendingCredit: boolean;
  paymentState: "OK" | "NEEDS_PAYMENT" | "PENDING_CREDIT" | "NEW" | "NO_SUBSCRIPTION";
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
  unitPrice: number;
  usedAmount: number;
  remainingBalance: number;
  proratedAmount: number;
  isCredit: boolean;
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
  ledger: LedgerEntry[];
  memos: Memo[];
  balanceInfo: BalanceInfo;
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

const paymentStatusBadgeMap: Record<PaymentStatus, { variant: "paid" | "pending"; label: string }> = {
  PAID: { variant: "paid", label: "완납" },
  PENDING: { variant: "pending", label: "미납" },
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
  const [processingPaymentId, setProcessingPaymentId] = useState<string | null>(null);
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
          scheduleDays: student.subscription.scheduleDays,
          scheduleTime: student.subscription.scheduleTime,
          monthlyFee: newPlan.monthlyFee,
          planChange: {
            previousPlan: planPreview.currentPlan.label,
            newPlan: planPreview.newPlan.label,
            proratedAmount: planPreview.proratedAmount,
            isCredit: planPreview.isCredit,
            noPrior: planPreview.noPrior ?? false,
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
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (processingPaymentId) {
        const res = await fetch(`/api/payments/${processingPaymentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "PAID",
            method: paymentMethod,
            amount: Number(paymentAmount),
          }),
        });
        if (!res.ok) throw new Error("결제 처리에 실패했습니다.");
        return res.json();
      } else {
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
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", id] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["unpaid-count"] });
      setShowPaymentModal(false);
      setProcessingPaymentId(null);
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
  const balance = balanceInfo.balance;
  const totalPerCycle = balanceInfo.totalPerCycle;
  const usedSessions = balanceInfo.currentCycleUsed;
  const remainingClasses = balanceInfo.paymentState === "OK" || balanceInfo.paymentState === "PENDING_CREDIT"
    ? balanceInfo.currentCycleRemaining : null;
  const hasCurrentPayment = balanceInfo.paymentState === "OK" || balanceInfo.paymentState === "PENDING_CREDIT";
  const progressPercent = totalPerCycle > 0 && hasCurrentPayment
    ? Math.round((usedSessions / totalPerCycle) * 100)
    : 0;

  // Ledger entries
  const credits = student.ledger.filter((e) => e.type === "CREDIT");
  const debits = student.ledger.filter((e) => e.type === "DEBIT");

  // Unpaid count: PENDING credits
  const unpaidCount = credits.filter((e) => e.paymentStatus === "PENDING").length;
  const unpaidBadge = unpaidCount + (balanceInfo.paymentState === "NEEDS_PAYMENT" || balanceInfo.paymentState === "NEW" ? 1 : 0);

  const detailTabs = BASE_TABS.map((tab) =>
    tab.key === "payments" && unpaidBadge > 0
      ? { ...tab, badge: unpaidBadge }
      : tab
  );

  // Cycle grouping: 버킷 채우기 방식
  // - 첫 번째 결제(CREDIT)부터 DEBIT을 채움
  // - 가득 차면 다음 CREDIT 버킷으로 이동
  // - 모든 CREDIT이 차면 "미결제 출석" 오버플로우 그룹
  // - PLAN_CHANGE는 구간을 나눔 (이전 CREDIT과 이후 CREDIT 분리)
  interface CycleGroup {
    index: number; // CREDIT 그룹: 1,2,3... / 오버플로우: 0
    credit: LedgerEntry | null;
    records: LedgerEntry[]; // DEBIT entries (chronological)
    presentCount: number;
    cycleSize: number;
  }

  const cycleGroups: CycleGroup[] = (() => {
    if (student.ledger.length === 0) return [];

    // 세그먼트 분리: seq(생성 순서) 기준으로 분리해야
    // 플랜 변경 전에 기록한 출석이 날짜와 무관하게 이전 구간에 포함됨
    const seqSorted = [...student.ledger].sort((a, b) => a.seq - b.seq);

    type Segment = { credits: LedgerEntry[]; debits: LedgerEntry[] };
    const segments: Segment[] = [{ credits: [], debits: [] }];

    for (const entry of seqSorted) {
      if (entry.type === "PLAN_CHANGE") {
        segments.push({ credits: [], debits: [] });
      } else if (entry.type === "CREDIT") {
        segments[segments.length - 1].credits.push(entry);
      } else if (entry.type === "DEBIT") {
        segments[segments.length - 1].debits.push(entry);
      }
    }

    // 각 세그먼트 내 DEBIT을 날짜순 정렬 (표시용)
    for (const seg of segments) {
      seg.debits.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    // 각 구간에서 DEBIT을 CREDIT 버킷에 순서대로 채우기
    const allGroups: CycleGroup[] = [];
    let creditNum = 0;

    for (let segIdx = 0; segIdx < segments.length; segIdx++) {
      const seg = segments[segIdx];
      if (seg.credits.length === 0 && seg.debits.length === 0) continue;

      // 이 구간이 PLAN_CHANGE로 끝났는지 (= 마지막 구간이 아닌 경우)
      const endedByPlanChange = segIdx < segments.length - 1;

      // 버킷 생성
      const buckets = seg.credits.map((c) => ({
        credit: c,
        records: [] as LedgerEntry[],
        capacity: c.sessionDelta,
      }));

      // DEBIT을 첫 번째 빈 버킷부터 채우기
      // 결석(ABSENT)은 버킷에 포함하되 capacity를 소모하지 않음
      let bIdx = 0;
      const overflow: LedgerEntry[] = [];

      for (const debit of seg.debits) {
        const countsTowardCapacity = debit.attendanceStatus !== "ABSENT";
        while (bIdx < buckets.length) {
          const counted = buckets[bIdx].records.filter((e) => e.attendanceStatus !== "ABSENT").length;
          if (counted < buckets[bIdx].capacity) break;
          bIdx++;
        }
        if (bIdx < buckets.length) {
          buckets[bIdx].records.push(debit);
        } else if (countsTowardCapacity) {
          overflow.push(debit);
        } else if (buckets.length > 0) {
          // 결석은 마지막 버킷에 붙이기
          buckets[buckets.length - 1].records.push(debit);
        } else {
          overflow.push(debit);
        }
      }

      // 버킷 → 그룹 변환
      for (let i = 0; i < buckets.length; i++) {
        const b = buckets[i];
        creditNum++;
        const pc = b.records.filter((e) => e.attendanceStatus !== "ABSENT").length;

        // 플랜 변경으로 종료된 구간의 마지막 미완 버킷은 사용량으로 용량 고정
        let effectiveCycleSize = b.credit.sessionDelta;
        if (endedByPlanChange && i === buckets.length - 1 && pc < b.credit.sessionDelta) {
          effectiveCycleSize = pc;
        }

        allGroups.push({
          index: creditNum,
          credit: b.credit,
          records: b.records,
          presentCount: pc,
          cycleSize: effectiveCycleSize,
        });
      }

      // 오버플로우 그룹
      if (overflow.length > 0) {
        const pc = overflow.filter((e) => e.attendanceStatus !== "ABSENT").length;
        allGroups.push({
          index: 0,
          credit: null,
          records: overflow,
          presentCount: pc,
          cycleSize: overflow.length,
        });
      }
    }

    return allGroups.reverse(); // most recent first for display
  })();

  // Total stats from ledger
  const totalPaidCredits = credits.filter((e) => e.paymentStatus === "PAID").length;
  const totalPaidSessions = credits
    .filter((e) => e.paymentStatus === "PAID")
    .reduce((sum, e) => sum + e.sessionDelta, 0);
  const totalAttendance = debits.filter((e) => e.attendanceStatus !== "ABSENT").length;

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
      {student.subscription && (balanceInfo.paymentState === "NEEDS_PAYMENT" || balanceInfo.paymentState === "PENDING_CREDIT" || balanceInfo.paymentState === "NEW") && (
        <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-amber-800">
            {balanceInfo.paymentState === "PENDING_CREDIT"
              ? "미결제 항목이 있습니다."
              : balanceInfo.paymentState === "NEW"
                ? "첫 결제가 필요합니다."
                : `결제가 필요합니다. (잔여 ${balance}회)`}
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
              {student.subscription.scheduleDays.map((d) => DAY_LABELS[d] || d).join(", ")}
            </div>
          </Card>
          <Card>
            <div className="text-sm text-gray-500 mb-1">잔여 횟수</div>
            {balance < 0 ? (
              <div className="font-semibold text-red-600">
                {balance}회 (초과)
              </div>
            ) : hasCurrentPayment ? (
              <>
                <div className="font-semibold text-gray-900 mb-2">
                  {remainingClasses} / {totalPerCycle}회
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
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-primary-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-primary-700">{totalPaidCredits}</div>
                <div className="text-xs text-primary-600">총 결제 회차</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">{totalPaidSessions}</div>
                <div className="text-xs text-blue-600">총 결제 수업</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-700">{totalAttendance}</div>
                <div className="text-xs text-green-600">총 출석 일</div>
              </div>
            </div>

            {cycleGroups.length === 0 ? (
              <Card>
                <p className="text-sm text-gray-500 text-center py-4">
                  출석 기록이 없습니다.
                </p>
              </Card>
            ) : (
              cycleGroups.map((group, idx) => {
                const isCurrent = idx === 0;
                const isExpanded = isCurrent
                  ? !expandedCycles.has(-1)
                  : expandedCycles.has(idx);
                const isPaid = group.credit?.paymentStatus === "PAID";
                const isPending = group.credit?.paymentStatus === "PENDING";
                const hasCredit = !!group.credit;
                const creditAmount = group.credit?.amount ?? 0;
                const creditPlan = group.credit?.daysPerWeek
                  ? `주 ${group.credit.daysPerWeek}회`
                  : (student.subscription ? `주 ${student.subscription.daysPerWeek}회` : "");
                const isOverflow = group.index === 0;
                const countedRecords = group.records.filter((e) => e.attendanceStatus !== "ABSENT").length;
                const remaining = hasCredit ? group.cycleSize - countedRecords : 0;
                const groupKey = `${group.index}-${idx}`;

                return (
                  <div
                    key={groupKey}
                    className={cn(
                      "rounded-xl border overflow-hidden",
                      isOverflow || isPending
                        ? "border-amber-200 bg-amber-50/30"
                        : "border-gray-200 bg-white"
                    )}
                  >
                    {/* Cycle header */}
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedCycles((prev) => {
                          const next = new Set(prev);
                          if (isCurrent) {
                            if (next.has(-1)) next.delete(-1);
                            else next.add(-1);
                          } else {
                            const key = idx;
                            if (next.has(key)) next.delete(key);
                            else next.add(key);
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
                                {isOverflow ? "미결제 출석" : `${group.index}회차`}
                                {isCurrent && <span className="text-primary-600"> (현재)</span>}
                              </span>
                              {hasCredit ? (
                                <Badge variant={isPaid ? "paid" : "pending"}>
                                  {isPaid ? "완납" : "미납"}
                                </Badge>
                              ) : (
                                <Badge variant="overdue">미결제</Badge>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {isOverflow
                                ? `${group.presentCount}회 출석 · 결제 대기`
                                : `${formatDateShort(group.credit!.date)} · ${formatCurrency(creditAmount)} · ${creditPlan} · ${group.cycleSize}회`
                              }
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          {isOverflow ? (
                            <div className="text-sm font-semibold text-amber-600">
                              {group.presentCount}회
                            </div>
                          ) : (
                            <>
                              <div className="text-sm font-semibold text-gray-700">
                                {countedRecords}/{group.cycleSize}
                              </div>
                              <div className="text-xs text-gray-500">
                                잔여 {Math.max(0, remaining)}회
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Attendance records */}
                    {isExpanded && (
                      <div className="border-t border-gray-100">
                        {group.records.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-4">출석 기록 없음</p>
                        ) : (
                          <div className="divide-y divide-gray-50">
                            {(() => {
                              let countedSeq = 0;
                              return group.records.map((entry) => {
                              const badge = attendanceBadgeMap[entry.attendanceStatus as AttendanceStatus];
                              const isAbsent = entry.attendanceStatus === "ABSENT";
                              if (!isAbsent) countedSeq++;
                              return (
                                <div
                                  key={entry.id}
                                  className="flex items-center justify-between px-5 py-2.5"
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs font-mono text-gray-400 w-8 text-right">
                                      {isAbsent ? "-" : `${countedSeq}/${group.cycleSize}`}
                                    </span>
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
                            });
                            })()}
                          </div>
                        )}
                        {/* Remaining sessions footer */}
                        {isCurrent && !isOverflow && remaining > 0 && (
                          <div className="border-t border-gray-100 px-5 py-2 bg-gray-50/50">
                            <p className="text-xs text-gray-500 text-center">
                              잔여 {remaining}회 남음
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
            {!credits.some((e) => e.paymentStatus === "PENDING") && (
              <div className="flex justify-end">
                <Button size="sm" onClick={() => {
                  setProcessingPaymentId(null);
                  if (student.subscription) {
                    setPaymentAmount(String(student.subscription.monthlyFee));
                  }
                  setShowPaymentModal(true);
                }}>
                  <CreditCard className="w-4 h-4" />
                  결제 처리
                </Button>
              </div>
            )}
            {/* Unpaid card in payment tab */}
            {(balanceInfo.paymentState === "NEEDS_PAYMENT" || balanceInfo.paymentState === "NEW") && student.subscription && (
              <Card className="border-amber-300 bg-amber-50/50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span className="font-semibold text-gray-900">결제 필요</span>
                      <Badge variant="overdue">미결제</Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      잔여 {balanceInfo.balance}회 · {formatCurrency(student.subscription.monthlyFee)} · {student.subscription.daysPerWeek * 4}회
                    </p>
                  </div>
                  <Button size="sm" onClick={() => {
                    setProcessingPaymentId(null);
                    setPaymentAmount(String(student.subscription!.monthlyFee));
                    setShowPaymentModal(true);
                  }}>
                    결제 처리
                  </Button>
                </div>
              </Card>
            )}

            <Card padding={false}>
              {credits.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  결제 내역이 없습니다.
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {[...credits].reverse().map((entry) => {
                    const statusBdg = paymentStatusBadgeMap[entry.paymentStatus as PaymentStatus];
                    const isPending = entry.paymentStatus === "PENDING";
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between px-5 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {formatDateShort(entry.date)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatCurrency(entry.amount ?? 0)}
                            {entry.method && ` · ${paymentMethodLabel[entry.method as PaymentMethod]}`}
                            {` · ${entry.sessionDelta > 0 ? "+" : ""}${entry.sessionDelta}회`}
                          </div>
                          {entry.note && (
                            <div className="text-xs text-gray-400 mt-0.5 truncate">
                              {entry.note}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isPending && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setProcessingPaymentId(entry.id);
                                setPaymentAmount(String(entry.amount ?? 0));
                                setShowPaymentModal(true);
                              }}
                            >
                              결제 처리
                            </Button>
                          )}
                          {statusBdg && <Badge variant={statusBdg.variant}>{statusBdg.label}</Badge>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Subscription Tab */}
        {activeTab === "subscription" && (
          <div className="space-y-4">
            {student.subscription ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {plans.map((plan) => {
                    const isCurrent = plan.daysPerWeek === student.subscription!.daysPerWeek;
                    const isSelected = selectedPlan === plan.daysPerWeek;
                    const isActive = isSelected || (!selectedPlan && isCurrent);
                    return (
                      <button
                        key={plan.daysPerWeek}
                        type="button"
                        onClick={() => {
                          if (isCurrent) setSelectedPlan(null);
                          else setSelectedPlan(plan.daysPerWeek);
                        }}
                        className={cn(
                          "relative flex flex-col items-center gap-1 py-4 px-2 rounded-xl border-2 transition-colors",
                          isActive
                            ? "border-primary-500 bg-primary-50"
                            : "border-gray-200 hover:border-gray-300",
                          false
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
                      <span className="text-sm font-semibold text-amber-800">플랜 변경 차액</span>
                    </div>
                    <div className="space-y-1.5 text-sm">
                      {planPreview.remainingBalance === 0 ? (
                        <>
                          <div className="flex justify-between text-gray-600">
                            <span>현재 사이클</span>
                            <span>모든 세션 사용 완료</span>
                          </div>
                          <div className="flex justify-between text-gray-600">
                            <span>새 플랜 수강료</span>
                            <span>{formatCurrency(planPreview.newPlan.monthlyFee)}</span>
                          </div>
                          <div className="border-t border-amber-300 my-2" />
                          <div className="flex justify-between font-bold text-amber-900">
                            <span>납부액</span>
                            <span>{formatCurrency(planPreview.proratedAmount)}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between text-gray-600">
                            <span>현재 사이클 사용</span>
                            <span>{planPreview.usedSessions}/{planPreview.currentPlan.totalSessions}회 × {formatCurrency(planPreview.unitPrice)}</span>
                          </div>
                          <div className="flex justify-between text-gray-600">
                            <span>{planPreview.remainingBalance < 0 ? "미결제 초과분" : "잔여 금액"}</span>
                            <span>{planPreview.remainingBalance < 0 ? `+${formatCurrency(Math.abs(planPreview.remainingBalance))}` : formatCurrency(planPreview.remainingBalance)}</span>
                          </div>
                          <div className="flex justify-between text-gray-600">
                            <span>새 플랜 수강료</span>
                            <span>{formatCurrency(planPreview.newPlan.monthlyFee)}</span>
                          </div>
                          <div className="border-t border-amber-300 my-2" />
                          <div className="flex justify-between font-bold text-amber-900">
                            <span>{planPreview.isCredit ? "환불 금액" : "추가 납부액"}</span>
                            <span>{planPreview.isCredit ? "-" : ""}{formatCurrency(planPreview.proratedAmount)}</span>
                          </div>
                        </>
                      )}
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
                          {usedSessions} / {totalPerCycle}회
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
                          <span>사용 {usedSessions}회</span>
                          <span>잔여 {remainingClasses}회</span>
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
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-500">수강 요일</div>
                      <div className="font-medium text-gray-900">
                        {student.subscription.scheduleDays.map((d) => DAY_LABELS[d] || d).join(", ")}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">수업 시간</div>
                      <div className="font-medium text-gray-900">
                        {student.subscription.scheduleTime ? `오후 ${parseInt(student.subscription.scheduleTime) - 12}시` : "-"}
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
        onClose={() => { setShowPaymentModal(false); setProcessingPaymentId(null); }}
        title="결제 처리"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowPaymentModal(false); setProcessingPaymentId(null); }}>취소</Button>
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
              <div className="flex justify-between font-semibold pt-1 border-t border-gray-200 mt-1">
                <span>{planPreview.isCredit ? "환불 금액" : "추가 납부액"}</span>
                <span className={planPreview.isCredit ? "text-green-600" : "text-amber-600"}>
                  {planPreview.isCredit ? "-" : "+"}{formatCurrency(planPreview.proratedAmount)}
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
