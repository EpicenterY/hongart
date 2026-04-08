import { NextResponse } from "next/server";
import { getUnpaidCount } from "@/lib/db";

export async function GET() {
  return NextResponse.json({ count: await getUnpaidCount() });
}
