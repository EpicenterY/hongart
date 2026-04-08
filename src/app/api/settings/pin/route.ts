import { NextRequest, NextResponse } from "next/server";
import { getPin, updatePin } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { currentPin: inputPin, newPin } = body as {
      currentPin: string;
      newPin: string;
    };

    const storedPin = await getPin();
    if (inputPin !== storedPin) {
      return NextResponse.json(
        { success: false, error: "현재 PIN이 올바르지 않습니다" },
        { status: 401 }
      );
    }

    if (!newPin || newPin.length < 4) {
      return NextResponse.json(
        { success: false, error: "새 PIN은 4자리 이상이어야 합니다" },
        { status: 400 }
      );
    }

    await updatePin(newPin);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "잘못된 요청입니다" },
      { status: 400 }
    );
  }
}
