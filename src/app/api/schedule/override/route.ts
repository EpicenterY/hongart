import { NextRequest, NextResponse } from "next/server";
import {
  createScheduleOverride,
  deleteScheduleOverride,
  getScheduleOverrides,
  getScheduleOverridesByDate,
  getAttendanceByDate,
} from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const studentId = searchParams.get("studentId") || undefined;

  if (date) {
    const overrides = await getScheduleOverridesByDate(date);
    return NextResponse.json(studentId ? overrides.filter(o => o.studentId === studentId) : overrides);
  }

  const overrides = await getScheduleOverrides(studentId);
  return NextResponse.json(overrides);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, originalDate, newDate, newTime } = body;

    if (!studentId || !originalDate || !newDate || !newTime) {
      return NextResponse.json(
        { error: "studentId, originalDate, newDate, newTime은 필수입니다." },
        { status: 400 }
      );
    }

    // Check if there's an attendance record for this student on the original date
    const existingAttendance = await getAttendanceByDate(originalDate);
    const hasAttendance = existingAttendance.some(r => r.studentId === studentId);
    if (hasAttendance) {
      return NextResponse.json(
        { error: "출석 기록이 있는 날짜는 변경할 수 없습니다." },
        { status: 409 }
      );
    }

    // Upsert: delete any existing override for the same student+originalDate
    const existingOverrides = await getScheduleOverrides(studentId);
    for (const existing of existingOverrides) {
      if (existing.originalDate === originalDate) {
        await deleteScheduleOverride(existing.id);
      }
    }

    const override = await createScheduleOverride({
      studentId,
      originalDate,
      newDate,
      newTime,
    });

    return NextResponse.json(override, { status: 201 });
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id는 필수입니다." }, { status: 400 });
  }

  const success = await deleteScheduleOverride(id);
  if (!success) {
    return NextResponse.json({ error: "오버라이드를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
