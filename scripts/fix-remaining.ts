import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Expected remaining from raw Google Sheets data
const EXPECTED: Record<string, number> = {
  "서동준": -6, "이윤서": -1, "정윤영": 1, "최하연": 6, "나윤서": 4,
  "김리하": -6, "하라윤": 2, "임정윤": 6, "김지유": 2, "최혜원": 0,
  "류지아": 5, "문하윤": 4, "최은수": 3, "정예린": -3, "고해서": -7,
  "길민준": 0, "강지윤": -2, "이태율": -2, "조현래": 2, "송서율": -4,
  "이수현": 0, "최은우": 3, "강하준": 0, "김주아": 1, "전수호": 3,
  "이나윤": -1, "정원": 0, "홍채이": 1, "인하엘": 0, "임건우": -1,
  "이하율": 3, "김지안": -1, "현채은": 8, "송서연": -1, "황찬": 1,
  "정다민": -2, "임지안": -1, "이루미": 0, "조혜준": 0, "김민겸": 0,
  "이로이": -4, "박서은": 3, "정하윤": 3, "김건우": 3, "최은호": 3,
  "장승우": 3, "안제하": -1, "정예나": -1, "하예윤": 3, "이혜성": -2,
  "김서진": 0, "유이도": 2, "유이르": 2, "펜더아린": 3,
};

async function main() {
  console.log("=== 잔여 회차 보정 시작 ===\n");

  const students = await prisma.student.findMany();
  let fixed = 0;

  for (const student of students) {
    const expected = EXPECTED[student.name];
    if (expected === undefined) continue;

    // Calculate current remaining
    const sessions = await prisma.paymentSession.findMany({ where: { studentId: student.id } });
    const totalCap = sessions.reduce((sum, s) => sum + s.capacity, 0);
    const usedCount = await prisma.attendance.count({
      where: { studentId: student.id, status: { in: ["PRESENT", "LATE", "MAKEUP"] } },
    });
    const actual = totalCap - usedCount;

    if (actual === expected) continue;

    const diff = expected - actual; // positive = need more capacity, negative = need less
    console.log(`${student.name}: 현재=${actual}, 기대=${expected}, 차이=${diff}`);

    // Find last payment session and adjust capacity
    const lastSession = sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    if (lastSession) {
      const newCap = lastSession.capacity + diff;
      await prisma.paymentSession.update({
        where: { id: lastSession.id },
        data: { capacity: newCap, note: lastSession.note ? `${lastSession.note} (보정 ${diff > 0 ? "+" : ""}${diff})` : `보정 ${diff > 0 ? "+" : ""}${diff}` },
      });
      fixed++;
    }
  }

  console.log(`\n✅ ${fixed}명 보정 완료`);

  // Verify
  console.log("\n=== 보정 후 검증 ===");
  let mismatches = 0;
  for (const student of students) {
    const expected = EXPECTED[student.name];
    if (expected === undefined) continue;
    const sessions = await prisma.paymentSession.findMany({ where: { studentId: student.id } });
    const totalCap = sessions.reduce((sum, s) => sum + s.capacity, 0);
    const usedCount = await prisma.attendance.count({
      where: { studentId: student.id, status: { in: ["PRESENT", "LATE", "MAKEUP"] } },
    });
    const remaining = totalCap - usedCount;
    if (remaining !== expected) {
      console.log(`❌ ${student.name}: ${remaining} != ${expected}`);
      mismatches++;
    }
  }
  console.log(mismatches === 0 ? "✅ 모든 학생 잔여 회차 완전 일치!" : `❌ ${mismatches}명 여전히 불일치`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
