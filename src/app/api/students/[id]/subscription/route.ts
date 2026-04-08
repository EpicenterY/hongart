import { NextRequest, NextResponse } from "next/server";
import {
  getSubscriptionByStudentId,
  updateSubscription,
  createSubscription,
  freezeCurrentSession,
  createPendingPlanChange,
} from "@/lib/db";
import type { ScheduleSlot } from "@/lib/types";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: studentId } = await params;

  try {
    const body = await request.json();
    const { daysPerWeek, schedule, monthlyFee, planChange } =
      body as {
        daysPerWeek?: number;
        schedule?: ScheduleSlot[];
        monthlyFee?: number;
        planChange?: {
          previousPlan: string;
          newPlan: string;
          noPrior?: boolean;
          recommendedAmount?: number;
          isCredit?: boolean;
        };
      };

    const existing = await getSubscriptionByStudentId(studentId);

    if (existing) {
      if (planChange) {
        const newDaysPerWeek = daysPerWeek ?? existing.daysPerWeek;
        const newMonthlyFee = monthlyFee ?? existing.monthlyFee;

        const previousDaysPerWeek = existing.daysPerWeek;
        const previousSchedule = [...existing.schedule];
        const previousMonthlyFee = existing.monthlyFee;

        let frozenSessionId: string | null = null;
        if (!planChange.noPrior) {
          const frozen = await freezeCurrentSession(studentId);
          frozenSessionId = frozen?.id ?? null;
        }

        await updateSubscription(existing.id, {
          daysPerWeek: newDaysPerWeek,
          schedule: schedule ?? existing.schedule,
          monthlyFee: newMonthlyFee,
        });

        await createPendingPlanChange({
          studentId,
          previousDaysPerWeek,
          previousSchedule,
          previousMonthlyFee,
          frozenSessionId,
          recommendedAmount: planChange.recommendedAmount ?? newMonthlyFee,
          isCredit: planChange.isCredit ?? false,
        });

        const updated = await getSubscriptionByStudentId(studentId);
        return NextResponse.json(updated);
      }

      // Normal update (no plan change)
      const updated = await updateSubscription(existing.id, {
        daysPerWeek: daysPerWeek ?? existing.daysPerWeek,
        schedule: schedule ?? existing.schedule,
        monthlyFee: monthlyFee ?? existing.monthlyFee,
      });

      return NextResponse.json(updated);
    }

    // Create new subscription if none exists
    if (!daysPerWeek || !schedule || !monthlyFee) {
      return NextResponse.json(
        { error: "daysPerWeek, schedule, monthlyFee는 필수입니다." },
        { status: 400 }
      );
    }

    const now = new Date();
    const created = await createSubscription({
      studentId,
      daysPerWeek,
      schedule,
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
