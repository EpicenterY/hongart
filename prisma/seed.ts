import { PrismaClient } from "@prisma/client";
import { CARRY_OVER_RAW, PAYMENT_ROUNDS_RAW, ATTENDANCE_RAW, STUDENT_META_RAW } from "../src/lib/sheets-data";

const prisma = new PrismaClient();

// Old student ID → name mapping (for SCHEDULE_RAW remapping from old 54-student IDs)
const OLD_NAMES: Record<string, string> = {
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

// Build name → newSid mapping (prefer active students for duplicate names like 김서진)
const nameToNewSid = new Map<string, string>();
for (const [sid, , name, isActive] of STUDENT_META_RAW) {
  if (!isActive) nameToNewSid.set(name, sid);
}
for (const [sid, , name, isActive] of STUDENT_META_RAW) {
  if (isActive) nameToNewSid.set(name, sid);
}

function remapSid(oldSid: string): string {
  const name = OLD_NAMES[oldSid];
  if (!name) throw new Error(`Unknown old sid: ${oldSid}`);
  const newSid = nameToNewSid.get(name);
  if (!newSid) throw new Error(`Cannot remap ${oldSid} (${name}) — not found in STUDENT_META_RAW`);
  return newSid;
}

// Schedule: [studentId, day, time] — old IDs, remapped below
const SCHEDULE_RAW_OLD: [string, string, string][] = [
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

// Remap schedule to new IDs
const SCHEDULE_RAW: [string, string, string][] = SCHEDULE_RAW_OLD.map(
  ([oldSid, day, time]) => [remapSid(oldSid), day, time]
);

// Weekend → weekday conversion for 2-hour consecutive students (remapped to new IDs)
const OLD_WEEKEND: Record<string, number> = { s05: 2, s06: 1, s09: 3, s12: 1 };
const weekendToWeekday: Record<string, number> = {};
for (const [oldSid, dow] of Object.entries(OLD_WEEKEND)) {
  weekendToWeekday[remapSid(oldSid)] = dow;
}

const MONTH_DATES = [
  "2025-04","2025-05","2025-06","2025-07","2025-08","2025-09",
  "2025-10","2025-11","2025-12","2026-01","2026-02","2026-03","2026-04",
];

const feeMap: Record<number, number> = { 1: 100000, 2: 140000, 3: 170000 };

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

  // Build schedule map (new IDs)
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
    if (slots.length >= 2) {
      twoHourSlots[sid] = [slots[0].time, slots[1].time];
    }
  }

  // Build attendance map with weekend conversion
  const attMap = new Map<string, { date: string; timeSlot: string }[]>();
  const usedSlots = new Set<string>(); // track "sid_date_timeSlot" to detect collisions
  for (const [sid, date] of ATTENDANCE_RAW) {
    let d = date;
    let timeSlot: string;

    if (sid in weekendToWeekday && sid in twoHourSlots) {
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

  // Track sid → DB UUID mapping
  const studentIdMap = new Map<string, string>();

  // Create students (individual creates for UUID mapping)
  console.log(`Creating ${STUDENT_META_RAW.length} students...`);
  for (const [sid, , name, isActive, , pp, cp] of STUDENT_META_RAW) {
    const student = await prisma.student.create({
      data: {
        name,
        phone: cp || null,
        parentPhone: pp || null,
        status: isActive ? "ACTIVE" : "WITHDRAWN",
        createdAt: new Date("2025-04-01"),
      },
    });
    studentIdMap.set(sid, student.id);
  }

  // Create subscriptions (batch)
  console.log("Creating subscriptions...");
  const subData = STUDENT_META_RAW.map(([sid, , , isActive, dpw]) => ({
    studentId: studentIdMap.get(sid)!,
    daysPerWeek: dpw,
    schedule: (isActive ? (schedMap.get(sid) ?? []) : []) as unknown as object[],
    startDate: new Date("2025-04-01T00:00:00Z"),
    monthlyFee: feeMap[dpw] ?? 100000,
    isActive: isActive,
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

  for (const [sid] of STUDENT_META_RAW) {
    const uuid = studentIdMap.get(sid)!;
    const carryOver = coMap.get(sid) ?? 0;

    if (carryOver > 0) {
      allSessions.push({
        studentId: uuid, capacity: carryOver, frozen: false,
        amount: 0, method: "TRANSFER", daysPerWeek: 0, monthlyFee: 0,
        note: "이월", createdAt: new Date("2025-03-01T09:00:00+09:00"),
      });
    }

    const debt = carryOver < 0 ? Math.abs(carryOver) : 0;
    const rounds = roundsMap.get(sid) ?? [];
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

  for (const [sid] of STUDENT_META_RAW) {
    const uuid = studentIdMap.get(sid)!;
    const records = attMap.get(sid) ?? [];
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

  const activeCount = STUDENT_META_RAW.filter(m => m[3]).length;
  console.log("✅ Seed complete!");
  console.log(`  Students: ${STUDENT_META_RAW.length} (${activeCount} active, ${STUDENT_META_RAW.length - activeCount} inactive)`);
  console.log(`  Payment sessions: ${allSessions.length}`);
  console.log(`  Attendance records: ${allAtt.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
