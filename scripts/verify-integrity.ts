import { PrismaClient } from "@prisma/client";
import { CARRY_OVER_RAW, PAYMENT_ROUNDS_RAW, ATTENDANCE_RAW, STUDENT_META_RAW } from "../src/lib/sheets-data";

const prisma = new PrismaClient();

// Compute expected remaining from seed source data (sheets-data.ts)
const coMap = new Map<string, number>();
for (const [id, val] of CARRY_OVER_RAW) coMap.set(id, val);

const roundsCap = new Map<string, number[]>();
for (const [id, , cap] of PAYMENT_ROUNDS_RAW) {
  if (!roundsCap.has(id)) roundsCap.set(id, []);
  roundsCap.get(id)!.push(cap);
}

const attCnt = new Map<string, number>();
for (const [id] of ATTENDANCE_RAW) attCnt.set(id, (attCnt.get(id) ?? 0) + 1);

// Calculate what seed.ts would produce
const seedExpected = new Map<string, { cap: number; att: number; rem: number }>();
for (const [sid] of STUDENT_META_RAW) {
  const co = coMap.get(sid) ?? 0;
  const caps = roundsCap.get(sid) ?? [];
  let totalCap = co > 0 ? co : 0;
  const debt = co < 0 ? Math.abs(co) : 0;
  caps.forEach((c, i) => { totalCap += i === 0 && debt > 0 ? c - debt : c; });
  const att = attCnt.get(sid) ?? 0;
  seedExpected.set(sid, { cap: totalCap, att, rem: totalCap - att });
}

// Compound key for unique student matching (handles duplicate names)
function ckey(name: string, pp: string | null, cp: string | null, status: string): string {
  return `${name}|${pp ?? ""}|${cp ?? ""}|${status}`;
}

async function main() {
  console.log("=== 데이터 정합성 검증 (시드 원본 기준) ===\n");

  const [students, sessions, attGroups] = await Promise.all([
    prisma.student.findMany(),
    prisma.paymentSession.findMany({ select: { studentId: true, capacity: true } }),
    prisma.attendance.groupBy({
      by: ["studentId"],
      where: { status: { in: ["PRESENT", "LATE", "MAKEUP"] } },
      _count: true,
    }),
  ]);

  const dbCapMap = new Map<string, number>();
  for (const s of sessions) dbCapMap.set(s.studentId, (dbCapMap.get(s.studentId) ?? 0) + s.capacity);
  const dbAttMap = new Map<string, number>();
  for (const a of attGroups) dbAttMap.set(a.studentId, a._count);

  // Build DB lookup by compound key: name + parentPhone + phone + status
  const dbByKey = new Map<string, string>();
  for (const s of students) {
    dbByKey.set(ckey(s.name, s.parentPhone, s.phone, s.status), s.id);
  }

  let mismatch = 0;
  const mismatches: string[] = [];

  for (const [sid, , name, isActive, , pp, cp] of STUDENT_META_RAW) {
    const seed = seedExpected.get(sid)!;
    const status = isActive ? "ACTIVE" : "WITHDRAWN";
    const dbId = dbByKey.get(ckey(name, pp || null, cp || null, status));
    if (!dbId) { mismatches.push(`${name} (${sid}): DB에 없음`); mismatch++; continue; }
    const dc = dbCapMap.get(dbId) ?? 0;
    const da = dbAttMap.get(dbId) ?? 0;
    const dr = dc - da;
    if (seed.rem !== dr) {
      mismatch++;
      mismatches.push(`${name} (${sid}): 시드(${seed.cap}-${seed.att}=${seed.rem}) vs DB(${dc}-${da}=${dr}) → diff=${dr - seed.rem}`);
    }
  }

  if (mismatches.length > 0) {
    console.log("❌ 불일치 목록:");
    mismatches.forEach((m) => console.log("  " + m));
  }

  const activeCount = students.filter(s => s.status === "ACTIVE").length;
  const inactiveCount = students.filter(s => s.status !== "ACTIVE").length;
  console.log(`\n총 ${STUDENT_META_RAW.length}명 (활성: ${activeCount}, 비활성: ${inactiveCount}), 불일치: ${mismatch}명`);
  if (mismatch === 0) console.log("✅ 전원 시드 데이터와 DB 완전 일치!");

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect(); });
