/**
 * s05 2025-12-09 날짜에 어떤 엔트리들이 있는지 전체 추적
 */
import { ATTENDANCE_RAW } from "../src/lib/sheets-data";

const weekendToWeekday: Record<string, number> = { s05: 2, s09: 3 };

for (const sid of ["s05", "s09"]) {
  const targetDow = weekendToWeekday[sid];
  const rawDates = ATTENDANCE_RAW.filter(([s]) => s === sid).map(([, d]) => d);

  // Find ALL raw entries that convert to the collision date
  const collisionDate = sid === "s05" ? "2025-12-09" : "2025-10-01";
  console.log(`\n=== ${sid}: collision date ${collisionDate} ===`);

  for (const rawDate of rawDates) {
    const dt = new Date(rawDate + "T00:00:00");
    const dow = dt.getDay();
    const isWeekend = dow === 0 || dow === 6;
    let d = rawDate;

    if (isWeekend) {
      const offset = dow === 0 ? targetDow : targetDow - 6;
      const dt2 = new Date(rawDate + "T00:00:00");
      dt2.setDate(dt2.getDate() + offset);
      const y = dt2.getFullYear();
      const m = String(dt2.getMonth() + 1).padStart(2, "0");
      const day = String(dt2.getDate()).padStart(2, "0");
      d = `${y}-${m}-${day}`;
    }

    if (d === collisionDate) {
      const dayNames = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
      console.log(`  raw=${rawDate}(${dayNames[dow]}) → converted=${d} (${isWeekend ? "weekend→2nd" : "weekday→1st"})`);
    }
  }

  // Also check what the surrounding week looks like
  console.log(`\nAll entries around collision date:`);
  const collDt = new Date(collisionDate + "T00:00:00");
  const rangeStart = new Date(collDt.getTime() - 7 * 86400000);
  const rangeEnd = new Date(collDt.getTime() + 7 * 86400000);

  for (const rawDate of rawDates) {
    const rd = new Date(rawDate + "T00:00:00");
    if (rd >= rangeStart && rd <= rangeEnd) {
      const dayNames = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
      const dow = rd.getDay();
      const isWeekend = dow === 0 || dow === 6;
      let d = rawDate;
      if (isWeekend) {
        const offset = dow === 0 ? targetDow : targetDow - 6;
        const dt2 = new Date(rawDate + "T00:00:00");
        dt2.setDate(dt2.getDate() + offset);
        d = `${dt2.getFullYear()}-${String(dt2.getMonth()+1).padStart(2,"0")}-${String(dt2.getDate()).padStart(2,"0")}`;
      }
      console.log(`  raw=${rawDate}(${dayNames[dow]}) → ${d} [${isWeekend ? "2nd" : "1st"}]`);
    }
  }
}
