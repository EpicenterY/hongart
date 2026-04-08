#!/usr/bin/env npx tsx
/**
 * Google Sheets → mock-data.ts 데이터 임포트 스크립트
 *
 * 종합출석부에서 carry-over + 결제회차를 파싱하고,
 * 13개 월별 시트에서 출석 기록을 파싱한 뒤,
 * 교차 검증 후 TypeScript 상수를 scripts/imported-data.ts에 출력한다.
 *
 * Usage: npx tsx scripts/import-sheets.ts
 */

import { writeFileSync } from "fs";
import { resolve } from "path";

const SPREADSHEET_ID = "1f68PgFP5t4wZkrTg3cgB3HojNQKlHxKf8FlKSYwQFRc";

function csvUrl(sheet: string): string {
  return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;
}

const MONTH_SHEETS: { name: string; year: number; month: number }[] = [
  { name: "4월", year: 2025, month: 4 },
  { name: "5월", year: 2025, month: 5 },
  { name: "6월", year: 2025, month: 6 },
  { name: "7월", year: 2025, month: 7 },
  { name: "8월", year: 2025, month: 8 },
  { name: "9월", year: 2025, month: 9 },
  { name: "10월", year: 2025, month: 10 },
  { name: "11월", year: 2025, month: 11 },
  { name: "12월", year: 2025, month: 12 },
  { name: "1월", year: 2026, month: 1 },
  { name: "2월", year: 2026, month: 2 },
  { name: "3월", year: 2026, month: 3 },
  { name: "4월(2026)", year: 2026, month: 4 },
];

// ─── CSV Parser ──────────────────────────────────────────

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const len = text.length;
  let i = 0;

  while (i < len) {
    const row: string[] = [];
    while (i < len && text[i] !== "\n" && text[i] !== "\r") {
      if (text[i] === '"') {
        i++; // skip opening quote
        let field = "";
        while (i < len) {
          if (text[i] === '"') {
            if (i + 1 < len && text[i + 1] === '"') {
              field += '"';
              i += 2;
            } else {
              i++; // skip closing quote
              break;
            }
          } else {
            field += text[i++];
          }
        }
        row.push(field);
        if (i < len && text[i] === ",") i++;
      } else {
        let field = "";
        while (i < len && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") {
          field += text[i++];
        }
        row.push(field);
        if (i < len && text[i] === ",") i++;
      }
    }
    // skip \r\n or \n
    if (i < len && text[i] === "\r") i++;
    if (i < len && text[i] === "\n") i++;
    if (row.length > 0) rows.push(row);
  }
  return rows;
}

// ─── Fetch helpers ───────────────────────────────────────

