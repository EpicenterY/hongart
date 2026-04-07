import { NextRequest, NextResponse } from "next/server";
import { getHolidays, getLastUpdatedAt, refreshHolidays } from "@/lib/holidays";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year") ? Number(searchParams.get("year")) : undefined;

  const holidays = await getHolidays(year);
  return NextResponse.json({
    holidays,
    lastUpdatedAt: getLastUpdatedAt(),
  });
}

export async function POST() {
  const data = await refreshHolidays();
  if (!data) {
    return NextResponse.json(
      { error: "공휴일 데이터를 가져올 수 없습니다. API 키를 확인해주세요." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    holidays: data,
    lastUpdatedAt: getLastUpdatedAt(),
  });
}
