import { NextRequest, NextResponse } from "next/server";
import {
  getStudentById,
  updateStudent,
  deleteStudent,
  getBalanceInfo,
  getPendingPlanChangeByStudentId,
} from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const student = await getStudentById(id);
  if (!student) {
    return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 });
  }

  const balanceInfo = await getBalanceInfo(id);
  const pendingPlanChange = await getPendingPlanChangeByStudentId(id);
  return NextResponse.json({ ...student, balanceInfo, pendingPlanChange });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const updated = await updateStudent(id, body);

    if (!updated) {
      return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const success = await deleteStudent(id);

  if (!success) {
    return NextResponse.json({ error: "학생을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
