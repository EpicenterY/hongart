"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { Card, Button, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface AnalyticsData {
  monthlyTrend: { month: string; rate: number }[];
  dailyDistribution: { day: string; count: number }[];
  studentRanking: {
    studentId: string;
    name: string;
    rate: number;
    presentCount: number;
    totalCount: number;
  }[];
}

const PERIODS = [
  { key: "1m", label: "최근 1개월" },
  { key: "3m", label: "최근 3개월" },
  { key: "6m", label: "최근 6개월" },
];

function formatMonth(month: string) {
  const [, m] = month.split("-");
  return `${parseInt(m)}월`;
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("3m");

  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["analytics", period],
    queryFn: async () => {
      const res = await fetch(`/api/analytics?period=${period}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  return (
    <div className="px-4 py-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">통계</h1>

      {/* Period Selector */}
      <div className="flex gap-2 mb-6">
        {PERIODS.map((p) => (
          <Button
            key={p.key}
            variant={period === p.key ? "primary" : "secondary"}
            size="sm"
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {isLoading || !data ? (
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
              <div className="h-48 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Monthly Attendance Trend */}
          <Card header={<h2 className="font-semibold text-gray-900">월간 출석률 추이</h2>}>
            {data.monthlyTrend.length === 0 ? (
              <EmptyState icon={BarChart3} title="데이터가 없습니다" />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.monthlyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 13 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                    <Tooltip
                      formatter={(value) => [`${value}%`, "출석률"]}
                      labelFormatter={(label) => formatMonth(String(label))}
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={{ fill: "#6366f1", r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Daily Distribution */}
          <Card header={<h2 className="font-semibold text-gray-900">요일별 출석 분포</h2>}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.dailyDistribution} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="day" tick={{ fontSize: 13 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => [`${value}회`, "출석"]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                  />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Student Ranking */}
          <Card header={<h2 className="font-semibold text-gray-900">학생별 출석 순위</h2>}>
            {data.studentRanking.length === 0 ? (
              <EmptyState icon={BarChart3} title="데이터가 없습니다" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-left font-medium text-gray-500">순위</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">이름</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">출석률</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">출석/전체</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.studentRanking.map((student, idx) => (
                      <tr key={student.studentId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 font-medium">{idx + 1}</td>
                        <td className="px-4 py-3 text-gray-900">{student.name}</td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={cn(
                              "font-medium",
                              student.rate >= 80
                                ? "text-green-600"
                                : student.rate >= 50
                                  ? "text-amber-600"
                                  : "text-red-600"
                            )}
                          >
                            {student.rate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">
                          {student.presentCount}/{student.totalCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
