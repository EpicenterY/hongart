import { NextRequest, NextResponse } from "next/server";
import { getVacationPeriods, createVacationPeriod } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json(getVacationPeriods());
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, startDate, endDate } = body as {
      name: string;
      startDate: string;
      endDate: string;
    };

    if (!name || !startDate || !endDate) {
      return NextResponse.json(
        { error: "name, startDate, endDate는 필수입니다." },
        { status: 400 },
      );
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { error: "시작일이 종료일보다 늦을 수 없습니다." },
        { status: 400 },
      );
    }

    const created = createVacationPeriod({ name, startDate, endDate });
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
}
