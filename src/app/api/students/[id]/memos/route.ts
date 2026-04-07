import { NextRequest, NextResponse } from "next/server";
import { getMemosByStudentId, createMemo } from "@/lib/mock-data";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const memos = getMemosByStudentId(id);
  return NextResponse.json(memos);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { category, content } = body;

    if (!category || !content) {
      return NextResponse.json(
        { error: "카테고리와 내용은 필수입니다." },
        { status: 400 }
      );
    }

    const memo = createMemo({
      studentId: id,
      category,
      content,
    });

    return NextResponse.json(memo, { status: 201 });
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
}
