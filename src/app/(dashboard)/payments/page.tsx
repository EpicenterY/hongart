"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Calendar, AlertTriangle, Clock } from "lucide-react";
import { Card, Badge, Tabs, EmptyState } from "@/components/ui";
import { formatCurrency } from "@/lib/format";

interface PaymentSessionEntry {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  method: string;
  capacity: number;
  frozen: boolean;
  daysPerWeek: number;
  monthlyFee: number;
  date: string;
  note: string | null;
}

interface UnpaidStudent {
  studentId: string;
  studentName: string;
  remaining: number;
  monthlyFee: number;
  capacity: number;
}

interface PaymentsResponse {
  credits: PaymentSessionEntry[];
  unpaidStudents: UnpaidStudent[];
}

const METHOD_LABEL: Record<string, string> = {
  CASH: "결제선생",
  CARD: "카드",
  TRANSFER: "계좌이체",
};

export default function PaymentsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("unpaid");

  const { data, isLoading } = useQuery<PaymentsResponse>({
    queryKey: ["payments"],
    queryFn: async () => {
      const res = await fetch(`/api/payments`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const sessions = data?.credits ?? [];
  const allUnpaid = data?.unpaidStudents ?? [];

  // Split: 미결제 (remaining < 0) vs 결제대기 (remaining === 0)
  const overdueStudents = allUnpaid.filter((s) => s.remaining < 0).sort((a, b) => a.remaining - b.remaining);
  const pendingStudents = allUnpaid.filter((s) => s.remaining === 0);

  const tabs = [
    { key: "unpaid", label: "미결제", badge: overdueStudents.length || undefined },
    { key: "pending", label: "결제대기", badge: pendingStudents.length || undefined },
    { key: "paid", label: "결제 완료", count: sessions.length },
  ];

  return (
    <div className="px-4 py-6 lg:px-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">결제 관리</h1>
      </div>

      <div className="mb-6">
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
              <div className="h-3 bg-gray-200 rounded w-32" />
            </div>
          ))}
        </div>
      ) : activeTab === "unpaid" ? (
        <div className="space-y-3">
          {overdueStudents.map((student) => (
            <Card
              key={student.studentId}
              className="border-red-300 bg-red-50/30 cursor-pointer hover:border-red-400 transition-colors"
              onClick={() => router.push(`/students/${student.studentId}?tab=payments`)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 truncate">
                      {student.studentName}
                    </span>
                    <Badge variant="overdue">미결제</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1 text-red-600 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      잔여 {student.remaining}회
                    </span>
                    {student.monthlyFee > 0 && (
                      <span className="font-medium text-gray-900">
                        {formatCurrency(student.monthlyFee)} · {student.capacity}회
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {overdueStudents.length === 0 && (
            <EmptyState
              icon={CreditCard}
              title="미결제 학생이 없습니다"
              description="초과 사용 중인 학생이 없습니다."
            />
          )}
        </div>
      ) : activeTab === "pending" ? (
        <div className="space-y-3">
          {pendingStudents.map((student) => (
            <Card
              key={student.studentId}
              className="border-yellow-300 bg-yellow-50/30 cursor-pointer hover:border-yellow-400 transition-colors"
              onClick={() => router.push(`/students/${student.studentId}?tab=payments`)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 truncate">
                      {student.studentName}
                    </span>
                    <Badge variant="pending">결제대기</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1 text-yellow-600 font-semibold">
                      <Clock className="w-3.5 h-3.5" />
                      잔여 0회
                    </span>
                    {student.monthlyFee > 0 && (
                      <span className="font-medium text-gray-900">
                        {formatCurrency(student.monthlyFee)} · {student.capacity}회
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {pendingStudents.length === 0 && (
            <EmptyState
              icon={Clock}
              title="결제대기 학생이 없습니다"
              description="잔여 횟수가 0인 학생이 없습니다."
            />
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="결제 내역이 없습니다"
              description="완료된 결제 내역이 없습니다."
            />
          ) : (
            sessions.map((session) => (
              <Card
                key={session.id}
                className="cursor-pointer hover:border-gray-300 transition-colors"
                onClick={() => router.push(`/students/${session.studentId}?tab=payments`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 truncate">{session.studentName}</span>
                      <Badge variant="paid">완료</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(session.date).toLocaleDateString("ko-KR")}
                      </span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(session.amount)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {session.capacity}회
                      </span>
                    </div>
                    {session.method && (
                      <p className="text-xs text-gray-400 mt-1">
                        {METHOD_LABEL[session.method] || session.method}
                        {session.note && ` | ${session.note}`}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

    </div>
  );
}
