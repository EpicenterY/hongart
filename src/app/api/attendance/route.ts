import { NextRequest, NextResponse } from "next/server";
import {
  getStudents,
  getSubscriptionByStudentId,
  getDebitsByDate,
  addDebit,
  updateLedgerEntry,
  getBalanceInfo,
  getDateStatus,
  StudentStatus,
  AttendanceStatus,
} from "@/lib/mock-data";
import { ensureHolidaysLoaded } from "@/lib/holidays";

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];

  await ensureHolidaysLoaded();

  const dateStatus = getDateStatus(dateStr);

  if (dateStatus.status === "holiday") {
    return NextResponse.json({ status: "holiday", holiday: dateStatus.name, entries: [] });
  }
  if (dateStatus.status === "vacation") {
    return NextResponse.json({ status: "vacation", vacation: dateStatus.name, entries: [] });
  }
  if (dateStatus.status === "disabled_day") {
    return NextResponse.json({ status: "disabled_day", entries: [] });
  }

  const targetDate = new Date(dateStr + "T00:00:00+09:00");
  const dayOfWeek = targetDate.getDay();
  const dayName = DAY_NAMES[dayOfWeek];

  const activeStudents = getStudents({ status: StudentStatus.ACTIVE });
  const scheduledStudents = activeStudents.filter((student) => {
    const sub = getSubscriptionByStudentId(student.id);
    if (!sub || !sub.scheduleDays.includes(dayName)) return false;
    if (sub.startDate > targetDate) return false;
    return true;
  });

  const existingDebits = getDebitsByDate(dateStr);

  const result = scheduledStudents.map((student) => {
    const record = existingDebits.find((r) => r.studentId === student.id);
    const sub = getSubscriptionByStudentId(student.id);
    const balanceInfo = getBalanceInfo(student.id);

    return {
      studentId: student.id,
      studentName: student.name,
      scheduleTime: sub?.scheduleTime || null,
      attendance: record
        ? { id: record.id, status: record.attendanceStatus, note: record.note }
        : null,
      totalSessions: balanceInfo.totalPerCycle,
      usedSessions: balanceInfo.currentCycleUsed,
      remainingClasses: balanceInfo.paymentState === "OK" || balanceInfo.paymentState === "PENDING_CREDIT"
        ? balanceInfo.currentCycleRemaining : null,
      paymentState: balanceInfo.paymentState,
    };
  });

  return NextResponse.json({ status: "normal", entries: result });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, date, status } = body;

    if (!studentId || !date || !status) {
      return NextResponse.json(
        { error: "studentId, date, status는 필수입니다." },
        { status: 400 }
      );
    }

    if (!Object.values(AttendanceStatus).includes(status)) {
      return NextResponse.json(
        { error: "유효하지 않은 출석 상태입니다." },
        { status: 400 }
      );
    }

    const existingDebits = getDebitsByDate(date);
    const existing = existingDebits.find((r) => r.studentId === studentId);

    let result;
    let statusCode = 200;

    if (existing) {
      result = updateLedgerEntry(existing.id, {
        attendanceStatus: status,
        checkInAt: status === AttendanceStatus.PRESENT || status === AttendanceStatus.LATE
          ? new Date()
          : null,
      });
    } else {
      result = addDebit({
        studentId,
        date: new Date(date + "T00:00:00+09:00"),
        attendanceStatus: status,
        checkInAt: status === AttendanceStatus.PRESENT || status === AttendanceStatus.LATE
          ? new Date()
          : null,
        note: null,
      });
      statusCode = 201;
    }

    return NextResponse.json(result, { status: statusCode });
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
}
