const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const p = new PrismaClient();

const DUPE_NAMES = ["김민지", "김서진", "김주아", "박주원", "이로이", "이윤설"];

function parseCSV(content) {
  const rows = [];
  let current = "";
  let inQuotes = false;
  const fields = [];
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"' && content[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { fields.push(current); current = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && content[i + 1] === "\n") i++;
        fields.push(current); current = "";
        rows.push([...fields]); fields.length = 0;
      } else current += ch;
    }
  }
  if (current || fields.length > 0) { fields.push(current); rows.push(fields); }
  return rows;
}

function getAttendanceDates(csvFile) {
  const content = fs.readFileSync(csvFile, "utf-8");
  const rows = parseCSV(content);
  const basename = path.basename(csvFile, ".csv");
  const [yearStr, monthStr] = basename.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthRow = rows[2];

  const dateColumns = [];
  for (let col = 4; col < monthRow.length; col++) {
    const dayNum = parseInt(monthRow[col]);
    if (isNaN(dayNum)) continue;
    if (dateColumns.length < daysInMonth && dayNum === dateColumns.length + 1) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      dateColumns.push({ col, date: dateStr });
    }
  }

  const result = {};
  for (let r = 5; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < 5) continue;
    const num = parseInt(row[1]);
    const name = (row[2] || "").trim();
    if (isNaN(num) || !name) continue;
    if (!DUPE_NAMES.includes(name)) continue;

    const dates = [];
    for (const { col, date } of dateColumns) {
      if (row[col] && row[col].toUpperCase() === "TRUE") dates.push(date);
    }
    if (!result[name]) result[name] = [];
    result[name].push({ num, dates });
  }
  return result;
}

(async () => {
  // 1. 스프레드시트에서 동명이인 출석 날짜 수집
  const csvDir = __dirname;
  const csvFiles = fs.readdirSync(csvDir).filter(f => f.endsWith(".csv")).sort();

  const sheetData = {}; // name -> { num -> Set<date> }
  for (const file of csvFiles) {
    const monthData = getAttendanceDates(path.join(csvDir, file));
    for (const [name, entries] of Object.entries(monthData)) {
      if (!sheetData[name]) sheetData[name] = {};
      for (const entry of entries) {
        if (!sheetData[name][entry.num]) sheetData[name][entry.num] = new Set();
        for (const d of entry.dates) sheetData[name][entry.num].add(d);
      }
    }
  }

  // 2. DB에서 동명이인 출석 날짜 조회
  const dbStudents = await p.student.findMany({
    where: { name: { in: DUPE_NAMES } },
    include: {
      attendances: {
        where: { status: { in: ["PRESENT", "LATE"] } },
        orderBy: { date: "asc" },
        select: { date: true }
      },
      paymentSessions: { select: { id: true, createdAt: true, capacity: true } }
    }
  });

  // 3. 매칭
  console.log("══════════════════════════════════════════════════");
  console.log("  동명이인 매핑 (스프레드시트 번호 ↔ DB ID)");
  console.log("══════════════════════════════════════════════════\n");

  for (const name of DUPE_NAMES) {
    console.log(`\n📌 ${name}`);
    console.log("─".repeat(50));

    const sheetEntries = sheetData[name] || {};
    const dbEntries = dbStudents.filter(s => s.name === name);

    // 시트 정보 출력
    console.log("  [스프레드시트]");
    for (const [num, dates] of Object.entries(sheetEntries)) {
      const sortedDates = [...dates].sort();
      console.log(`    번호 ${num}: 출석 ${dates.size}건`);
      if (dates.size > 0 && dates.size <= 5) {
        console.log(`      날짜: ${sortedDates.join(", ")}`);
      } else if (dates.size > 5) {
        console.log(`      첫 5건: ${sortedDates.slice(0, 5).join(", ")} ...`);
      }
    }

    // DB 정보 출력
    console.log("  [DB]");
    for (const s of dbEntries) {
      const dbDates = s.attendances.map(a => a.date.toISOString().split("T")[0]);
      console.log(`    id=${s.id.slice(0, 8)}... status=${s.status} 출석=${dbDates.length}건 결제=${s.paymentSessions.length}건`);
      if (dbDates.length > 0 && dbDates.length <= 5) {
        console.log(`      날짜: ${dbDates.join(", ")}`);
      } else if (dbDates.length > 5) {
        console.log(`      첫 5건: ${dbDates.slice(0, 5).join(", ")} ...`);
      }
    }

    // 자동 매칭 시도: 출석 날짜 겹침 비교
    console.log("  [매칭 결과]");
    for (const s of dbEntries) {
      const dbDates = new Set(s.attendances.map(a => a.date.toISOString().split("T")[0]));
      let bestMatch = null;
      let bestOverlap = 0;

      for (const [num, sheetDates] of Object.entries(sheetEntries)) {
        let overlap = 0;
        for (const d of sheetDates) {
          if (dbDates.has(d)) overlap++;
        }
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestMatch = num;
        }
      }

      if (bestMatch && bestOverlap > 0) {
        const sheetDates = sheetEntries[bestMatch];
        const confidence = dbDates.size > 0 ? ((bestOverlap / dbDates.size) * 100).toFixed(0) : 0;
        console.log(`    ✅ DB ${s.id.slice(0, 8)}... → 시트 번호 ${bestMatch} (겹침: ${bestOverlap}건, 신뢰도: ${confidence}%)`);
      } else if (dbDates.size === 0) {
        console.log(`    ⚠️  DB ${s.id.slice(0, 8)}... → 출석 0건, 매칭 불가`);
      } else {
        console.log(`    ❌ DB ${s.id.slice(0, 8)}... → 매칭 실패 (겹치는 날짜 없음)`);
      }
    }
  }

  await p.$disconnect();
})();
