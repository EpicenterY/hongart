/**
 * 나윤서(s05), 김지유(s09)의 주말→평일 변환 충돌 추적
 * 어떤 날짜에서 중복이 발생하는지 찾기
 */
import { ATTENDANCE_RAW } from "../src/lib/sheets-data";

const SCHEDULE_RAW: [string, string, string][] = [
  ["s05","TUE","14:00"],["s05","TUE","15:00"],
  ["s09","WED","17:00"],["s09","WED","18:00"],
];

const weekendToWeekday: Record<string, number> = {
  s05: 2, s09: 3,
};

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

for (const sid of ["s05", "s09"]) {
  const targetDow = weekendToWeekday[sid];
  const dayName = DAY_NAMES[targetDow];
  const slots = SCHEDULE_RAW
    .filter(([s, d]) => s === sid && d === dayName)
    .sort((a, b) => a[2].localeCompare(b[2]));
  const twoHourSlots: [string, string] = [slots[0][2], slots[1][2]];

  console.log(`\n=== ${sid} (${dayName}, slots: ${twoHourSlots.join("+")} ) ===`);

  const rawDates = ATTENDANCE_RAW.filter(([s]) => s === sid).map(([, d]) => d);
  console.log(`Raw entries: ${rawDates.length}`);

  // Simulate seed conversion
  const converted: { rawDate: string; convertedDate: string; timeSlot: string; isWeekend: boolean }[] = [];

  for (const rawDate of rawDates) {
    const dt = new Date(rawDate + "T00:00:00");
    const dow = dt.getDay();
    const isWeekend = dow === 0 || dow === 6;
    let d = rawDate;
    let timeSlot: string;

    if (isWeekend) {
      const offset = dow === 0 ? targetDow : targetDow - 6;
      dt.setDate(dt.getDate() + offset);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const day = String(dt.getDate()).padStart(2, "0");
      d = `${y}-${m}-${day}`;
      timeSlot = twoHourSlots[1]; // weekend → 2nd hour
    } else {
      timeSlot = twoHourSlots[0]; // weekday → 1st hour
    }

    converted.push({ rawDate, convertedDate: d, timeSlot, isWeekend });
  }

  // Find duplicates by (convertedDate, timeSlot)
  const seen = new Map<string, typeof converted[0]>();
  const duplicates: { first: typeof converted[0]; second: typeof converted[0] }[] = [];

  for (const entry of converted) {
    const key = `${entry.convertedDate}_${entry.timeSlot}`;
    if (seen.has(key)) {
      duplicates.push({ first: seen.get(key)!, second: entry });
    } else {
      seen.set(key, entry);
    }
  }

  console.log(`Converted entries: ${converted.length}`);
  console.log(`Unique (date+timeSlot) pairs: ${seen.size}`);
  console.log(`Duplicates: ${duplicates.length}`);

  if (duplicates.length > 0) {
    console.log("\nCollision details:");
    for (const { first, second } of duplicates) {
      console.log(`  convertedDate=${first.convertedDate} timeSlot=${first.timeSlot}`);
      console.log(`    1st: rawDate=${first.rawDate} (${first.isWeekend ? "weekend" : "weekday"})`);
      console.log(`    2nd: rawDate=${second.rawDate} (${second.isWeekend ? "weekend" : "weekday"})`);
    }
  }
}
