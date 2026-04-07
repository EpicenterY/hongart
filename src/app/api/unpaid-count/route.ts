import { NextResponse } from "next/server";
import { getTotalUnpaidCount } from "@/lib/mock-data";

export async function GET() {
  return NextResponse.json({ count: getTotalUnpaidCount() });
}
