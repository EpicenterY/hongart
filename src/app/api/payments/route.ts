import { NextRequest, NextResponse } from "next/server";
import {
  getStudents,
  getSubscriptionByStudentId,
  getUnpaidStudents,
  getAllPaymentSessions,
  createPaymentSession,
  getPendingPlanChangeByStudentId,
  deletePendingPlanChange,
} from "@/lib/db";
import { PaymentMethod } from "@/lib/types";

export async function GET() {
  const sessions = await getAllPaymentSessions();
  const unpaidStudents = await getUnpaidStudents();
  const allStudents = await getStudents();

  const credits = sessions.map((s) => ({
    id: s.id,
    studentId: s.studentId,
    studentName: allStudents.find((st) => st.id === s.studentId)?.name ?? "",
    amount: s.amount,
    method: s.method,
    capacity: s.capacity,
    frozen: s.frozen,
    daysPerWeek: s.daysPerWeek,
    monthlyFee: s.monthlyFee,
    date: s.createdAt.toISOString(),
    note: s.note,
  }));

  return NextResponse.json({ credits, unpaidStudents });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, amount, method, note } = body as {
      studentId: string;
      amount?: number;
      method: string;
      note?: string;
    };

    const sub = await getSubscriptionByStudentId(studentId);
    const finalAmount = amount ?? sub?.monthlyFee ?? 0;
    const capacity = sub ? sub.daysPerWeek * 4 : 0;

    const session = await createPaymentSession({
      studentId,
      capacity,
      amount: finalAmount,
      method: method as PaymentMethod,
      daysPerWeek: sub?.daysPerWeek ?? 0,
      monthlyFee: sub?.monthlyFee ?? 0,
      note: note || null,
    });

    // Auto-clear pending plan change after payment
    const pending = await getPendingPlanChangeByStudentId(studentId);
    if (pending) await deletePendingPlanChange(pending.id);

    return NextResponse.json(session, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청입니다" },
      { status: 400 }
    );
  }
}
