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

  const targetDate = new Date(dateStr + "T00:00:00Z");
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

  // Build (student, timeSlot) pairs for scheduled entries
  type ScheduledPair = { student: typeof activeStudents[0]; timeSlot: string };
  const scheduledPairs: ScheduledPair[] = [];
  const scheduledPairKeys = new Set<string>();

  for (const student of activeStudents) {
    if (removedByOverride.has(student.id)) continue;
    if (addedByOverride.has(student.id)) {
      const time = addedByOverride.get(student.id)!;
      scheduledPairs.push({ student, timeSlot: time });
      scheduledPairKeys.add(`${student.id}_${time}`);
      continue;
    }
    const sub = await getSubscriptionByStudentId(student.id);
    if (!sub) continue;
    if (sub.startDate > targetDate) continue;
    const daySlots = sub.schedule.filter(s => s.day === dayName);
    if (daySlots.length === 0) continue;
    for (const slot of daySlots) {
      scheduledPairs.push({ student, timeSlot: slot.time });
      scheduledPairKeys.add(`${student.id}_${slot.time}`);
    }
  }

  const existingRecords = await getAttendanceByDate(dateStr);

  // Extra entries: attendance records not in scheduled pairs
  const allStudentsArr = await getStudents({});
  const extraPairs: ScheduledPair[] = [];
  for (const r of existingRecords) {
    const key = `${r.studentId}_${r.timeSlot}`;
    if (!scheduledPairKeys.has(key)) {
      const student = allStudentsArr.find(s => s.id === r.studentId);
      if (student) {
        extraPairs.push({ student, timeSlot: r.timeSlot });
        scheduledPairKeys.add(key);
      }
    }
  }
  const allPairs = [...scheduledPairs, ...extraPairs];

  // Cache balance info per student
  const balanceCache = new Map<string, Awaited<ReturnType<typeof getBalanceInfo>>>();

  const result = await Promise.all(
    allPairs.map(async ({ student, timeSlot }) => {
      const record = existingRecords.find(
        (r) => r.studentId === student.id && r.timeSlot === timeSlot
      );

      if (!balanceCache.has(student.id)) {
        balanceCache.set(student.id, await getBalanceInfo(student.id));
      }
      const balanceInfo = balanceCache.get(student.id)!;

      return {
        studentId: student.id,
        studentName: student.name,
        scheduleTime: timeSlot,
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
    const { studentId, date, status, timeSlot: bodyTimeSlot } = body;

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

    // Resolve timeSlot: use body value, or infer from student schedule
    let timeSlot: string = bodyTimeSlot;
    if (!timeSlot) {
      const targetDate = new Date(date + "T00:00:00Z");
      const dayName = DAY_NAMES[targetDate.getDay()];
      const sub = await getSubscriptionByStudentId(studentId);
      timeSlot = sub ? (getScheduleTime(sub.schedule, dayName) ?? "14:00") : "14:00";
    }

    const existingRecords = await getAttendanceByDate(date);
    const existing = existingRecords.find(
      (r) => r.studentId === studentId && r.timeSlot === timeSlot
    );

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
        date: new Date(date + "T00:00:00Z"),
        timeSlot,
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
