import { CARRY_OVER_RAW, PAYMENT_ROUNDS_RAW, ATTENDANCE_RAW } from "../src/lib/sheets-data";

const SPREADSHEET_ID = "1f68PgFP5t4wZkrTg3cgB3HojNQKlHxKf8FlKSYwQFRc";

const NAMES: Record<string, string> = {
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
for (const sid of Object.keys(NAMES)) {
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
  let studentIdx = 0;
  for (const row of dataRows) {
    const num = row[0]?.trim();
    if (!num || num === "") continue;
    studentIdx++;
    const sid = `s${String(studentIdx).padStart(2, "0")}`;
    const name = row[1]?.trim() ?? "";
    const sheetRem = parseInt(row[20]) || 0;
    const seed = seedRem.get(sid) ?? 0;
    const ok = sheetRem === seed;
    if (!ok) {
      mismatch++;
      console.log(`${name.padEnd(6)}  | ${String(sheetRem).padStart(6)} | ${String(seed).padStart(6)} | ${seed - sheetRem > 0 ? "+" : ""}${seed - sheetRem}`);
    }
  }
  console.log("");
  console.log(`총 ${studentIdx}명, 불일치: ${mismatch}명`);
  if (mismatch === 0) console.log("✅ 구글시트와 시드 데이터 완전 일치!");
}

main().catch((e) => console.error(e));
