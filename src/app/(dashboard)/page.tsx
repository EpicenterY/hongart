import { CalendarCheck, Users, CreditCard, TrendingUp } from "lucide-react";

export default function HomePage() {
  return (
    <div className="px-4 py-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">대시보드</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          icon={<CalendarCheck className="w-5 h-5 text-status-present" />}
          label="오늘 출석"
          value="-"
        />
        <SummaryCard
          icon={<Users className="w-5 h-5 text-primary-500" />}
          label="전체 학생"
          value="-"
        />
        <SummaryCard
          icon={<CreditCard className="w-5 h-5 text-payment-paid" />}
          label="이번 달 결제"
          value="-"
        />
        <SummaryCard
          icon={<TrendingUp className="w-5 h-5 text-primary-400" />}
          label="출석률"
          value="-"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-gray-500 text-center py-8">
          대시보드 콘텐츠 준비 중입니다.
        </p>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
