import { PrismaClient } from "@prisma/client";
import { CARRY_OVER_RAW, PAYMENT_ROUNDS_RAW, ATTENDANCE_RAW } from "../src/lib/sheets-data";

const prisma = new PrismaClient();

// [id, name, daysPerWeek, parentPhone, childPhone|null, remaining]
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

// Schedule: [studentId, day, time]
const SCHEDULE_RAW: [string, string, string][] = [
  ["s01","THU","14:00"],["s04","THU","14:00"],["s10","THU","15:00"],["s24","THU","15:00"],
  ["s47","THU","16:00"],["s48","THU","16:00"],["s49","THU","17:00"],["s51","THU","17:00"],
  ["s02","FRI","14:00"],["s03","FRI","14:00"],["s04","FRI","14:00"],
  ["s08","FRI","15:00"],["s15","FRI","16:00"],["s18","FRI","16:00"],
  ["s21","FRI","16:00"],["s22","FRI","17:00"],["s23","FRI","17:00"],["s26","FRI","17:00"],
  ["s28","FRI","18:00"],["s29","FRI","18:00"],["s30","FRI","18:00"],["s31","FRI","18:00"],
  ["s32","FRI","14:00"],
  ["s06","MON","14:00"],["s12","MON","14:00"],["s19","MON","14:00"],
  ["s08","MON","15:00"],["s11","MON","15:00"],["s25","MON","15:00"],
  ["s14","MON","16:00"],["s20","MON","16:00"],["s33","MON","16:00"],
  ["s36","MON","17:00"],["s42","MON","17:00"],["s43","MON","17:00"],
  ["s50","MON","18:00"],["s54","MON","18:00"],
  ["s05","TUE","14:00"],["s07","TUE","14:00"],["s10","TUE","14:00"],
  ["s16","TUE","15:00"],["s17","TUE","15:00"],["s27","TUE","15:00"],
  ["s31","TUE","16:00"],["s34","TUE","16:00"],["s35","TUE","16:00"],
  ["s37","TUE","17:00"],["s38","TUE","17:00"],["s40","TUE","17:00"],
  ["s41","TUE","18:00"],["s52","TUE","18:00"],["s53","TUE","18:00"],
  ["s08","WED","14:00"],["s11","WED","14:00"],["s13","WED","14:00"],["s14","WED","14:00"],
  ["s15","WED","15:00"],["s17","WED","15:00"],["s18","WED","15:00"],["s20","WED","15:00"],
  ["s31","WED","16:00"],["s35","WED","16:00"],["s39","WED","16:00"],["s44","WED","16:00"],
  ["s45","WED","17:00"],["s46","WED","17:00"],["s50","WED","17:00"],["s52","WED","17:00"],
  ["s53","WED","17:00"],["s33","WED","18:00"],["s09","WED","18:00"],
  ["s05","TUE","15:00"],["s06","MON","15:00"],["s09","WED","17:00"],["s12","MON","15:00"],
];

const MONTH_DATES = [
  "2025-04","2025-05","2025-06","2025-07","2025-08","2025-09",
  "2025-10","2025-11","2025-12","2026-01","2026-02","2026-03","2026-04",
];

const feeMap: Record<number, number> = { 1: 100000, 2: 140000, 3: 170000 };

// Weekend → weekday conversion for 2-hour consecutive students
const weekendToWeekday: Record<string, number> = {
  s05: 2, s06: 1, s09: 3, s12: 1,
};

