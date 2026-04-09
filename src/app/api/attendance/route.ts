import { NextRequest, NextResponse } from "next/server";
import {
  getStudents,
  getSubscriptionByStudentId,
  getAttendanceByDate,
  createAttendance,
  updateAttendance,
  deleteAttendance,
  getDateStatus,
  getScheduleOverridesByDate,
  getActiveSubscriptions,
  getBatchBalanceInfo,
} from "@/lib/db";
import { StudentStatus, AttendanceStatus, getScheduleTime } from "@/lib/types";
import { ensureHolidaysLoaded } from "@/lib/holidays";

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const minimal = searchParams.get("minimal") === "true";

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

  // Batch: get all active students + subscriptions + attendance in parallel
  const [activeStudents, subsMap, overrides, existingRecords] = await Promise.all([
    getStudents({ status: StudentStatus.ACTIVE }),
    getActiveSubscriptions(),
    getScheduleOverridesByDate(dateStr),
    getAttendanceByDate(dateStr),
  ]);

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
    const sub = subsMap.get(student.id);
    if (!sub) continue;
    if (sub.startDate > targetDate) continue;
    const daySlots = sub.schedule.filter(s => s.day === dayName);
    if (daySlots.length === 0) continue;
    for (const slot of daySlots) {
      scheduledPairs.push({ student, timeSlot: slot.time });
      scheduledPairKeys.add(`${student.id}_${slot.time}`);
    }
  }

  // Extra entries: attendance records not in scheduled pairs
  const studentMap = new Map(activeStudents.map(s => [s.id, s]));
  const extraPairs: ScheduledPair[] = [];
  for (const r of existingRecords) {
    const key = `${r.studentId}_${r.timeSlot}`;
    if (!scheduledPairKeys.has(key)) {
      const student = studentMap.get(r.studentId);
      if (student) {
        extraPairs.push({ student, timeSlot: r.timeSlot });
        scheduledPairKeys.add(key);
      }
    }
  }
  const allPairs = [...scheduledPairs, ...extraPairs];

  // Minimal mode: skip balance info (for weekly view)
  if (minimal) {
    const result = allPairs.map(({ student, timeSlot }) => {
      const record = existingRecords.find(
        (r) => r.studentId === student.id && r.timeSlot === timeSlot
      );
      return {
        studentId: student.id,
        studentName: student.name,
        scheduleTime: timeSlot,
        attendance: record
          ? { id: record.id, status: record.status, note: record.note }
          : null,
        totalSessions: null,
        usedSessions: null,
        remainingClasses: null,
        paymentState: "OK",
      };
    });
    return NextResponse.json({ status: "normal", entries: result });
  }

  // Batch: get balance info for all students at once (single DB round-trip)
  const studentIds = [...new Set(allPairs.map(p => p.student.id))];
  const balanceMap = await getBatchBalanceInfo(studentIds);

  const result = allPairs.map(({ student, timeSlot }) => {
    const record = existingRecords.find(
      (r) => r.studentId === student.id && r.timeSlot === timeSlot
    );
    const balanceInfo = balanceMap.get(student.id);

    return {
      studentId: student.id,
      studentName: student.name,
      scheduleTime: timeSlot,
      attendance: record
        ? { id: record.id, status: record.status, note: record.note }
        : null,
      totalSessions: balanceInfo?.currentSessionTotal ?? null,
      usedSessions: balanceInfo?.currentSessionUsed ?? null,
      remainingClasses: balanceInfo?.paymentState === "OK"
        ? balanceInfo.currentSessionRemaining : null,
      paymentState: balanceInfo?.paymentState ?? "NO_SUBSCRIPTION",
    };
  });

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
        checkInAt: status === AttendanceStatus.PRESENT || status === AttendanceStatus.LATE || status === AttendanceStatus.MAKEUP
          ? new Date()
          : null,
      });
    } else {
      result = await createAttendance({
        studentId,
        date: new Date(date + "T00:00:00Z"),
        timeSlot,
        status,
        checkInAt: status === AttendanceStatus.PRESENT || status === AttendanceStatus.LATE || status === AttendanceStatus.MAKEUP
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

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id는 필수입니다." }, { status: 400 });
  }
  const ok = await deleteAttendance(id);
  if (!ok) {
    return NextResponse.json({ error: "삭제 실패" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
