/**
 * 최신 시트 계산 잔여 vs DB 잔여 비교
 * 시트 잔여 = carry_over + sum(payment_rounds) - count(attendance)
 * DB 잔여  = sum(session.capacity) - count(consuming attendance)
 */
import { PrismaClient } from "@prisma/client";
import { CARRY_OVER_RAW, PAYMENT_ROUNDS_RAW, ATTENDANCE_RAW } from "../src/lib/sheets-data";

const prisma = new PrismaClient();

const NAMES: Record<string, string> = {
  s01:"서동준",s02:"이윤서",s03:"정윤영",s04:"최하연",s05:"나윤서",s06:"김리하",
  s07:"하라윤",s08:"임정윤",s09:"김지유",s10:"최혜원",s11:"류지아",s12:"문하윤",
  s13:"최은수",s14:"정예린",s15:"고해서",s16:"길민준",s17:"강지윤",s18:"이태율",
  s19:"조현래",s20:"송서율",s21:"이수현",s22:"최은우",s23:"강하준",s24:"김주아",
  s25:"전수호",s26:"이나윤",s27:"정원",s28:"홍채이",s29:"인하엘",s30:"임건우",
  s31:"이하율",s32:"김지안",s33:"현채은",s34:"송서연",s35:"황찬",s36:"정다민",
  s37:"임지안",s38:"이루미",s39:"조혜준",s40:"김민겸",s41:"이로이",s42:"박서은",
  s43:"정하윤",s44:"김건우",s45:"최은호",s46:"장승우",s47:"안제하",s48:"정예나",
  s49:"하예윤",s50:"이혜성",s51:"김서진",s52:"유이도",s53:"유이르",s54:"펜더아린",
};

async function main() {
  // 시트 계산 (carry_over + payment_rounds - attendance)
  const sheetData = new Map<string, { co: number; paySum: number; attCount: number; remaining: number }>();

  const coMap = new Map<string, number>();
  for (const [sid, co] of CARRY_OVER_RAW) coMap.set(sid, co);

  const payMap = new Map<string, number>();
  for (const [sid, , cap] of PAYMENT_ROUNDS_RAW) payMap.set(sid, (payMap.get(sid) ?? 0) + cap);

  const attMap = new Map<string, number>();
  for (const [sid] of ATTENDANCE_RAW) attMap.set(sid, (attMap.get(sid) ?? 0) + 1);

  for (const sid of Object.keys(NAMES)) {
    const co = coMap.get(sid) ?? 0;
    const paySum = payMap.get(sid) ?? 0;
    const attCount = attMap.get(sid) ?? 0;
    sheetData.set(sid, { co, paySum, attCount, remaining: co + paySum - attCount });
  }

  // DB 데이터
  const students = await prisma.student.findMany({
    orderBy: { name: "asc" },
    include: { paymentSessions: true, attendances: true },
  });

  const dbMap = new Map<string, { cap: number; att: number; remaining: number }>();
  for (const s of students) {
    const cap = s.paymentSessions.reduce((sum, ps) => sum + ps.capacity, 0);
    const att = s.attendances.filter(a => a.status !== "ABSENT").length;
    dbMap.set(s.name, { cap, att, remaining: cap - att });
  }

  console.log("ID\t이름\t\t시트잔여\tDB잔여\t시트cap\tDB-cap\t시트att\tDB-att\t상태");
  console.log("─".repeat(95));

  let ok = 0, ng = 0;
  const issues: string[] = [];

  for (const [sid, name] of Object.entries(NAMES)) {
    const s = sheetData.get(sid)!;
    const d = dbMap.get(name);
    if (!d) { console.log(`${sid}\t${name}\t\t-- DB에 없음 --`); ng++; continue; }

    const sheetCap = s.co + s.paySum;
    const capDiff = d.cap !== sheetCap;
    const attDiff = d.att !== s.attCount;
    const remDiff = d.remaining !== s.remaining;

    const match = !capDiff && !attDiff && !remDiff;
    if (match) ok++; else ng++;

    const pad = name.length <= 3 ? "\t\t" : "\t";
    const status = match ? "OK" : `cap${capDiff ? "≠" : "="},att${attDiff ? "≠" : "="},rem${remDiff ? "≠" : "="}`;

    if (!match) {
      console.log(`${sid}\t${name}${pad}${s.remaining}\t\t${d.remaining}\t${sheetCap}\t${d.cap}\t${s.attCount}\t${d.att}\t${status}`);
      issues.push(`${sid} ${name}: 시트=${s.remaining}(co=${s.co}+pay=${s.paySum}-att=${s.attCount}), DB=${d.remaining}(cap=${d.cap}-att=${d.att})`);
    } else {
      console.log(`${sid}\t${name}${pad}${s.remaining}\t\t${d.remaining}\t${sheetCap}\t${d.cap}\t${s.attCount}\t${d.att}\tOK`);
    }
  }

  console.log(`\n=== 일치: ${ok}명, 불일치: ${ng}명 ===`);
  if (issues.length > 0) {
    console.log("\n불일치 상세:");
    for (const i of issues) console.log("  " + i);
  }

  await prisma.$disconnect();
}
main();
