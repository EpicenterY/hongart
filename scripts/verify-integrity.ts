import { PrismaClient } from "@prisma/client";
import { CARRY_OVER_RAW, PAYMENT_ROUNDS_RAW, ATTENDANCE_RAW } from "../src/lib/sheets-data";

const prisma = new PrismaClient();

const NAMES: Record<string, string> = {
  s01:"서동준",s02:"이윤서",s03:"정윤영",s04:"최하연",s05:"나윤서",
  s06:"김리하",s07:"하라윤",s08:"임정윤",s09:"김지유",s10:"최혜원",
  s11:"류지아",s12:"문하윤",s13:"최은수",s14:"정예린",s15:"고해서",
  s16:"길민준",s17:"강지윤",s18:"이태율",s19:"조현래",s20:"송서율",
  s21:"이수현",s22:"최은우",s23:"강하준",s24:"김주아",s25:"전수호",
  s26:"이나윤",s27:"정원",s28:"홍채이",s29:"인하엘",s30:"임건우",
  s31:"이하율",s32:"김지안",s33:"현채은",s34:"송서연",s35:"황찬",
  s36:"정다민",s37:"임지안",s38:"이루미",s39:"조혜준",s40:"김민겸",
  s41:"이로이",s42:"박서은",s43:"정하윤",s44:"김건우",s45:"최은호",
  s46:"장승우",s47:"안제하",s48:"정예나",s49:"하예윤",s50:"이혜성",
  s51:"김서진",s52:"유이도",s53:"유이르",s54:"펜더아린",
};

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
for (const sid of Object.keys(NAMES)) {
  const co = coMap.get(sid) ?? 0;
  const caps = roundsCap.get(sid) ?? [];
  let totalCap = co > 0 ? co : 0;
  const debt = co < 0 ? Math.abs(co) : 0;
  caps.forEach((c, i) => { totalCap += i === 0 && debt > 0 ? c - debt : c; });
  const att = attCnt.get(sid) ?? 0;
  seedExpected.set(sid, { cap: totalCap, att, rem: totalCap - att });
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
  const nameToId = new Map(students.map((s) => [s.name, s.id]));

  let mismatch = 0;
  const mismatches: string[] = [];

  for (const [sid, name] of Object.entries(NAMES)) {
    const seed = seedExpected.get(sid)!;
    const dbId = nameToId.get(name);
    if (!dbId) { mismatches.push(`${name}: DB에 없음`); mismatch++; continue; }
    const dc = dbCapMap.get(dbId) ?? 0;
    const da = dbAttMap.get(dbId) ?? 0;
    const dr = dc - da;
    if (seed.rem !== dr) {
      mismatch++;
      mismatches.push(`${name}: 시드(${seed.cap}-${seed.att}=${seed.rem}) vs DB(${dc}-${da}=${dr}) → diff=${dr - seed.rem}`);
    }
  }

  if (mismatches.length > 0) {
    console.log("❌ 불일치 목록:");
    mismatches.forEach((m) => console.log("  " + m));
  }
  console.log(`\n총 ${Object.keys(NAMES).length}명, 불일치: ${mismatch}명`);
  if (mismatch === 0) console.log("✅ 전원 시드 데이터와 DB 완전 일치!");

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect(); });
