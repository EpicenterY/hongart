import { NextRequest, NextResponse } from "next/server";
import {
  updateLedgerEntry,
  PaymentStatus,
  PaymentMethod,
} from "@/lib/mock-data";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, method, amount, note } = body as {
      status?: PaymentStatus;
      method?: PaymentMethod;
      amount?: number;
      note?: string;
    };

    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.paymentStatus = status;
    if (method !== undefined) updates.method = method;
    if (amount !== undefined) updates.amount = amount;
    if (note !== undefined) updates.note = note;

    const entry = updateLedgerEntry(id, updates);

    if (!entry) {
      return NextResponse.json(
        { error: "결제 정보를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    return NextResponse.json(entry);
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청입니다" },
      { status: 400 }
    );
  }
}
