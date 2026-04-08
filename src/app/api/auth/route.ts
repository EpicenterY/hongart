import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPin } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pin } = body as { pin: string };

    const validPin = await getPin();
    if (pin !== validPin) {
      return NextResponse.json(
        { success: false, error: "PIN이 올바르지 않습니다" },
        { status: 401 }
      );
    }

    const cookieStore = await cookies();
    cookieStore.set("hongart-session", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "잘못된 요청입니다" },
      { status: 400 }
    );
  }
}
