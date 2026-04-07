import { NextRequest, NextResponse } from "next/server";
import { updateLedgerEntry, AttendanceStatus } from "@/lib/mock-data";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { status } = body;

    if (!status || !Object.values(AttendanceStatus).includes(status)) {
      return NextResponse.json(
        { error: "유효하지 않은 출석 상태입니다." },
        { status: 400 }
      );
    }

    const updated = updateLedgerEntry(id, { attendanceStatus: status });

    if (!updated) {
      return NextResponse.json(
        { error: "출석 기록을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
}
