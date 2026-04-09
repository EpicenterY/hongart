/**
 * s25(전수호), s37(임지안) 이월값 역산 분석
 * "어떤 이월값이면 시트 잔여와 일치하는지" 확인
 */
import { CARRY_OVER_RAW, PAYMENT_ROUNDS_RAW, ATTENDANCE_RAW } from "../src/lib/sheets-data";

const MONTH_DATES = [
  "2025-04","2025-05","2025-06","2025-07","2025-08","2025-09",
  "2025-10","2025-11","2025-12","2026-01","2026-02","2026-03","2026-04",
];

function reverseEngineer(sid: string, name: string, dpw: number, sheetsRemaining: number) {
  console.log(`\n${"═".repeat(50)}`);
  console.log(`${sid} ${name} (dpw=${dpw}, 시트잔여=${sheetsRemaining})`);

  const currentCO = new Map(CARRY_OVER_RAW).get(sid) ?? 0;
  const rounds: [number, number][] = [];
  for (const [s, mi, cap] of PAYMENT_ROUNDS_RAW) {
    if (s === sid) rounds.push([mi, cap]);
  }

  // 출석 수
  const attCount = new Set(ATTENDANCE_RAW.filter(a => a[0] === sid).map(a => a[1])).size;
  console.log(`현재 이월: ${currentCO}, 라운드: ${rounds.length}개, 출석: ${attCount}건`);

  // 이월=0일 때 capacity
  let capNoCarry = 0;
  for (const [, cap] of rounds) capNoCarry += cap;
  console.log(`라운드만 capacity (이월 제외): ${capNoCarry}`);
  console.log(`이월=0일 때 잔여: ${capNoCarry} - ${attCount} = ${capNoCarry - attCount}`);

  // 시트 잔여가 되려면 필요한 총 capacity
  const neededCapacity = sheetsRemaining + attCount;
  console.log(`시트잔여(${sheetsRemaining})가 되려면 필요한 capacity: ${neededCapacity}`);

  // 이월이 양수일 때: capacity = carry + sum(rounds)
  // debt일 때: capacity = sum(rounds) - debt (첫 라운드에서 차감)
  // neededCapacity = capacity인 이월값 찾기

  // Case 1: carry > 0 → capacity = carry + sum
  const needCarryPositive = neededCapacity - capNoCarry;
  if (needCarryPositive > 0) {
    console.log(`→ 양수 이월 ${needCarryPositive}이면 일치`);
  }

  // Case 2: carry < 0 (debt) → capacity = sum - |carry| (from first round)
  const needDebt = capNoCarry - neededCapacity;
  if (needDebt > 0) {
    console.log(`→ 음수 이월 -${needDebt}이면 일치 (첫 라운드에서 ${needDebt}회 차감)`);
  }

  // Case 3: carry = 0 → capacity = sum
  if (neededCapacity === capNoCarry) {
    console.log(`→ 이월 0이면 일치`);
  }

  console.log(`\n현재 이월(${currentCO}) → 현재 잔여: ${currentCO > 0 ? currentCO + capNoCarry : capNoCarry - Math.abs(currentCO)} - ${attCount} = ${(currentCO > 0 ? currentCO + capNoCarry : capNoCarry - Math.abs(currentCO)) - attCount}`);
}

reverseEngineer("s25", "전수호", 1, 3);
reverseEngineer("s37", "임지안", 1, -1);

// Weekend students
console.log(`\n${"═".repeat(50)}`);
console.log(`주말 학생 (2시간 연속수업) 분석`);
console.log(`${"═".repeat(50)}`);

for (const [sid, name, sheetsRem] of [
  ["s05", "나윤서", 4],
  ["s06", "김리하", -6],
  ["s09", "김지유", 2],
  ["s12", "문하윤", 4],
] as [string, string, number][]) {
  const rawCount = ATTENDANCE_RAW.filter(a => a[0] === sid).length;
  const co = new Map(CARRY_OVER_RAW).get(sid) ?? 0;
  const rounds = PAYMENT_ROUNDS_RAW.filter(r => r[0] === sid);
  const debt = co < 0 ? Math.abs(co) : 0;
  let totalCap = co > 0 ? co : 0;
  for (let ri = 0; ri < rounds.length; ri++) {
    const [, , cap] = rounds[ri];
    totalCap += ri === 0 && debt > 0 ? cap - debt : cap;
  }

  // 시트 방식: 원본 출석 수 그대로 (2시간 = 2건)
  const sheetsCalc = totalCap - rawCount;
  console.log(`\n${sid} ${name}: capacity=${totalCap}, 원본출석=${rawCount}, 시트잔여=${sheetsRem}, capacity-rawCount=${sheetsCalc} ${sheetsCalc === sheetsRem ? "✅" : "❌"}`);
}
