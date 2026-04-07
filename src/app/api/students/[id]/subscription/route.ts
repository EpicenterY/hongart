import { NextRequest, NextResponse } from "next/server";
import {
  getSubscriptionByStudentId,
  updateSubscription,
  createSubscription,
  getBalance,
  addPlanChange,
  addCredit,
  deleteLedgerEntry,
  getLedgerByStudentId,
  PaymentStatus,
} from "@/lib/mock-data";

interface PlanChangeData {
  previousPlan: string;
  newPlan: string;
  proratedAmount: number;
  isCredit: boolean;
  noPrior?: boolean;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: studentId } = await params;

  try {
    const body = await request.json();
    const { daysPerWeek, scheduleDays, scheduleTime, monthlyFee, planChange } =
      body as {
        daysPerWeek?: number;
        scheduleDays?: string[];
        scheduleTime?: string;
        monthlyFee?: number;
        planChange?: PlanChangeData;
      };

    const existing = getSubscriptionByStudentId(studentId);

    if (existing) {
      if (planChange) {
        const newDaysPerWeek = daysPerWeek ?? existing.daysPerWeek;
        const newMonthlyFee = monthlyFee ?? existing.monthlyFee;

        if (planChange.noPrior) {
          // No payment history: just change subscription
          updateSubscription(existing.id, {
            daysPerWeek: newDaysPerWeek,
            scheduleDays: scheduleDays ?? existing.scheduleDays,
            scheduleTime: scheduleTime ?? existing.scheduleTime,
            monthlyFee: newMonthlyFee,
          });
          const updated = getSubscriptionByStudentId(studentId);
          return NextResponse.json(updated);
        }

        // Clean up previous pending plan change (if user changed plan again before paying)
        const ledger = getLedgerByStudentId(studentId);
        const pendingCredit = ledger.find(
          (e) => e.type === "CREDIT" && e.paymentStatus === PaymentStatus.PENDING
        );
        if (pendingCredit) {
          // Find the PLAN_CHANGE that preceded this pending credit
          const precedingPlanChange = [...ledger]
            .filter((e) => e.type === "PLAN_CHANGE" && e.seq < pendingCredit.seq)
            .sort((a, b) => b.seq - a.seq)[0];

          // Revert subscription to the state before the previous plan change
          if (precedingPlanChange?.daysPerWeek && precedingPlanChange?.monthlyFee) {
            updateSubscription(existing.id, {
              daysPerWeek: precedingPlanChange.daysPerWeek,
              monthlyFee: precedingPlanChange.monthlyFee,
            });
          }

          // Delete pending credit and plan change to restore balance
          deleteLedgerEntry(pendingCredit.id);
          if (precedingPlanChange) {
            deleteLedgerEntry(precedingPlanChange.id);
          }
        }

        const balance = getBalance(studentId);

        // Plan change with proration (works for balance > 0, = 0, < 0)
        const now = new Date();

        // 1) PLAN_CHANGE entry: zero out remaining balance
        addPlanChange({
          studentId,
          date: now,
          sessionDelta: -balance,
          note: `플랜 변경 (${planChange.previousPlan} → ${planChange.newPlan})`,
        });

        // 2) Calculate prorated amount (before subscription update)
        const oldUnitPrice = Math.round(existing.monthlyFee / (existing.daysPerWeek * 4));
        const remainingCredit = balance * oldUnitPrice;
        const proratedAmount = Math.round((newMonthlyFee - remainingCredit) / 1000) * 1000;

        // 3) Update subscription BEFORE addCredit so snapshot reflects new plan
        updateSubscription(existing.id, {
          daysPerWeek: newDaysPerWeek,
          scheduleDays: scheduleDays ?? existing.scheduleDays,
          scheduleTime: scheduleTime ?? existing.scheduleTime,
          monthlyFee: newMonthlyFee,
        });

        // 4) Create CREDIT entry (now snapshots new plan correctly)
        const newTotalPerCycle = newDaysPerWeek * 4;
        if (proratedAmount > 0) {
          // Need additional payment: PENDING CREDIT
          addCredit({
            studentId,
            date: now,
            sessionDelta: newTotalPerCycle,
            amount: proratedAmount,
            method: null,
            paymentStatus: PaymentStatus.PENDING,
            note: `플랜 변경 차액 (${planChange.previousPlan} → ${planChange.newPlan})`,
          });
        } else {
          // Credit surplus: PAID CREDIT (auto-applied)
          addCredit({
            studentId,
            date: now,
            sessionDelta: newTotalPerCycle,
            amount: Math.abs(proratedAmount),
            method: null,
            paymentStatus: PaymentStatus.PAID,
            note: `플랜 변경 크레딧 (${planChange.previousPlan} → ${planChange.newPlan})`,
          });
        }

        const updated = getSubscriptionByStudentId(studentId);
        return NextResponse.json(updated);
      }

      // Normal update (no plan change)
      const updated = updateSubscription(existing.id, {
        daysPerWeek: daysPerWeek ?? existing.daysPerWeek,
        scheduleDays: scheduleDays ?? existing.scheduleDays,
        scheduleTime: scheduleTime ?? existing.scheduleTime,
        monthlyFee: monthlyFee ?? existing.monthlyFee,
      });

      return NextResponse.json(updated);
    }

    // Create new subscription if none exists
    if (!daysPerWeek || !scheduleDays || !monthlyFee) {
      return NextResponse.json(
        { error: "daysPerWeek, scheduleDays, monthlyFee는 필수입니다." },
        { status: 400 }
      );
    }

    const now = new Date();
    const created = createSubscription({
      studentId,
      daysPerWeek,
      scheduleDays,
      scheduleTime: scheduleTime || "15:00",
      monthlyFee,
      startDate: now,
      endDate: null,
      isActive: true,
    });

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
}
