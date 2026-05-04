import { NextResponse } from "next/server";
import { exportAllData, importAllData } from "@/lib/db";

export async function GET() {
  try {
    const data = await exportAllData();
    const today = new Date().toISOString().slice(0, 10);
    const json = JSON.stringify(data, null, 2);

    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="hongart-backup-${today}.json"`,
      },
    });
  } catch (err) {
    console.error("Backup export failed:", err);
    return NextResponse.json({ error: "백업 내보내기에 실패했습니다." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.version || !body.data) {
      return NextResponse.json({ error: "올바른 백업 파일이 아닙니다." }, { status: 400 });
    }

    const counts = await importAllData(body);
    return NextResponse.json({ success: true, counts });
  } catch (err) {
    console.error("Backup import failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "복원에 실패했습니다." },
      { status: 500 },
    );
  }
}
