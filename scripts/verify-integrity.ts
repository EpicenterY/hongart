/**
 * 데이터 정합성 검증 스크립트
 * Google Sheets 원본 (sheets-data.ts + seed.ts STUDENT_RAW) vs DB 실제 데이터 비교
 *
 * 검증 항목:
 * 1. 학생 수
 * 2. 출석 기록 (날짜별 일치 여부)
 * 3. 결제 세션 (개수 + 총 capacity)
 * 4. 잔여 회차 (computeFilling 결과 vs 스프레드시트 기대값)
 */
import { PrismaClient } from "@prisma/client";
import { CARRY_OVER_RAW, PAYMENT_ROUNDS_RAW, ATTENDANCE_RAW } from "../src/lib/sheets-data";
import { computeFilling, isConsuming, type PaymentSession, type AttendanceRecord, PaymentMethod, AttendanceStatus } from "../src/lib/types";

const prisma = new PrismaClient();

// ── 원본 데이터 (seed.ts와 동일) ──────────────────────────
const STUDENT_RAW: [string, string, number, string, string | null, number][] = [
  ["s01","서동준",1,"01041487832",null,-6],
  ["s02","이윤서",1,"01040861253",null,-1],
  ["s03","정윤영",1,"01055185087",null,1],
  ["s04","최하연",2,"01024725454",null,6],
  ["s05","나윤서",2,"01064797875",null,4],
  ["s06","김리하",2,"01071473362",null,-6],
  ["s07","하라윤",1,"01064329364",null,2],
  ["s08","임정윤",3,"01050960118",null,6],
  ["s09","김지유",2,"01083320164",null,2],
  ["s10","최혜원",2,"01064811004","01064811074",0],
  ["s11","류지아",2,"01095406102",null,5],
  ["s12","문하윤",2,"01056185820",null,4],
  ["s13","최은수",1,"01024725454",null,3],
  ["s14","정예린",2,"01088332076",null,-3],
  ["s15","고해서",2,"01062872975",null,-6],
  ["s16","길민준",1,"01034213263","01056403263",0],
  ["s17","강지윤",2,"01022188009",null,-1],
  ["s18","이태율",2,"01054565852","01022475852",-2],
  ["s19","조현래",1,"01066726082",null,2],
  ["s20","송서율",2,"01077778070",null,-4],
  ["s21","이수현",1,"01079361119",null,0],
  ["s22","최은우",1,"01077631614",null,3],
  ["s23","강하준",1,"01034570144",null,0],
  ["s24","김주아",1,"01052057855",null,1],
  ["s25","전수호",1,"01054727204",null,3],
  ["s26","이나윤",1,"01079404723",null,-1],
  ["s27","정원",1,"01099163871",null,0],
  ["s28","홍채이",1,"01075539224",null,1],
  ["s29","인하엘",1,"01047552994",null,0],
  ["s30","임건우",1,"01048193537",null,-1],
  ["s31","이하율",3,"01092737287",null,3],
  ["s32","김지안",1,"01088398522",null,-1],
  ["s33","현채은",2,"01076555051",null,8],
  ["s34","송서연",1,"01090407504",null,-1],
  ["s35","황찬",2,"01036238363",null,1],
  ["s36","정다민",1,"01098909980",null,-2],
  ["s37","임지안",1,"01073581105",null,-1],
  ["s38","이루미",1,"01047376955",null,0],
  ["s39","조혜준",1,"01072778685",null,0],
  ["s40","김민겸",1,"01020573523",null,0],
  ["s41","이로이",1,"01090987315",null,-4],
  ["s42","박서은",1,"01042099669",null,3],
  ["s43","정하윤",1,"01072023858",null,3],
  ["s44","김건우",1,"01036598924",null,3],
  ["s45","최은호",1,"01020360968",null,3],
  ["s46","장승우",1,"01067104911",null,3],
  ["s47","안제하",1,"01093575426",null,-1],
  ["s48","정예나",1,"01076676249",null,-1],
  ["s49","하예윤",1,"01064329364",null,3],
  ["s50","이혜성",2,"01099842980",null,-2],
  ["s51","김서진",1,"01088929048",null,0],
  ["s52","유이도",2,"01022972680",null,2],
  ["s53","유이르",2,"01022972680",null,2],
  ["s54","펜더아린",1,"01098515008",null,3],
];

const MONTH_DATES = [
  "2025-04","2025-05","2025-06","2025-07","2025-08","2025-09",
  "2025-10","2025-11","2025-12","2026-01","2026-02","2026-03","2026-04",
];
const feeMap: Record<number, number> = { 1: 100000, 2: 140000, 3: 170000 };
const weekendToWeekday: Record<string, number> = { s05: 2, s06: 1, s09: 3, s12: 1 };

