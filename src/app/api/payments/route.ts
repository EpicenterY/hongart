import { NextRequest, NextResponse } from "next/server";
import {
  getSubscriptionByStudentId,
  getUnpaidStudents,
  getAllCredits,
  addCredit,
  PaymentStatus,
  PaymentMethod,
} from "@/lib/mock-data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status") as PaymentStatus | null;

  const credits = getAllCredits(statusFilter ?? undefined);
  const unpaidStudents = getUnpaidStudents();

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

    const sub = getSubscriptionByStudentId(studentId);
    const finalAmount = amount ?? sub?.monthlyFee ?? 0;
    const sessionDelta = sub ? sub.daysPerWeek * 4 : 0;

    const entry = addCredit({
      studentId,
      date: new Date(),
      sessionDelta,
      amount: finalAmount,
      method: method as PaymentMethod,
      paymentStatus: PaymentStatus.PAID,
      note: note || null,
    });

    return NextResponse.json(entry, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청입니다" },
      { status: 400 }
    );
  }
}