async function main() {
  console.log("🌱 Seeding database...");

  // Clear all tables
  await prisma.$transaction([
    prisma.scheduleOverride.deleteMany(),
    prisma.pendingPlanChange.deleteMany(),
    prisma.memo.deleteMany(),
    prisma.attendance.deleteMany(),
    prisma.paymentSession.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.student.deleteMany(),
    prisma.plan.deleteMany(),
    prisma.vacationPeriod.deleteMany(),
    prisma.publicHoliday.deleteMany(),
    prisma.appSettings.deleteMany(),
  ]);

  // Create plans
  await prisma.plan.createMany({
    data: [
      { daysPerWeek: 1, label: "주 1회", monthlyFee: 100000 },
      { daysPerWeek: 2, label: "주 2회", monthlyFee: 140000 },
      { daysPerWeek: 3, label: "주 3회", monthlyFee: 170000 },
    ],
  });

  // Create default vacation periods
  await prisma.vacationPeriod.createMany({
    data: [
      { name: "여름방학", startDate: "2026-07-27", endDate: "2026-08-14" },
      { name: "겨울방학", startDate: "2026-12-21", endDate: "2027-01-02" },
    ],
  });

  // Create app settings
  await prisma.appSettings.create({
    data: {
      id: "singleton",
      enabledDays: ["MON", "TUE", "WED", "THU", "FRI"],
      pin: "092200",
    },
  });

  // Build schedule map
  const schedMap = new Map<string, { day: string; time: string }[]>();
  for (const [sid, day, time] of SCHEDULE_RAW) {
    if (!schedMap.has(sid)) schedMap.set(sid, []);
    schedMap.get(sid)!.push({ day, time });
  }

  // Build carry-over map
  const coMap = new Map<string, number>();
  for (const [sid, co] of CARRY_OVER_RAW) coMap.set(sid, co);

  // Build payment rounds map
  const roundsMap = new Map<string, [number, number][]>();
  for (const [sid, mi, cap] of PAYMENT_ROUNDS_RAW) {
    if (!roundsMap.has(sid)) roundsMap.set(sid, []);
    roundsMap.get(sid)!.push([mi, cap]);
  }

  // Build 2-hour student slot mapping
  const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const twoHourSlots: Record<string, [string, string]> = {};
  for (const sid of Object.keys(weekendToWeekday)) {
    const dayName = { 2: "TUE", 1: "MON", 3: "WED" }[weekendToWeekday[sid]]!;
    const slots = (schedMap.get(sid) ?? [])
      .filter(s => s.day === dayName)
      .sort((a, b) => a.time.localeCompare(b.time));
    twoHourSlots[sid] = [slots[0].time, slots[1].time];
  }

  // Build attendance map with weekend conversion
  const attMap = new Map<string, { date: string; timeSlot: string }[]>();
  const usedSlots = new Set<string>(); // track "sid_date_timeSlot" to detect collisions
  for (const [sid, date] of ATTENDANCE_RAW) {
    let d = date;
    let timeSlot: string;

    if (sid in weekendToWeekday) {
      const dt = new Date(date + "T00:00:00");
      const dow = dt.getDay();
      const isWeekend = dow === 0 || dow === 6;
      if (isWeekend) {
        const targetDow = weekendToWeekday[sid];
        const offset = dow === 0 ? targetDow : targetDow - 6;
        dt.setDate(dt.getDate() + offset);
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, "0");
        const day = String(dt.getDate()).padStart(2, "0");
        d = `${y}-${m}-${day}`;
        timeSlot = twoHourSlots[sid][1]; // weekend = 2nd hour
        // If collision (Sun+Sat → same converted date), remap Sat to NEXT week
        const key = `${sid}_${d}_${timeSlot}`;
        if (usedSlots.has(key)) {
          const dt2 = new Date(date + "T00:00:00");
          dt2.setDate(dt2.getDate() + (targetDow + 1)); // Sat → next week's target day
          d = `${dt2.getFullYear()}-${String(dt2.getMonth() + 1).padStart(2, "0")}-${String(dt2.getDate()).padStart(2, "0")}`;
        }
      } else {
        timeSlot = twoHourSlots[sid][0]; // weekday = 1st hour
      }
    } else {
      const dayName = DAY_NAMES[new Date(d + "T00:00:00").getDay()];
      timeSlot = (schedMap.get(sid) ?? []).find(s => s.day === dayName)?.time ?? "14:00";
    }

    usedSlots.add(`${sid}_${d}_${timeSlot}`);
    if (!attMap.has(sid)) attMap.set(sid, []);
    attMap.get(sid)!.push({ date: d, timeSlot });
  }

  // Track old ID → new UUID mapping
  const studentIdMap = new Map<string, string>();

  // Create students (need individual creates for UUID mapping)
  console.log(`Creating ${STUDENT_RAW.length} students...`);
  for (const [id, name, , pp, cp] of STUDENT_RAW) {
    const student = await prisma.student.create({
      data: {
        name,
        phone: cp,
        parentPhone: pp,
        status: "ACTIVE",
        createdAt: new Date("2025-04-01"),
      },
    });
    studentIdMap.set(id, student.id);
  }

  // Create subscriptions (batch)
  console.log("Creating subscriptions...");
  const subData = STUDENT_RAW.map(([id, , dpw]) => ({
    studentId: studentIdMap.get(id)!,
    daysPerWeek: dpw,
    schedule: (schedMap.get(id) ?? []) as unknown as object[],
    startDate: new Date("2025-04-01T00:00:00Z"),
    monthlyFee: feeMap[dpw] ?? 100000,
    isActive: true,
  }));
  await prisma.subscription.createMany({ data: subData });

  // Collect all payment sessions in memory first, then batch insert
  console.log("Creating payment sessions...");
  type PsData = {
    studentId: string; capacity: number; frozen: boolean;
    amount: number; method: "TRANSFER"; daysPerWeek: number;
    monthlyFee: number; note: string | null; createdAt: Date;
  };
  const allSessions: PsData[] = [];

  for (const [id] of STUDENT_RAW) {
    const uuid = studentIdMap.get(id)!;
    const carryOver = coMap.get(id) ?? 0;

    if (carryOver > 0) {
      allSessions.push({
        studentId: uuid, capacity: carryOver, frozen: false,
        amount: 0, method: "TRANSFER", daysPerWeek: 0, monthlyFee: 0,
        note: "이월", createdAt: new Date("2025-03-01T09:00:00+09:00"),
      });
    }

    const debt = carryOver < 0 ? Math.abs(carryOver) : 0;
    const rounds = roundsMap.get(id) ?? [];
    for (let ri = 0; ri < rounds.length; ri++) {
      const [mi, cap] = rounds[ri];
      const adjustedCap = ri === 0 && debt > 0 ? cap - debt : cap;
      const dpwForRound = cap <= 5 ? 1 : cap <= 9 ? 2 : 3;
      const roundFee = feeMap[dpwForRound] ?? 100000;
      allSessions.push({
        studentId: uuid, capacity: adjustedCap, frozen: false,
        amount: roundFee, method: "TRANSFER", daysPerWeek: dpwForRound,
        monthlyFee: roundFee,
        note: ri === 0 && debt > 0 ? `미결제 ${debt}회 차감` : null,
        createdAt: new Date(`${MONTH_DATES[mi]}-01T09:00:00+09:00`),
      });
    }
  }

  // Batch insert in chunks of 100
  for (let i = 0; i < allSessions.length; i += 100) {
    await prisma.paymentSession.createMany({ data: allSessions.slice(i, i + 100) });
  }
  console.log(`Created ${allSessions.length} payment sessions`);

  // Collect all attendance records, then batch insert
  console.log("Creating attendance records...");
  type AttData = {
    studentId: string; date: Date; timeSlot: string; status: "PRESENT";
    checkInAt: Date; note: null;
  };
  const allAtt: AttData[] = [];

  for (const [id] of STUDENT_RAW) {
    const uuid = studentIdMap.get(id)!;
    const records = attMap.get(id) ?? [];
    for (const { date: d, timeSlot } of records) {
      allAtt.push({
        studentId: uuid,
        date: new Date(`${d}T00:00:00Z`),
        timeSlot,
        status: "PRESENT",
        checkInAt: new Date(`${d}T15:05:00+09:00`),
        note: null,
      });
    }
  }

  // Batch insert in chunks of 200
  for (let i = 0; i < allAtt.length; i += 200) {
    await prisma.attendance.createMany({ data: allAtt.slice(i, i + 200), skipDuplicates: true });
  }
  console.log(`Created ${allAtt.length} attendance records`);

  console.log("✅ Seed complete!");
  console.log(`  Students: ${STUDENT_RAW.length}`);
  console.log(`  Payment sessions: ${allSessions.length}`);
  console.log(`  Attendance records: ${allAtt.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
