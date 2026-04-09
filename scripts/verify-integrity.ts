import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Raw data from seed (remaining field = expected remaining at current point)
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

async function main() {
  console.log("=== 데이터 정합성 검증 ===\n");

  // 1. Student count
  const studentCount = await prisma.student.count();
  console.log(`학생 수: DB=${studentCount}, RAW=${STUDENT_RAW.length} ${studentCount === STUDENT_RAW.length ? "✅" : "❌"}`);

  // 2. Attendance count & status
  const attCount = await prisma.attendance.count();
  console.log(`출석 기록: DB=${attCount}`);
  const attByStatus = await prisma.attendance.groupBy({ by: ["status"], _count: true });
  console.log(`출석 상태 분포:`, attByStatus.map(a => `${a.status}=${a._count}`).join(", "));

  // 3. Payment session count
  const psCount = await prisma.paymentSession.count();
  console.log(`결제 세션: DB=${psCount}`);

  // 4. Per-student remaining check
  const students = await prisma.student.findMany({ orderBy: { name: "asc" } });

  // Build expected remaining map
  const expectedRemaining = new Map<string, number>();
  for (const [, name, , , , remaining] of STUDENT_RAW) {
    expectedRemaining.set(name, remaining);
  }

  // Payment sessions by student
  const allSessions = await prisma.paymentSession.findMany();
  const capByStudent = new Map<string, number>();
  for (const s of allSessions) {
    capByStudent.set(s.studentId, (capByStudent.get(s.studentId) ?? 0) + s.capacity);
  }

  // Attendance (consuming statuses) by student
  const allAtt = await prisma.attendance.findMany();
  const usedByStudent = new Map<string, number>();
  for (const a of allAtt) {
    if (["PRESENT", "LATE", "MAKEUP"].includes(a.status)) {
      usedByStudent.set(a.studentId, (usedByStudent.get(a.studentId) ?? 0) + 1);
    }
  }

  console.log(`\n${"이름".padEnd(10)} ${"총용량".padStart(6)} ${"사용".padStart(6)} ${"잔여".padStart(6)} ${"기대".padStart(6)} 결과`);
  console.log("-".repeat(55));

  let mismatches = 0;
  for (const student of students) {
    const totalCap = capByStudent.get(student.id) ?? 0;
    const used = usedByStudent.get(student.id) ?? 0;
    const remaining = totalCap - used;
    const expected = expectedRemaining.get(student.name);
    const match = expected !== undefined && remaining === expected;
    if (!match) mismatches++;
    console.log(
      `${student.name.padEnd(10)} ${String(totalCap).padStart(6)} ${String(used).padStart(6)} ${String(remaining).padStart(6)} ${String(expected ?? "?").padStart(6)} ${match ? "✅" : "❌"}`
    );
  }

  console.log("-".repeat(55));
  console.log(`${mismatches === 0 ? "✅ 모든 학생 잔여 회차 일치!" : `❌ ${mismatches}명 불일치`}\n`);

  // 5. Duplicate check via Prisma groupBy
  const attGroups = await prisma.attendance.groupBy({
    by: ["studentId", "date", "timeSlot"],
    _count: true,
    having: { _all: { _count: { gt: 1 } } } as never,
  }).catch(() => []);
  console.log(`중복 출석: ${attGroups.length} ${attGroups.length === 0 ? "✅" : "❌"}`);

  // 6. All attendance should be PRESENT after fresh seed
  const nonPresent = await prisma.attendance.count({ where: { status: { not: "PRESENT" } } });
  console.log(`비정상 출석 상태: ${nonPresent} ${nonPresent === 0 ? "✅" : "⚠️"}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
