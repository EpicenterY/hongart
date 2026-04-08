import { NextRequest, NextResponse } from "next/server";
import {
  getStudents,
  getSubscriptionByStudentId,
  getAttendanceByDate,
  createAttendance,
  updateAttendance,
  getBalanceInfo,
  getDateStatus,
  getScheduleOverridesByDate,
} from "@/lib/db";
import { StudentStatus, AttendanceStatus, getScheduleTime } from "@/lib/types";
import { ensureHolidaysLoaded } from "@/lib/holidays";

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];

  await ensureHolidaysLoaded();

  const dateStatus = await getDateStatus(dateStr);

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

  const activeStudents = await getStudents({ status: StudentStatus.ACTIVE });

  const overrides = await getScheduleOverridesByDate(dateStr);
  const removedByOverride = new Set(
    overrides.filter(o => o.originalDate === dateStr).map(o => o.studentId)
  );
  const addedByOverride = new Map(
    overrides
      .filter(o => o.newDate === dateStr)
      .map(o => [o.studentId, o.newTime] as const)
  );

  const scheduledStudents = [];
  for (const student of activeStudents) {
    if (removedByOverride.has(student.id)) continue;
    if (addedByOverride.has(student.id)) {
      scheduledStudents.push(student);
      continue;
    }
    const sub = await getSubscriptionByStudentId(student.id);
    if (!sub) continue;
    const hasDay = sub.schedule.some(s => s.day === dayName);
    if (!hasDay) continue;
    if (sub.startDate > targetDate) continue;
    scheduledStudents.push(student);
  }

  const existingRecords = await getAttendanceByDate(dateStr);

  const scheduledIds = new Set(scheduledStudents.map(s => s.id));
  const allStudentsArr = await getStudents({});
  const extraStudents = existingRecords
    .filter(r => !scheduledIds.has(r.studentId))
    .map(r => allStudentsArr.find(s => s.id === r.studentId))
    .filter((s): s is NonNullable<typeof s> => !!s);
  const allStudents = [...scheduledStudents, ...extraStudents];

  const result = await Promise.all(
    allStudents.map(async (student) => {
      const record = existingRecords.find((r) => r.studentId === student.id);
      const sub = await getSubscriptionByStudentId(student.id);
      const balanceInfo = await getBalanceInfo(student.id);

      const overrideTime = addedByOverride.get(student.id);
      let schedTime: string | null = overrideTime || (sub ? getScheduleTime(sub.schedule, dayName) : null);

      if (!schedTime && record && sub && sub.schedule.length > 0) {
        const timeCounts: Record<string, number> = {};
        for (const slot of sub.schedule) {
          timeCounts[slot.time] = (timeCounts[slot.time] || 0) + 1;
        }
        schedTime = Object.entries(timeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      }
      if (!schedTime && record?.checkInAt) {
        const kst = new Date(record.checkInAt.getTime() + 9 * 60 * 60 * 1000);
        schedTime = `${kst.getUTCHours()}:00`;
      }

      return {
        studentId: student.id,
        studentName: student.name,
        scheduleTime: schedTime,
        attendance: record
          ? { id: record.id, status: record.status, note: record.note }
          : null,
        totalSessions: balanceInfo.currentSessionTotal,
        usedSessions: balanceInfo.currentSessionUsed,
        remainingClasses: balanceInfo.paymentState === "OK"
          ? balanceInfo.currentSessionRemaining : null,
        paymentState: balanceInfo.paymentState,
      };
    })
  );

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

    const existingRecords = await getAttendanceByDate(date);
    const existing = existingRecords.find((r) => r.studentId === studentId);

    let result;
    let statusCode = 200;

    if (existing) {
      result = await updateAttendance(existing.id, {
        status,
        checkInAt: status === AttendanceStatus.PRESENT || status === AttendanceStatus.LATE
          ? new Date()
          : null,
      });
    } else {
      result = await createAttendance({
        studentId,
        date: new Date(date + "T00:00:00+09:00"),
        status,
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
