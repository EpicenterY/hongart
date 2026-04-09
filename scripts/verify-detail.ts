/**
 * s25(전수호), s37(임지안) 상세 분석
 */
import { PrismaClient } from "@prisma/client";
import { CARRY_OVER_RAW, PAYMENT_ROUNDS_RAW, ATTENDANCE_RAW } from "../src/lib/sheets-data";

const prisma = new PrismaClient();

const MONTH_DATES = [
  "2025-04","2025-05","2025-06","2025-07","2025-08","2025-09",
  "2025-10","2025-11","2025-12","2026-01","2026-02","2026-03","2026-04",
];
const feeMap: Record<number, number> = { 1: 100000, 2: 140000, 3: 170000 };

function analyzeStudent(sid: string, name: string, sheetsRemaining: number) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`${sid} ${name} (시트 잔여: ${sheetsRemaining})`);
  console.log(`${"=".repeat(60)}`);

  // Carry over
  const carryOver = new Map(CARRY_OVER_RAW).get(sid) ?? 0;
  console.log(`\n이월: ${carryOver}`);

  // Payment rounds
  const rounds: [number, number][] = [];
  for (const [s, mi, cap] of PAYMENT_ROUNDS_RAW) {
    if (s === sid) rounds.push([mi, cap]);
  }
  const debt = carryOver < 0 ? Math.abs(carryOver) : 0;

  console.log(`\n결제 라운드 (${rounds.length}개):`);
  let totalCap = carryOver > 0 ? carryOver : 0;
  if (carryOver > 0) console.log(`  이월 세션: capacity=${carryOver}`);

  for (let ri = 0; ri < rounds.length; ri++) {
    const [mi, cap] = rounds[ri];
    const adjusted = ri === 0 && debt > 0 ? cap - debt : cap;
    totalCap += adjusted;
    const month = MONTH_DATES[mi];
    console.log(`  ${month}: cap=${cap}${ri === 0 && debt > 0 ? ` → adjusted=${adjusted} (미결제 ${debt}회 차감)` : ""}`);
  }
  console.log(`  총 capacity: ${totalCap}`);

  // Attendance
  const attDates: string[] = [];
  for (const [s, date] of ATTENDANCE_RAW) {
    if (s === sid) attDates.push(date);
  }
  // unique
  const uniqueDates = new Set(attDates);
  console.log(`\n출석: ${attDates.length}건 (중복제거: ${uniqueDates.size}건)`);

  // By month
  const byMonth = new Map<string, number>();
  for (const d of uniqueDates) {
    const m = d.slice(0, 7);
    byMonth.set(m, (byMonth.get(m) ?? 0) + 1);
  }
  console.log(`  월별:`);
  for (const [m, c] of [...byMonth].sort()) {
    console.log(`    ${m}: ${c}건`);
  }

  console.log(`\n계산 잔여: ${totalCap} - ${uniqueDates.size} = ${totalCap - uniqueDates.size}`);
  console.log(`시트 잔여: ${sheetsRemaining}`);
  console.log(`차이: ${(totalCap - uniqueDates.size) - sheetsRemaining}`);
}

async function main() {
  analyzeStudent("s25", "전수호", 3);
  analyzeStudent("s37", "임지안", -1);

  // Also check the 4 weekend students briefly
  for (const [sid, name, sheetsRem] of [
    ["s05", "나윤서", 4],
    ["s06", "김리하", -6],
    ["s09", "김지유", 2],
    ["s12", "문하윤", 4],
  ] as [string, string, number][]) {
    const rawCount = ATTENDANCE_RAW.filter(a => a[0] === sid).length;
    const uniqueCount = new Set(ATTENDANCE_RAW.filter(a => a[0] === sid).map(a => a[1])).size;

    // After weekend conversion + dedup
    const weekendToWeekday: Record<string, number> = { s05: 2, s06: 1, s09: 3, s12: 1 };
    const converted = new Set<string>();
    for (const [s, date] of ATTENDANCE_RAW) {
      if (s !== sid) continue;
      let d = date;
      if (sid in weekendToWeekday) {
        const dt = new Date(date + "T00:00:00");
        const dow = dt.getDay();
        if (dow === 0 || dow === 6) {
          const targetDow = weekendToWeekday[sid];
          const offset = dow === 0 ? targetDow : targetDow - 6;
          dt.setDate(dt.getDate() + offset);
          d = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
        }
      }
      converted.add(d);
    }

    console.log(`\n${sid} ${name}: 원본=${rawCount}건, 유니크=${uniqueCount}건, 변환후=${converted.size}건, 손실=${rawCount - converted.size}건`);
    console.log(`  → 시트에서는 주말 출석을 각각 1회로 카운트 (2시간 연속수업 = 실제 1회 출석)`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
