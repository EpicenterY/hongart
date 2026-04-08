import { NextRequest, NextResponse } from "next/server";
import { getPlans, updatePlan } from "@/lib/db";

export async function GET() {
  return NextResponse.json(await getPlans());
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { daysPerWeek, monthlyFee } = body as {
      daysPerWeek: number;
      monthlyFee: number;
    };

    if (!daysPerWeek || monthlyFee == null) {
      return NextResponse.json(
        { error: "daysPerWeek, monthlyFee는 필수입니다." },
        { status: 400 }
      );
    }

    const updated = await updatePlan(daysPerWeek, monthlyFee);
    if (!updated) {
      return NextResponse.json(
        { error: "해당 플랜을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청입니다." },
      { status: 400 }
    );
  }
}
