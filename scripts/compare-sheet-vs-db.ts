/**
 * 시트 최신값(imported-data.ts) vs DB 현재값 비교
 * - 시트 잔여 = (이월 + 결제회차합) - 출석수
 * - DB 잔여 = totalCapacity - consumingAttendance
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 새로 임포트된 데이터 (시트 현재 상태)
import { CARRY_OVER_RAW, PAYMENT_ROUNDS_RAW, ATTENDANCE_RAW } from "./imported-data";

// seed.ts의 STUDENT_RAW (이름+시트잔여 매핑)
const STUDENT_RAW: [string, string, number][] = [
  ["s01","서동준",-6],["s02","이윤서",-1],["s03","정윤영",1],["s04","최하연",6],
  ["s05","나윤서",4],["s06","김리하",-6],["s07","하라윤",2],["s08","임정윤",6],
  ["s09","김지유",2],["s10","최혜원",0],["s11","류지아",5],["s12","문하윤",4],
  ["s13","최은수",3],["s14","정예린",-3],["s15","고해서",-6],["s16","길민준",0],
  ["s17","강지윤",-1],["s18","이태율",-2],["s19","조현래",2],["s20","송서율",-4],
  ["s21","이수현",0],["s22","최은우",3],["s23","강하준",0],["s24","김주아",1],
  ["s25","전수호",3],["s26","이나윤",-1],["s27","정원",0],["s28","홍채이",1],
  ["s29","인하엘",0],["s30","임건우",-1],["s31","이하율",3],["s32","김지안",-1],
  ["s33","현채은",8],["s34","송서연",-1],["s35","황찬",1],["s36","정다민",-2],
  ["s37","임지안",-1],["s38","이루미",0],["s39","조혜준",0],["s40","김민겸",0],
  ["s41","이로이",-4],["s42","박서은",3],["s43","정하윤",3],["s44","김건우",3],
  ["s45","최은호",3],["s46","장승우",3],["s47","안제하",-1],["s48","정예나",-1],
  ["s49","하예윤",3],["s50","이혜성",-2],["s51","김서진",0],["s52","유이도",2],
  ["s53","유이르",2],["s54","펜더아린",3],
];

async function main() {
  // 시트 최신 계산
  const coMap = new Map<string, number>();
  for (const [sid, co] of CARRY_OVER_RAW) coMap.set(sid, co);

  const roundsMap = new Map<string, number>();
  for (const [sid, , cap] of PAYMENT_ROUNDS_RAW) {
    roundsMap.set(sid, (roundsMap.get(sid) ?? 0) + cap);
  }

  const attCountMap = new Map<string, number>();
  for (const [sid] of ATTENDANCE_RAW) {
    attCountMap.set(sid, (attCountMap.get(sid) ?? 0) + 1);
  }

  // DB 현재값
  const students = await prisma.student.findMany({
    orderBy: { name: "asc" },
    include: {
      paymentSessions: true,
      attendances: true,
    },
  });

  const nameToDbData = new Map<string, { cap: number; consuming: number; remaining: number }>();
  for (const s of students) {
    const cap = s.paymentSessions.reduce((sum, ps) => sum + ps.capacity, 0);
    const consuming = s.attendances.filter(a => a.status !== "ABSENT").length;
    nameToDbData.set(s.name, { cap, consuming, remaining: cap - consuming });
  }

  console.log("ID\t이름\t\t시트잔여(seed)\t시트잔여(최신)\tDB잔여\t\t상태");
  console.log("─".repeat(90));

  let allMatch = 0;
  let mismatch = 0;

  for (const [sid, name, seedRemaining] of STUDENT_RAW) {
    const co = coMap.get(sid) ?? 0;
    const roundsCap = roundsMap.get(sid) ?? 0;
    const sheetCap = co + roundsCap;
    const sheetAtt = attCountMap.get(sid) ?? 0;
    const sheetRemaining = sheetCap - sheetAtt;

    const db = nameToDbData.get(name);
    const dbRemaining = db?.remaining ?? "?";

    const seedMatch = seedRemaining === sheetRemaining ? "" : `seed≠sheet(${sheetRemaining - seedRemaining})`;
    const dbMatch = dbRemaining === sheetRemaining ? "" : `db≠sheet(${(dbRemaining as number) - sheetRemaining})`;

    const pad = name.length <= 3 ? "\t\t" : "\t";
    const issues = [seedMatch, dbMatch].filter(Boolean);
    const status = issues.length === 0 ? "OK" : issues.join(" ");

    if (issues.length > 0) mismatch++; else allMatch++;

    console.log(`${sid}\t${name}${pad}${seedRemaining}\t\t${sheetRemaining}\t\t${dbRemaining}\t\t${status}`);
  }

  console.log(`\n=== 전체 일치: ${allMatch}명, 불일치: ${mismatch}명 ===`);
  console.log(`\n시트 출석 총계: 기존=${2665}, 최신=${ATTENDANCE_RAW.length}, 차이=${ATTENDANCE_RAW.length - 2665}`);

  await prisma.$disconnect();
}
main();