// ── 기대값 계산 (seed.ts 로직 재현, DB 없이 순수 계산) ─────

function computeExpected(sid: string) {
  const [, name, dpw, , , sheetsRemaining] = STUDENT_RAW.find(s => s[0] === sid)!;
  const carryOver = new Map(CARRY_OVER_RAW).get(sid) ?? 0;

  // 결제 세션 capacity 계산
  const rounds: [number, number][] = [];
  for (const [s, mi, cap] of PAYMENT_ROUNDS_RAW) {
    if (s === sid) rounds.push([mi, cap]);
  }
  const debt = carryOver < 0 ? Math.abs(carryOver) : 0;

  let totalCapacity = 0;
  const sessionCapacities: number[] = [];

  if (carryOver > 0) {
    totalCapacity += carryOver;
    sessionCapacities.push(carryOver);
  }

  for (let ri = 0; ri < rounds.length; ri++) {
    const [, cap] = rounds[ri];
    const adjustedCap = ri === 0 && debt > 0 ? cap - debt : cap;
    totalCapacity += adjustedCap;
    sessionCapacities.push(adjustedCap);
  }

  // 출석 (중복 제거 후)
  const attendanceDates = new Set<string>();
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
    attendanceDates.add(d);
  }

  const attendanceCount = attendanceDates.size;
  const computedRemaining = totalCapacity - attendanceCount;

  return {
    name, dpw, sheetsRemaining,
    carryOver, rounds: rounds.length, debt,
    totalCapacity, attendanceCount, computedRemaining,
    sessionCapacities,
  };
}

// ── DB 실제값 조회 ─────────────────────────────────────────

async function getActualFromDB(studentId: string) {
  const sessions = await prisma.paymentSession.findMany({
    where: { studentId },
    orderBy: { createdAt: "asc" },
  });
  const attendance = await prisma.attendance.findMany({
    where: { studentId },
    orderBy: { date: "asc" },
  });

  // computeFilling과 동일한 로직
  const psSessions: PaymentSession[] = sessions.map(s => ({
    id: s.id,
    studentId: s.studentId,
    capacity: s.capacity,
    frozen: s.frozen,
    amount: s.amount,
    method: s.method as PaymentMethod,
    daysPerWeek: s.daysPerWeek,
    monthlyFee: s.monthlyFee,
    note: s.note,
    createdAt: s.createdAt,
  }));

  const attRecords: AttendanceRecord[] = attendance.map(a => ({
    id: a.id,
    studentId: a.studentId,
    date: a.date,
    timeSlot: a.timeSlot,
    status: a.status as AttendanceStatus,
    checkInAt: a.checkInAt,
    note: a.note,
    createdAt: a.createdAt,
  }));

  const filling = computeFilling(psSessions, attRecords);

  return {
    sessionCount: sessions.length,
    totalCapacity: filling.totalCapacity,
    attendanceCount: attendance.length,
    consumingCount: filling.totalConsuming,
    remaining: filling.remaining,
    unassignedCount: filling.unassigned.length,
    sessionDetails: sessions.map(s => ({
      capacity: s.capacity,
      frozen: s.frozen,
      note: s.note,
      createdAt: s.createdAt.toISOString().slice(0, 7),
    })),
  };
}

// ── 메인 ───────────────────────────────────────────────────

