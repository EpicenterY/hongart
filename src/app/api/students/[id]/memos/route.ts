import { NextRequest, NextResponse } from "next/server";
import { getMemosByStudentId, createMemo, updateMemo, deleteMemo } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const memos = await getMemosByStudentId(id);
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

    const memo = await createMemo({
      studentId: id,
      category,
      content,
    });

    return NextResponse.json(memo, { status: 201 });
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;

  try {
    const body = await request.json();
    const { memoId, category, content } = body;

    if (!memoId || (!category && !content)) {
      return NextResponse.json(
        { error: "memoId와 수정할 내용은 필수입니다." },
        { status: 400 }
      );
    }

    const memo = await updateMemo(memoId, {
      ...(category && { category }),
      ...(content && { content }),
    });

    return NextResponse.json(memo);
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;

  const { searchParams } = new URL(request.url);
  const memoId = searchParams.get("memoId");

  if (!memoId) {
    return NextResponse.json({ error: "memoId는 필수입니다." }, { status: 400 });
  }

  const ok = await deleteMemo(memoId);
  if (!ok) {
    return NextResponse.json({ error: "삭제 실패" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
