import { NextResponse } from "next/server";
import { getWeeklySchedule } from "@/lib/db";

export async function GET() {
  const schedule = await getWeeklySchedule();
  return NextResponse.json(schedule);
}