async function main() {
  const students = await prisma.student.findMany({ orderBy: { createdAt: "asc" } });

  // UUID 매핑
  const idMap = new Map<string, string>();
  const nameMap = new Map<string, string>();
  for (let i = 0; i < students.length; i++) {
    idMap.set(STUDENT_RAW[i][0], students[i].id);
    nameMap.set(STUDENT_RAW[i][0], students[i].name);
  }

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║         홍아트 데이터 정합성 검증 리포트                     ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // 1. 학생 수 비교
  console.log(`[1] 학생 수: 시트=${STUDENT_RAW.length}명, DB=${students.length}명 → ${STUDENT_RAW.length === students.length ? "✅ 일치" : "❌ 불일치"}\n`);

  // 2~4. 학생별 상세 비교
  const issues: string[] = [];
  let matchCount = 0;
  let mismatchCount = 0;

  console.log("[2] 학생별 잔여 회차 비교 (시트 기대값 vs DB computeFilling)\n");
  console.log("이름       │ 시트 │ 계산 │  DB  │ cap  │ 출석 │ 상태");
  console.log("───────────┼──────┼──────┼──────┼──────┼──────┼──────");

  for (const [sid] of STUDENT_RAW) {
    const uuid = idMap.get(sid)!;
    const expected = computeExpected(sid);
    const actual = await getActualFromDB(uuid);

    const nameStr = expected.name.padEnd(6, "　");
    const sheetsStr = String(expected.sheetsRemaining).padStart(4);
    const computedStr = String(expected.computedRemaining).padStart(4);
    const dbStr = String(actual.remaining).padStart(4);
    const capStr = String(actual.totalCapacity).padStart(4);
    const attStr = String(actual.attendanceCount).padStart(4);

    // 불일치 체크
    const problems: string[] = [];

    // 잔여 회차: 로컬 계산 vs DB
    if (expected.computedRemaining !== actual.remaining) {
      problems.push(`잔여불일치(계산=${expected.computedRemaining},DB=${actual.remaining})`);
    }

    // 잔여 회차: 시트 기대값 vs 로컬 계산
    if (expected.sheetsRemaining !== expected.computedRemaining) {
      problems.push(`시트불일치(시트=${expected.sheetsRemaining},계산=${expected.computedRemaining})`);
    }

    // 출석 수: 기대 vs DB
    if (expected.attendanceCount !== actual.attendanceCount) {
      problems.push(`출석불일치(기대=${expected.attendanceCount},DB=${actual.attendanceCount})`);
    }

    // capacity: 기대 vs DB
    if (expected.totalCapacity !== actual.totalCapacity) {
      problems.push(`용량불일치(기대=${expected.totalCapacity},DB=${actual.totalCapacity})`);
    }

    const status = problems.length === 0 ? "✅" : "❌";
    if (problems.length === 0) {
      matchCount++;
    } else {
      mismatchCount++;
    }

    console.log(`${nameStr} │${sheetsStr} │${computedStr} │${dbStr} │${capStr} │${attStr} │ ${status}`);

    if (problems.length > 0) {
      for (const p of problems) {
        issues.push(`  ${sid} ${expected.name}: ${p}`);
      }
    }
  }

  console.log("───────────┴──────┴──────┴──────┴──────┴──────┴──────\n");

  // 3. 출석 날짜 정합성 (샘플 5명)
  console.log("[3] 출석 날짜 스팟 체크 (첫 5명)\n");
  for (let i = 0; i < 5; i++) {
    const [sid, name] = STUDENT_RAW[i];
    const uuid = idMap.get(sid)!;

    const dbAtt = await prisma.attendance.findMany({
      where: { studentId: uuid },
      orderBy: { date: "asc" },
    });
    const dbDates = new Set(dbAtt.map(a => a.date.toISOString().split("T")[0]));

    // Expected dates
    const expectedDates = new Set<string>();
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
      expectedDates.add(d);
    }

    const missing = [...expectedDates].filter(d => !dbDates.has(d));
    const extra = [...dbDates].filter(d => !expectedDates.has(d));

    const firstDb = dbAtt.length > 0 ? dbAtt[0].date.toISOString().split("T")[0] : "없음";
    const firstExpected = [...expectedDates].sort()[0] ?? "없음";

    console.log(`  ${name}: 기대=${expectedDates.size}건, DB=${dbDates.size}건, 첫날(기대=${firstExpected}, DB=${firstDb}) missing=${missing.length} extra=${extra.length} ${missing.length === 0 && extra.length === 0 ? "✅" : "❌"}`);
    if (missing.length > 0 && missing.length <= 3) console.log(`    MISSING: ${missing.join(", ")}`);
    if (extra.length > 0 && extra.length <= 3) console.log(`    EXTRA: ${extra.join(", ")}`);
  }

  // 4. 결제 세션 총계
  console.log("\n[4] 결제 세션 총계\n");
  const totalDbSessions = await prisma.paymentSession.count();
  let totalExpectedSessions = 0;
  for (const [sid] of STUDENT_RAW) {
    const co = new Map(CARRY_OVER_RAW).get(sid) ?? 0;
    const rounds = PAYMENT_ROUNDS_RAW.filter(r => r[0] === sid).length;
    totalExpectedSessions += rounds + (co > 0 ? 1 : 0);
  }
  console.log(`  기대 세션: ${totalExpectedSessions}개, DB 세션: ${totalDbSessions}개 → ${totalExpectedSessions === totalDbSessions ? "✅ 일치" : "❌ 불일치"}`);

  // 5. 총 출석 기록
  const totalDbAttendance = await prisma.attendance.count();
  console.log(`  DB 총 출석: ${totalDbAttendance}건`);

  // Summary
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log(`║  결과: 일치=${matchCount}명, 불일치=${mismatchCount}명                        ║`);
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  if (issues.length > 0) {
    console.log("⚠️  불일치 상세:\n");
    for (const issue of issues) console.log(issue);
  } else {
    console.log("✅ 모든 데이터가 정확히 일치합니다!");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
