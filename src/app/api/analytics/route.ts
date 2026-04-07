import { NextRequest, NextResponse } from "next/server";
import { getAnalyticsData } from "@/lib/mock-data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const periodParam = searchParams.get("period") || "3m";
  const periodMonths = periodParam === "1m" ? 1 : periodParam === "6m" ? 6 : 3;

  const data = getAnalyticsData(periodMonths);
  return NextResponse.json(data);
}
