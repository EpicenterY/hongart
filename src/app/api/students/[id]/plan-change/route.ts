import { NextRequest, NextResponse } from "next/server";
import {
  cancelPlanChange,
  getPendingPlanChangeByStudentId,
  deletePendingPlanChange,
} from "@/lib/db";

// DELETE: Cancel plan change (revert subscription + unfreeze)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: studentId } = await params;

  const success = await cancelPlanChange(studentId);
  if (!success) {
    return NextResponse.json(
      { error: "대기 중인 플랜 변경이 없습니다." },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}

// POST: Confirm credit/refund (just delete pending, keep new plan)
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: studentId } = await params;

  const pending = await getPendingPlanChangeByStudentId(studentId);
  if (!pending) {
    return NextResponse.json(
      { error: "대기 중인 플랜 변경이 없습니다." },
      { status: 404 }
    );
  }

  await deletePendingPlanChange(pending.id);
  return NextResponse.json({ success: true });
}
