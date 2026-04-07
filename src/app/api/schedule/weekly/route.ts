import { NextResponse } from "next/server";
import { getWeeklySchedule } from "@/lib/mock-data";

export async function GET() {
  const schedule = getWeeklySchedule();
  return NextResponse.json(schedule);
}
