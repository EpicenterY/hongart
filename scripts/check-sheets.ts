const SPREADSHEET_ID = "1f68PgFP5t4wZkrTg3cgB3HojNQKlHxKf8FlKSYwQFRc";
const SHEETS = ["4월","5월","6월","7월","8월","9월","10월","11월","12월","1월","2월","3월","4월(2026)"];

async function checkSheet(name: string) {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  const text = await res.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  let count = 0;
  for (const line of lines.slice(4)) {
    const num = line.split(",")[1]?.replace(/"/g, "").trim();
    if (num && num !== "") count++;
  }
  return { total: lines.length, students: count };
}

async function main() {
  console.log("시트명        | 총행 | 학생수");
  console.log("-------------|------|-------");
  for (const name of SHEETS) {
    const r = await checkSheet(name);
    console.log(`${name.padEnd(12)} | ${String(r.total).padStart(4)} | ${String(r.students).padStart(5)}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

main().catch(console.error);
