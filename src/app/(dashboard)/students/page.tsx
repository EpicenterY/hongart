"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Users } from "lucide-react";
import { Button, Badge, Card, Table, EmptyState } from "@/components/ui";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { formatCurrency, DAY_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";

type StudentStatus = "ACTIVE" | "PAUSED" | "WITHDRAWN";

interface StudentListItem {
  id: string;
  name: string;
  phone: string | null;
  parentPhone: string | null;
  status: StudentStatus;
  subscription: {
    daysPerWeek: number;
    scheduleDays: string[];
    monthlyFee: number;
  } | null;
  remainingClasses: number | null;
  paymentState: "OK" | "NEEDS_PAYMENT" | "PENDING_CREDIT" | "NEW" | "NO_SUBSCRIPTION" | null;
}

const STATUS_TABS = [
  { key: "ALL", label: "전체" },
  { key: "ACTIVE", label: "활성" },
  { key: "PAUSED", label: "휴원" },
  { key: "WITHDRAWN", label: "퇴원" },
] as const;

const statusBadgeMap: Record<StudentStatus, { variant: "active" | "paused" | "withdrawn"; label: string }> = {
  ACTIVE: { variant: "active", label: "활성" },
  PAUSED: { variant: "paused", label: "휴원" },
  WITHDRAWN: { variant: "withdrawn", label: "퇴원" },
};

export default function StudentsPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const { data: students = [], isLoading } = useQuery<StudentListItem[]>({
    queryKey: ["students", { search, status: statusFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const res = await fetch(`/api/students?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch students");
      return res.json();
    },
  });

  const columns = [
    {
      key: "name",
      header: "이름",
      render: (row: Record<string, unknown>) => {
        const item = row as unknown as StudentListItem;
        return <span className="font-medium">{item.name}</span>;
      },
    },
    {
      key: "status",
      header: "상태",
      render: (row: Record<string, unknown>) => {
        const item = row as unknown as StudentListItem;
        const badge = statusBadgeMap[item.status];
        return <Badge variant={badge.variant}>{badge.label}</Badge>;
      },
    },
    {
      key: "plan",
      header: "수강플랜",
      render: (row: Record<string, unknown>) => {
        const item = row as unknown as StudentListItem;
        if (!item.subscription) return <span className="text-gray-400">-</span>;
        const days = item.subscription.scheduleDays.map((d) => DAY_LABELS[d] || d).join(", ");
        return <span>주 {item.subscription.daysPerWeek}회 ({days})</span>;
      },
    },
    {
      key: "remaining",
      header: "잔여횟수",
      render: (row: Record<string, unknown>) => {
        const item = row as unknown as StudentListItem;
        if (item.paymentState === "NEEDS_PAYMENT" || item.paymentState === "NEW") return <Badge variant="overdue">미결제</Badge>;
        if (item.paymentState === "PENDING_CREDIT") return <Badge variant="overdue">미결제</Badge>;
        if (item.remainingClasses === null) return <span className="text-gray-400">-</span>;
        return <span>{item.remainingClasses}회</span>;
      },
    },
    {
      key: "contact",
      header: "연락처",
      render: (row: Record<string, unknown>) => {
        const item = row as unknown as StudentListItem;
        return <span>{item.phone || item.parentPhone || "-"}</span>;
      },
    },
  ];

  const handleRowClick = (item: StudentListItem) => {
    router.push(`/students/${item.id}`);
  };

  return (
    <div className="px-4 py-6 lg:px-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">학생 관리</h1>
        <Button onClick={() => router.push("/students/new")}>
          <Plus className="w-4 h-4" />
          학생 등록
        </Button>
      </div>

      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="이름, 학교, 연락처 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 w-full sm:w-72 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500"
          />
        </div>

        <div className="flex gap-1 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors",
                statusFilter === tab.key
                  ? "bg-primary-600 text-white"
                  : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {!isLoading && students.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="등록된 학생이 없습니다"
            description="새 학생을 등록하여 관리를 시작하세요."
            action={
              <Button onClick={() => router.push("/students/new")}>
                <Plus className="w-4 h-4" />
                학생 등록
              </Button>
            }
          />
        </Card>
      ) : isMobile ? (
        <div className="space-y-3">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 animate-pulse">
                  <div className="h-5 bg-gray-200 rounded w-24" />
                  <div className="h-4 bg-gray-200 rounded w-36" />
                  <div className="h-4 bg-gray-200 rounded w-20" />
                </div>
              ))
            : students.map((student) => {
                const statusBadge = statusBadgeMap[student.status];
                const days = student.subscription?.scheduleDays.map((d) => DAY_LABELS[d] || d).join(", ");
                return (
                  <div
                    key={student.id}
                    className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer active:bg-gray-50 transition-colors"
                    onClick={() => handleRowClick(student)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-900">{student.name}</span>
                      <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                    </div>
                    {student.subscription && (
                      <p className="text-sm text-gray-600 mb-1">
                        주 {student.subscription.daysPerWeek}회 ({days}) · {formatCurrency(student.subscription.monthlyFee)}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        {student.paymentState === "NEEDS_PAYMENT" || student.paymentState === "NEW" || student.paymentState === "PENDING_CREDIT"
                          ? <Badge variant="overdue">미결제</Badge>
                          : `잔여 ${student.remainingClasses ?? "-"}회`}
                      </span>
                    </div>
                  </div>
                );
              })}
        </div>
      ) : (
        <Card padding={false}>
          <Table
            columns={columns}
            data={students as unknown as Record<string, unknown>[]}
            onRowClick={(item) => handleRowClick(item as unknown as StudentListItem)}
            isLoading={isLoading}
            emptyMessage="등록된 학생이 없습니다"
          />
        </Card>
      )}
    </div>
  );
}
