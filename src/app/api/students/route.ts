import { NextRequest, NextResponse } from "next/server";
import {
  getStudents,
  createStudent,
  createSubscription,
  getSubscriptionByStudentId,
  getBalanceInfo,
  StudentStatus,
  type StudentFilter,
} from "@/lib/mock-data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || undefined;
  const status = searchParams.get("status") as StudentStatus | undefined;

  const filter: StudentFilter = {};
  if (search) filter.search = search;
  if (status && Object.values(StudentStatus).includes(status)) {
    filter.status = status;
  }

  const students = getStudents(filter);

  const studentsWithInfo = students.map((student) => {
    const subscription = getSubscriptionByStudentId(student.id);
    const balanceInfo = getBalanceInfo(student.id);

    return {
      ...student,
      subscription: subscription
        ? {
            daysPerWeek: subscription.daysPerWeek,
            scheduleDays: subscription.scheduleDays,
            monthlyFee: subscription.monthlyFee,
          }
        : null,
      remainingClasses: balanceInfo.paymentState === "OK" || balanceInfo.paymentState === "PENDING_CREDIT"
        ? balanceInfo.currentCycleRemaining : null,
      paymentState: balanceInfo.paymentState,
    };
  });

  return NextResponse.json(studentsWithInfo);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, parentPhone, school, grade, note, subscription } = body;

    if (!name) {
      return NextResponse.json({ error: "이름은 필수입니다." }, { status: 400 });
    }

    const student = createStudent({
      name,
      phone: phone || null,
      parentPhone: parentPhone || null,
      school: school || null,
      grade: grade || null,
      status: StudentStatus.ACTIVE,
      note: note || null,
    });

    if (subscription) {
      const subStartDate = new Date(subscription.startDate + "T00:00:00+09:00");
      createSubscription({
        studentId: student.id,
        daysPerWeek: subscription.daysPerWeek,
        scheduleDays: subscription.scheduleDays,
        scheduleTime: subscription.scheduleTime || "15:00",
        startDate: subStartDate,
        endDate: null,
        monthlyFee: subscription.monthlyFee,
        isActive: true,
      });
    }

    return NextResponse.json(student, { status: 201 });
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
}
