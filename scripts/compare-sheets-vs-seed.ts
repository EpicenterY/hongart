import { CARRY_OVER_RAW, PAYMENT_ROUNDS_RAW, ATTENDANCE_RAW, STUDENT_META_RAW } from "../src/lib/sheets-data";

const SPREADSHEET_ID = "1f68PgFP5t4wZkrTg3cgB3HojNQKlHxKf8FlKSYwQFRc";

// Build sid→name map from STUDENT_META_RAW (no hardcoded NAMES)
const NAMES = new Map<string, string>();
for (const [sid, , name] of STUDENT_META_RAW) NAMES.set(sid, name);

// Build sheetNum→sid map for matching rows
const numToSid = new Map<string, string>();
for (const [sid, num] of STUDENT_META_RAW) numToSid.set(num, sid);

// Compute seed remaining
const coMap = new Map<string, number>();
for (const [id, val] of CARRY_OVER_RAW) coMap.set(id, val);
const roundsCap = new Map<string, number[]>();
for (const [id, , cap] of PAYMENT_ROUNDS_RAW) {
  if (!roundsCap.has(id)) roundsCap.set(id, []);
  roundsCap.get(id)!.push(cap);
}
const attCnt = new Map<string, number>();
for (const [id] of ATTENDANCE_RAW) attCnt.set(id, (attCnt.get(id) ?? 0) + 1);

const seedRem = new Map<string, number>();
for (const [sid] of STUDENT_META_RAW) {
  const co = coMap.get(sid) ?? 0;
  const caps = roundsCap.get(sid) ?? [];
  let total = co > 0 ? co : 0;
  const debt = co < 0 ? Math.abs(co) : 0;
  caps.forEach((c, i) => { total += i === 0 && debt > 0 ? c - debt : c; });
  const att = attCnt.get(sid) ?? 0;
  seedRem.set(sid, total - att);
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const len = text.length;
  let i = 0;
  while (i < len) {
    const row: string[] = [];
    while (i < len && text[i] !== "\n" && text[i] !== "\r") {
      if (text[i] === '"') {
        i++;
        let field = "";
        while (i < len) {
          if (text[i] === '"') {
            if (i + 1 < len && text[i + 1] === '"') { field += '"'; i += 2; }
            else { i++; break; }
          } else { field += text[i++]; }
        }
        row.push(field);
        if (i < len && text[i] === ",") i++;
      } else {
        let field = "";
        while (i < len && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") field += text[i++];
        row.push(field);
        if (i < len && text[i] === ",") i++;
      }
    }
    if (i < len && text[i] === "\r") i++;
    if (i < len && text[i] === "\n") i++;
    if (row.length > 0) rows.push(row);
  }
  return rows;
}

async function main() {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("종합출석부")}`;
  console.log("Fetching Google Sheets...");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const rows = parseCSV(text);
  const dataRows = rows.slice(4);

  console.log("\n이름      | 시트잔여 | 시드잔여 | 차이");
  console.log("----------|---------|---------|------");

  let mismatch = 0;
  let studentCount = 0;
  for (const row of dataRows) {
    const num = row[0]?.trim();
    if (!num || num === "") continue;

    const name = row[1]?.trim() ?? "";
    if (!name) continue; // skip rows with no name

    studentCount++;
    const sid = numToSid.get(num);
    if (!sid) { console.log(`⚠ Unknown sheet #${num}`); mismatch++; continue; }

    const sheetRem = parseInt(row[20]) || 0;
    const seed = seedRem.get(sid) ?? 0;
    const ok = sheetRem === seed;
    if (!ok) {
      mismatch++;
      console.log(`${name.padEnd(8)} | ${String(sheetRem).padStart(6)} | ${String(seed).padStart(6)} | ${seed - sheetRem > 0 ? "+" : ""}${seed - sheetRem}`);
    }
  }
  console.log("");
  console.log(`총 ${studentCount}명, 불일치: ${mismatch}명`);
  if (mismatch === 0) console.log("✅ 구글시트와 시드 데이터 완전 일치!");
}

main().catch((e) => console.error(e));