async function fetchSheet(name: string): Promise<string[][]> {
  const url = csvUrl(name);
  process.stderr.write(`  Fetching "${name}"...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${name} (${res.status})`);
  const text = await res.text();
  const rows = parseCSV(text);
  process.stderr.write(` ${rows.length} rows\n`);
  return rows;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  console.error("=== Google Sheets Import ===\n");

  // ── 1. 종합출석부 파싱 ──
  console.error("[1/3] 종합출석부 파싱");
  const summary = await fetchSheet("종합출석부");
  const studentRows = summary.slice(4); // skip 4 header rows

  const numToSid = new Map<string, string>();
  const carryOver: [string, number][] = [];
  const paymentRounds: [string, number, number][] = [];
  const validationMap = new Map<
    string,
    { name: string; consumed: number; capacity: number; remaining: number }
  >();

  let studentCount = 0;
  for (const row of studentRows) {
    const num = row[0]?.trim();
    if (!num || num === "") continue;

    studentCount++;
    const sid = `s${String(studentCount).padStart(2, "0")}`;
    const name = row[1]?.trim() ?? "";
    numToSid.set(num, sid);

    // Carry-over (col 3)
    const co = parseInt(row[3]) || 0;
    if (co !== 0) {
      carryOver.push([sid, co]);
    }

    // Payment rounds (cols 4-16 = monthIndex 0-12)
    for (let mi = 0; mi < 13; mi++) {
      const val = row[4 + mi]?.trim();
      if (val && val !== "") {
        const cap = parseInt(val);
        if (!isNaN(cap) && cap > 0) {
          paymentRounds.push([sid, mi, cap]);
        }
      }
    }

    // Validation data (cols 18, 19, 20)
    validationMap.set(sid, {
      name,
      consumed: parseInt(row[18]) || 0,
      capacity: parseInt(row[19]) || 0,
      remaining: parseInt(row[20]) || 0,
    });
  }

  console.error(`  → ${studentCount} students, ${carryOver.length} carry-overs, ${paymentRounds.length} payment rounds\n`);

  // ── 2. 월별 시트 파싱 ──
  console.error("[2/3] 월별 출석 시트 파싱");
  const attendance: [string, string][] = [];
  const monthlyCountMap = new Map<string, Map<number, number>>(); // sid → { monthIndex → count }

  for (let mi = 0; mi < MONTH_SHEETS.length; mi++) {
    const { name, year, month } = MONTH_SHEETS[mi];
    if (mi > 0) await delay(200); // rate-limit
    const sheet = await fetchSheet(name);
    const dataRows = sheet.slice(4);
    const daysInMonth = new Date(year, month, 0).getDate();

    for (const row of dataRows) {
      const num = row[1]?.trim();
      if (!num || num === "") continue;
      const sid = numToSid.get(num);
      if (!sid) {
        console.error(`  ⚠ Unknown student #${num} in "${name}"`);
        continue;
      }

      let monthCount = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        const val = row[day + 3]?.trim().toUpperCase();
        if (val === "TRUE") {
          const mm = String(month).padStart(2, "0");
          const dd = String(day).padStart(2, "0");
          attendance.push([sid, `${year}-${mm}-${dd}`]);
          monthCount++;
        }
      }

      // Store monthly count for validation
      if (!monthlyCountMap.has(sid)) monthlyCountMap.set(sid, new Map());
      monthlyCountMap.get(sid)!.set(mi, monthCount);

      // Validate against sheet's own count (col 3)
      const expectedCount = parseInt(row[3]) || 0;
      if (monthCount !== expectedCount) {
        console.error(
          `  ⚠ ${sid} (${validationMap.get(sid)?.name}) "${name}": parsed ${monthCount} != sheet says ${expectedCount}`
        );
      }
    }
  }

  // Sort attendance by studentId then date
  attendance.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));

  console.error(`  → ${attendance.length} total attendance records\n`);

  // ── 3. 교차 검증 ──
  console.error("[3/3] 교차 검증");
  let errors = 0;

  for (const [sid, expected] of validationMap) {
    // Total capacity = carryOver + sum(payment rounds for this student)
    const co = carryOver.find((c) => c[0] === sid)?.[1] ?? 0;
    const roundSum = paymentRounds
      .filter((r) => r[0] === sid)
      .reduce((sum, r) => sum + r[2], 0);
    const actualCapacity = co + roundSum;

    // Total consumed = attendance count
    const actualConsumed = attendance.filter((a) => a[0] === sid).length;

    // Remaining
    const actualRemaining = actualCapacity - actualConsumed;

    if (actualCapacity !== expected.capacity) {
      console.error(
        `  ❌ ${sid} ${expected.name}: capacity ${actualCapacity} != expected ${expected.capacity}`
      );
      errors++;
    }
    if (actualConsumed !== expected.consumed) {
      console.error(
        `  ❌ ${sid} ${expected.name}: consumed ${actualConsumed} != expected ${expected.consumed}`
      );
      errors++;
    }
    if (actualRemaining !== expected.remaining) {
      console.error(
        `  ❌ ${sid} ${expected.name}: remaining ${actualRemaining} != expected ${expected.remaining}`
      );
      errors++;
    }
  }

  if (errors === 0) {
    console.error("  ✅ All validations passed!");
  } else {
    console.error(`  ⚠ ${errors} validation errors (data still generated)`);
  }

  // ── 4. TypeScript 출력 ──
  const lines: string[] = [];
  lines.push("// Auto-generated by scripts/import-sheets.ts — DO NOT EDIT");
  lines.push(`// Generated: ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`// Students: ${studentCount}, Attendance: ${attendance.length}`);
  lines.push("");

  // CARRY_OVER_RAW
  lines.push("export const CARRY_OVER_RAW: [string, number][] = [");
  for (const [sid, co] of carryOver) {
    lines.push(`  ["${sid}",${co}],`);
  }
  lines.push("];");
  lines.push("");

  // PAYMENT_ROUNDS_RAW — grouped by student for readability
  lines.push("export const PAYMENT_ROUNDS_RAW: [string, number, number][] = [");
  let prevSid = "";
  for (const [sid, mi, cap] of paymentRounds) {
    if (sid !== prevSid && prevSid !== "") lines.push(""); // blank line between students
    lines.push(`  ["${sid}",${mi},${cap}],`);
    prevSid = sid;
  }
  lines.push("];");
  lines.push("");

  // ATTENDANCE_RAW — grouped by student, multiple entries per line for compactness
  lines.push("export const ATTENDANCE_RAW: [string, string][] = [");
  let currentSid = "";
  let lineEntries: string[] = [];

  function flushLine() {
    if (lineEntries.length > 0) {
      lines.push("  " + lineEntries.join(""));
      lineEntries = [];
    }
  }

  for (const [sid, date] of attendance) {
    if (sid !== currentSid) {
      flushLine();
      if (currentSid !== "") lines.push(""); // blank line between students
      currentSid = sid;
    }
    lineEntries.push(`["${sid}","${date}"],`);
    if (lineEntries.length >= 6) flushLine(); // ~6 entries per line
  }
  flushLine();
  lines.push("];");
  lines.push("");

  const outPath = resolve(__dirname, "imported-data.ts");
  writeFileSync(outPath, lines.join("\n"), "utf-8");

  console.error(`\n✅ Output written to: ${outPath}`);
  console.error(
    `   ${carryOver.length} carry-overs, ${paymentRounds.length} payment rounds, ${attendance.length} attendance records`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
