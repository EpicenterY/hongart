import { NextRequest, NextResponse } from "next/server";
import {
  getStudents,
  getActiveSubscriptions,
  getScheduleOverridesByDate,
  getBatchDateStatus,
} from "@/lib/db";
import { StudentStatus } from "@/lib/types";
import { ensureHolidaysLoaded } from "@/lib/holidays";
import { prisma } from "@/lib/prisma";

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// Batch attendance for a week — single API call instead of 5 separate calls
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  if (!startDate) {
    return NextResponse.json({ error: "startDate required" }, { status: 400 });
  }

  // Build date list (Mon–Sat = 6 days)
  const dates: string[] = [];
  const base = new Date(startDate + "T00:00:00Z");
  for (let i = 0; i < 6; i++) {
    const d = new Date(base.getTime() + i * 86400000);
    dates.push(d.toISOString().split("T")[0]);
  }

  await ensureHolidaysLoaded();

  // Check date statuses in batch (3 queries for all dates)
  const dayStatuses = await getBatchDateStatus(dates);

  const normalDates = dates.filter(d => dayStatuses.get(d)?.status === "normal");

  // Shared queries (run once, not 5 times)
  const [activeStudents, subsMap] = await Promise.all([
    getStudents({ status: StudentStatus.ACTIVE }),
    getActiveSubscriptions(),
  ]);

  // Attendance for ALL dates (holidays may have records), overrides only for normal days
  const [overridesArr, attendanceRows] = await Promise.all([
    Promise.all(normalDates.map(d => getScheduleOverridesByDate(d))),
    prisma.attendance.findMany({
      where: {
        date: {
          gte: new Date(dates[0] + "T00:00:00Z"),
          lt: new Date(new Date(dates[dates.length - 1] + "T00:00:00Z").getTime() + 86400000),
        },
      },
      include: { student: { select: { name: true } } },
      orderBy: { date: "asc" },
    }),
  ]);

  // Group attendance by date
  const attendanceByDate = new Map<string, typeof attendanceRows>();
  for (const row of attendanceRows) {
    const dateStr = row.date.toISOString().split("T")[0];
    if (!attendanceByDate.has(dateStr)) attendanceByDate.set(dateStr, []);
    attendanceByDate.get(dateStr)!.push(row);
  }

  const studentMap = new Map(activeStudents.map(s => [s.id, s]));
  const result: Record<string, { status: string; holiday?: string; entries: unknown[] }> = {};

  // Non-normal days: only attendance-based entries (no schedule)
  for (const dateStr of dates) {
    const ds = dayStatuses.get(dateStr)!;
    if (ds.status === "normal") continue;

    const records = (attendanceByDate.get(dateStr) ?? []).map(r => ({
      studentId: r.studentId,
      studentName: r.student.name,
      scheduleTime: r.timeSlot,
      attendance: { id: r.id, status: r.status, note: r.note },
    }));

    result[dateStr] = {
      status: ds.status,
      ...(("name" in ds) ? { holiday: ds.name } : {}),
      entries: records,
    };
  }

  // Normal days: full schedule + override + attendance logic
  for (let i = 0; i < normalDates.length; i++) {
    const dateStr = normalDates[i];
    const overrides = overridesArr[i];
    const existingRecords = (attendanceByDate.get(dateStr) ?? []).map(r => ({
      id: r.id,
      studentId: r.studentId,
      timeSlot: r.timeSlot,
      status: r.status,
      note: r.note,
      studentName: r.student.name,
    }));

    const targetDate = new Date(dateStr + "T00:00:00Z");
    const dayName = DAY_NAMES[targetDate.getDay()];

    const removedByOverride = new Set(
      overrides.filter(o => o.originalDate === dateStr).map(o => o.studentId)
    );
    const addedByOverride = new Map(
      overrides
        .filter(o => o.newDate === dateStr)
        .map(o => [o.studentId, o.newTime] as const)
    );

    type Pair = { studentId: string; studentName: string; timeSlot: string };
    const pairs: Pair[] = [];
    const pairKeys = new Set<string>();

    for (const student of activeStudents) {
      if (removedByOverride.has(student.id)) continue;
      if (addedByOverride.has(student.id)) {
        const time = addedByOverride.get(student.id)!;
        pairs.push({ studentId: student.id, studentName: student.name, timeSlot: time });
        pairKeys.add(`${student.id}_${time}`);
        continue;
      }
      const sub = subsMap.get(student.id);
      if (!sub) continue;
      if (sub.startDate > targetDate) continue;
      const daySlots = sub.schedule.filter(s => s.day === dayName);
      for (const slot of daySlots) {
        pairs.push({ studentId: student.id, studentName: student.name, timeSlot: slot.time });
        pairKeys.add(`${student.id}_${slot.time}`);
      }
    }

    // Extra: attendance records not in schedule
    for (const r of existingRecords) {
      const key = `${r.studentId}_${r.timeSlot}`;
      if (!pairKeys.has(key)) {
        const student = studentMap.get(r.studentId);
        if (student) {
          pairs.push({ studentId: student.id, studentName: student.name, timeSlot: r.timeSlot });
          pairKeys.add(key);
        }
      }
    }

    const entries = pairs.map(({ studentId, studentName, timeSlot }) => {
      const record = existingRecords.find(
        r => r.studentId === studentId && r.timeSlot === timeSlot
      );
      return {
        studentId,
        studentName,
        scheduleTime: timeSlot,
        attendance: record
          ? { id: record.id, status: record.status, note: record.note }
          : null,
      };
    });

    result[dateStr] = { status: "normal", entries };
  }

  return NextResponse.json(result);
}
