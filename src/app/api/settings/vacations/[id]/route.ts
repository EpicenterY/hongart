import { NextRequest, NextResponse } from "next/server";
import { updateVacationPeriod, deleteVacationPeriod } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, startDate, endDate } = body as {
      name?: string;
      startDate?: string;
      endDate?: string;
    };

    if (startDate && endDate && startDate > endDate) {
      return NextResponse.json(
        { error: "시작일이 종료일보다 늦을 수 없습니다." },
        { status: 400 },
      );
    }

    const updated = await updateVacationPeriod(id, { name, startDate, endDate });
    if (!updated) {
      return NextResponse.json(
        { error: "해당 방학 기간을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const deleted = await deleteVacationPeriod(id);
  if (!deleted) {
    return NextResponse.json(
      { error: "해당 방학 기간을 찾을 수 없습니다." },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true });
}
