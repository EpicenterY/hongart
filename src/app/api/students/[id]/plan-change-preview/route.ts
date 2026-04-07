import { NextRequest, NextResponse } from "next/server";
import {
  getSubscriptionByStudentId,
  getBalance,
  getBalanceInfo,
  getPlans,
  getLedgerByStudentId,
  PaymentStatus,
} from "@/lib/mock-data";

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

  const subscription = getSubscriptionByStudentId(studentId);
  if (!subscription) {
    return NextResponse.json(
      { error: "활성 수강 정보가 없습니다." },
      { status: 404 }
    );
  }

  const plans = getPlans();

  // If there's a pending plan change, use the original plan (before the pending change)
  const ledger = getLedgerByStudentId(studentId);
  const pendingCredit = ledger.find(
    (e) => e.type === "CREDIT" && e.paymentStatus === PaymentStatus.PENDING
  );
  let effectiveDaysPerWeek = subscription.daysPerWeek;
  let effectiveMonthlyFee = subscription.monthlyFee;
  if (pendingCredit) {
    const precedingPlanChange = [...ledger]
      .filter((e) => e.type === "PLAN_CHANGE" && e.seq < pendingCredit.seq)
      .sort((a, b) => b.seq - a.seq)[0];
    if (precedingPlanChange?.daysPerWeek && precedingPlanChange?.monthlyFee) {
      effectiveDaysPerWeek = precedingPlanChange.daysPerWeek;
      effectiveMonthlyFee = precedingPlanChange.monthlyFee;
    }
  }

  const currentPlan = plans.find(
    (p) => p.daysPerWeek === effectiveDaysPerWeek
  );
  const newPlan = plans.find((p) => p.daysPerWeek === newDaysPerWeek);

  if (!currentPlan || !newPlan) {
    return NextResponse.json(
      { error: "플랜 정보를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const balanceInfo = getBalanceInfo(studentId);

  // No payment history: no proration needed
  // Check original payment history (exclude pending credits from plan changes)
  const paidCredits = ledger.filter(
    (e) => e.type === "CREDIT" && e.paymentStatus === PaymentStatus.PAID
  );
  if (paidCredits.length === 0) {
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
      unitPrice: 0,
      usedAmount: 0,
      remainingBalance: 0,
      proratedAmount: 0,
      isCredit: false,
    });
  }

  let balance = getBalance(studentId);

  // If there's a pending plan change, restore balance to pre-plan-change state
  if (pendingCredit) {
    const precedingPlanChange = [...ledger]
      .filter((e) => e.type === "PLAN_CHANGE" && e.seq < pendingCredit.seq)
      .sort((a, b) => b.seq - a.seq)[0];
    if (precedingPlanChange) {
      balance = balance - precedingPlanChange.sessionDelta;
    }
  }

  // Calculate proration for all cases (balance > 0, = 0, < 0)
  const totalSessions = currentPlan.daysPerWeek * 4;
  const unitPrice = Math.round(currentPlan.monthlyFee / totalSessions);
  const remainingCredit = balance * unitPrice;
  const rawDiff = newPlan.monthlyFee - remainingCredit;
  const proratedAmount = Math.round(rawDiff / 1000) * 1000;
  const isCredit = proratedAmount < 0;

  const usedSessions = Math.max(0, totalSessions - balance);

  return NextResponse.json({
    noPrior: false,
    currentPlan: {
      daysPerWeek: currentPlan.daysPerWeek,
      label: currentPlan.label,
      monthlyFee: currentPlan.monthlyFee,
      totalSessions,
    },
    newPlan: {
      daysPerWeek: newPlan.daysPerWeek,
      label: newPlan.label,
      monthlyFee: newPlan.monthlyFee,
      totalSessions: newPlan.daysPerWeek * 4,
    },
    usedSessions,
    unitPrice,
    usedAmount: usedSessions * unitPrice,
    remainingBalance: remainingCredit,
    proratedAmount: Math.abs(proratedAmount),
    isCredit,
  });
}
