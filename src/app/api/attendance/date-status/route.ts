import { NextRequest, NextResponse } from "next/server";
import { getDateStatus } from "@/lib/db";
import { ensureHolidaysLoaded } from "@/lib/holidays";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date");

  if (!dateStr) {
    return NextResponse.json(
      { error: "date 파라미터는 필수입니다." },
      { status: 400 },
    );
  }

  await ensureHolidaysLoaded();
  return NextResponse.json(await getDateStatus(dateStr));
}
