import { NextRequest, NextResponse } from "next/server";
import { getClassDaySettings, updateClassDaySettings } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json(getClassDaySettings());
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { enabledDays } = body as { enabledDays: string[] };

    if (!enabledDays || !Array.isArray(enabledDays)) {
      return NextResponse.json(
        { error: "enabledDays 배열은 필수입니다." },
        { status: 400 },
      );
    }

    const valid = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
    if (enabledDays.some((d) => !valid.includes(d))) {
      return NextResponse.json(
        { error: "유효하지 않은 요일이 포함되어 있습니다." },
        { status: 400 },
      );
    }

    const updated = updateClassDaySettings(enabledDays);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
}
