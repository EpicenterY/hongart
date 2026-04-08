import { NextRequest, NextResponse } from "next/server";
import {
  getSubscriptionByStudentId,
  getPlans,
  getPaymentSessionsByStudentId,
  getAttendanceByStudentId,
} from "@/lib/db";
import { computeFilling } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: studentId } = await params;
  const { searchParams } = new URL(request.url);
  const newDaysPerWeek = Number(searchParams.get("newDaysPerWeek"));

  if (!newDaysPerWeek || ![1, 2, 3].includes(newDaysPerWeek)) {
    return NextResponse.json(
      { error: "newDaysPerWeek는 1, 2, 3 중 하나여야 합니다." },
      { status: 400 }
    );
  }

  const subscription = await getSubscriptionByStudentId(studentId);
  if (!subscription) {
    return NextResponse.json(
      { error: "활성 수강 정보가 없습니다." },
      { status: 404 }
    );
  }

  const plans = await getPlans();
  const currentPlan = plans.find((p) => p.daysPerWeek === subscription.daysPerWeek);
  const newPlan = plans.find((p) => p.daysPerWeek === newDaysPerWeek);

  if (!currentPlan || !newPlan) {
    return NextResponse.json(
      { error: "플랜 정보를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const sessions = await getPaymentSessionsByStudentId(studentId);
  const hasPaymentHistory = sessions.length > 0;

  if (!hasPaymentHistory) {
    return NextResponse.json({
      noPrior: true,
      currentPlan: {
        daysPerWeek: currentPlan.daysPerWeek,
        label: currentPlan.label,
        monthlyFee: currentPlan.monthlyFee,
        totalSessions: currentPlan.daysPerWeek * 4,
      },
      newPlan: {
        daysPerWeek: newPlan.daysPerWeek,
        label: newPlan.label,
        monthlyFee: newPlan.monthlyFee,
        totalSessions: newPlan.daysPerWeek * 4,
      },
      usedSessions: 0,
      unusedCredit: 0,
      recommendedAmount: newPlan.monthlyFee,
      isCredit: false,
    });
  }

  const records = await getAttendanceByStudentId(studentId);
  const filling = computeFilling(sessions, records);

  const activeSession = [...sessions]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .find((s) => !s.frozen);

  let usedSessions = 0;
  let originalCapacity = 0;

  if (activeSession) {
    const fs = filling.filledSessions.find((f) => f.session.id === activeSession.id);
    usedSessions = fs?.filledCount ?? 0;
    originalCapacity = activeSession.daysPerWeek * 4;
  }

  const unusedCount = originalCapacity - usedSessions;
  const sessionMonthlyFee = activeSession?.monthlyFee ?? currentPlan.monthlyFee;
  const unusedCredit = originalCapacity > 0
    ? Math.round(unusedCount * (sessionMonthlyFee / originalCapacity))
    : 0;
  const rawAmount = newPlan.monthlyFee - unusedCredit;
  const isCredit = rawAmount < 0;
  const recommendedAmount = Math.abs(rawAmount);

  return NextResponse.json({
    noPrior: false,
    currentPlan: {
      daysPerWeek: currentPlan.daysPerWeek,
      label: currentPlan.label,
      monthlyFee: currentPlan.monthlyFee,
      totalSessions: currentPlan.daysPerWeek * 4,
    },
    newPlan: {
      daysPerWeek: newPlan.daysPerWeek,
      label: newPlan.label,
      monthlyFee: newPlan.monthlyFee,
      totalSessions: newPlan.daysPerWeek * 4,
    },
    usedSessions,
    unusedCount,
    unusedCredit,
    recommendedAmount,
    isCredit,
  });
}
