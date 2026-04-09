import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // Find active students with remaining makeup slots (absences > makeups)
  const students = await prisma.student.findMany({
    where: {
      status: "ACTIVE",
      attendances: { some: { status: "ABSENT" } },
    },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          attendances: { where: { status: "ABSENT" } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Count makeups per student in one query
  const makeupCounts = await prisma.attendance.groupBy({
    by: ["studentId"],
    where: {
      studentId: { in: students.map((s) => s.id) },
      status: "MAKEUP",
    },
    _count: true,
  });
  const makeupMap = new Map(makeupCounts.map((m) => [m.studentId, m._count]));

  const result = students
    .map((s) => {
      const absences = s._count.attendances;
      const makeups = makeupMap.get(s.id) ?? 0;
      const remaining = absences - makeups;
      return { id: s.id, name: s.name, remaining };
    })
    .filter((s) => s.remaining > 0);

  return NextResponse.json(result);
}
