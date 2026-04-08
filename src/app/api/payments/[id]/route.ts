import { NextRequest, NextResponse } from "next/server";
import { updatePaymentSession } from "@/lib/db";
import { PaymentMethod } from "@/lib/types";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { method, amount, note } = body as {
      method?: PaymentMethod;
      amount?: number;
      note?: string;
    };

    const updates: Partial<{ method: PaymentMethod; amount: number; note: string | null }> = {};
    if (method !== undefined) updates.method = method;
    if (amount !== undefined) updates.amount = amount;
    if (note !== undefined) updates.note = note;

    const session = await updatePaymentSession(id, updates);

    if (!session) {
      return NextResponse.json(
        { error: "결제 정보를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    return NextResponse.json(session);
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청입니다" },
      { status: 400 }
    );
  }
}
