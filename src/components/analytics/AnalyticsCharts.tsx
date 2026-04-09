"use client";

import { Card, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { BarChart3, Trophy } from "lucide-react";
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
  Cell,
  PieChart,
  Pie,
} from "recharts";

interface AnalyticsData {
  monthlyRevenue: { month: string; amount: number }[];
  studentCountTrend: { month: string; count: number }[];
  planDistribution: { plan: string; count: number; percentage: number }[];
  longestStudents: { name: string; months: number; startDate: string }[];
}

function fmtMonth(month: string) {
  const [y, m] = month.split("-");
  return `${y.slice(2)}.${parseInt(m)}월`;
}

function fmtMonthShort(month: string) {
  const [, m] = month.split("-");
  return `${parseInt(m)}월`;
}

const PLAN_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444"];

export default function AnalyticsCharts({ data }: { data: AnalyticsData }) {
  const totalRevenue = data.monthlyRevenue.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6">
      {/* 1. 월별 결제 금액 집계 */}
      <Card
        header={
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">월별 결제 금액</h2>
            <span className="text-sm text-gray-500">
              누적 {formatCurrency(totalRevenue)}
            </span>
          </div>
        }
      >
        {data.monthlyRevenue.length === 0 ? (
          <EmptyState icon={BarChart3} title="데이터가 없습니다" />
        ) : (
          <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyRevenue} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tickFormatter={fmtMonthShort} tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${Math.round(v / 10000).toLocaleString()}만`}
                  />
                  <Tooltip
                    formatter={(value) => [formatCurrency(Number(value)), "결제액"]}
                    labelFormatter={(label) => fmtMonth(String(label))}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                  />
                  <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-medium text-gray-500">월</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">결제액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.monthlyRevenue.map((r) => (
                    <tr key={r.month} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-900">{fmtMonth(r.month)}</td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900">
                        {formatCurrency(r.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* 2. 매출 변동 추이 */}
      <Card header={<h2 className="font-semibold text-gray-900">매출 변동 추이</h2>}>
        {data.monthlyRevenue.length === 0 ? (
          <EmptyState icon={BarChart3} title="데이터가 없습니다" />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.monthlyRevenue} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tickFormatter={fmtMonthShort} tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${Math.round(v / 10000).toLocaleString()}만`}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), "매출"]}
                  labelFormatter={(label) => fmtMonth(String(label))}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
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

      {/* 3. 학생수 변동 추이 */}
      <Card header={<h2 className="font-semibold text-gray-900">학생수 변동 추이</h2>}>
        {data.studentCountTrend.length === 0 ? (
          <EmptyState icon={BarChart3} title="데이터가 없습니다" />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.studentCountTrend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tickFormatter={fmtMonthShort} tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => [`${value}명`, "수강 학생수"]}
                  labelFormatter={(label) => fmtMonth(String(label))}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: "#10b981", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* 4. 플랜별 비중 */}
      <Card header={<h2 className="font-semibold text-gray-900">플랜별 비중</h2>}>
        {data.planDistribution.length === 0 ? (
          <EmptyState icon={BarChart3} title="데이터가 없습니다" />
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="h-56 w-56 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.planDistribution}
                    dataKey="count"
                    nameKey="plan"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                    paddingAngle={2}
                    label={(props) => `${props.name ?? ""} ${Math.round((props.percent ?? 0) * 100)}%`}
                    labelLine={false}
                  >
                    {data.planDistribution.map((_, i) => (
                      <Cell key={i} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${value}명`, String(name)]}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 w-full">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-medium text-gray-500">플랜</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">인원</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">비중</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.planDistribution.map((p, i) => (
                    <tr key={p.plan} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full inline-block"
                            style={{ backgroundColor: PLAN_COLORS[i % PLAN_COLORS.length] }}
                          />
                          {p.plan}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{p.count}명</td>
                      <td className="px-3 py-2 text-right text-gray-500">{p.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* 5. 장기 학생 랭킹 TOP 30 */}
      <Card header={<h2 className="font-semibold text-gray-900">장기 학생 랭킹 TOP 30</h2>}>
        {data.longestStudents.length === 0 ? (
          <EmptyState icon={Trophy} title="데이터가 없습니다" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">순위</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">이름</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">등록 시작</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">수강 기간</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.longestStudents.map((student, idx) => (
                  <tr key={`${student.name}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "font-semibold",
                          idx === 0 ? "text-yellow-500" : idx === 1 ? "text-gray-400" : idx === 2 ? "text-amber-600" : "text-gray-900"
                        )}
                      >
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium">{student.name}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{fmtMonth(student.startDate)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{student.months}개월</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
