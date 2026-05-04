/**
 * 데이터 정합성 검증 스크립트
 * Google Sheets CSV (진실의 원천) vs Supabase DB 비교
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// ─── CSV 파싱 ───────────────────────────────────────────

interface SheetRow {
  studentNumber: number;
  studentName: string;
  attendanceCount: number;
  attendanceDates: string[]; // YYYY-MM-DD
}

function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  const fields: string[] = [];

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"' && content[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && content[i + 1] === "\n") i++;
        fields.push(current);
        current = "";
        rows.push([...fields]);
        fields.length = 0;
      } else {
        current += ch;
      }
    }
  }
  if (current || fields.length > 0) {
    fields.push(current);
    rows.push(fields);
  }
  return rows;
}

function parseMonthlyCSV(filePath: string): SheetRow[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);

  // 파일명에서 년월 추출 (2025-04.csv → 2025, 4)
  const basename = path.basename(filePath, ".csv");
  const [yearStr, monthStr] = basename.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);

  // Row 2 (index 2): month row with actual day numbers
  const monthRow = rows[2];
  // Row 0 (index 0): year header with day numbers
  // const headerRow = rows[0];

  // 해당 월의 마지막 날
  const daysInMonth = new Date(year, month, 0).getDate();

  // Col 4부터 날짜 시작, row 2에서 실제 날짜 번호 추출
  const dateColumns: { col: number; date: string }[] = [];
  for (let col = 4; col < monthRow.length; col++) {
    const dayNum = parseInt(monthRow[col]);
    if (isNaN(dayNum)) continue;

    // 현재 월의 날짜만 포함 (overflow 무시)
    if (dateColumns.length < daysInMonth && dayNum === dateColumns.length + 1) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      dateColumns.push({ col, date: dateStr });
    }
  }

  // Row 5부터 학생 데이터
  const students: SheetRow[] = [];
  for (let r = 5; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < 5) continue;

    const studentNumber = parseInt(row[1]);
    const studentName = (row[2] || "").trim();
    if (isNaN(studentNumber) || !studentName) continue;

    const attendanceCount = parseInt(row[3]) || 0;
    const attendanceDates: string[] = [];

    for (const { col, date } of dateColumns) {
      if (row[col]?.toUpperCase() === "TRUE") {
        attendanceDates.push(date);
      }
    }

    students.push({
      studentNumber,
      studentName,
      attendanceCount,
      attendanceDates,
    });
  }

  return students;
}

// ─── DB 조회 ────────────────────────────────────────────

async function getDBData() {
  const students = await prisma.student.findMany({
    orderBy: { name: "asc" },
    include: {
      attendances: {
        orderBy: { date: "asc" },
      },
      paymentSessions: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return students;
}

// ─── 비교 로직 ──────────────────────────────────────────

interface Discrepancy {
  type: "STUDENT_MISSING_IN_DB" | "STUDENT_MISSING_IN_SHEET" |
        "ATTENDANCE_IN_SHEET_NOT_DB" | "ATTENDANCE_IN_DB_NOT_SHEET" |
        "COUNT_MISMATCH";
  studentName: string;
  month?: string;
  detail: string;
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  홍아트 데이터 정합성 검증");
  console.log("  Google Sheets (진실의 원천) vs Supabase DB");
  console.log("═══════════════════════════════════════════════════════════\n");

  // 1. CSV 파일 로드
  const csvDir = path.join(__dirname);
  const csvFiles = fs.readdirSync(csvDir)
    .filter(f => f.endsWith(".csv"))
    .sort();

  console.log(`📁 CSV 파일 ${csvFiles.length}개 발견: ${csvFiles.join(", ")}\n`);

  // 모든 월별 데이터 통합
  const allSheetStudents = new Map<string, {
    name: string;
    number: number;
    attendance: Map<string, string[]>; // month -> dates
    totalAttendance: number;
  }>();

  for (const file of csvFiles) {
    const monthKey = path.basename(file, ".csv"); // e.g., "2025-04"
    const rows = parseMonthlyCSV(path.join(csvDir, file));

    for (const row of rows) {
      if (!allSheetStudents.has(row.studentName)) {
        allSheetStudents.set(row.studentName, {
          name: row.studentName,
          number: row.studentNumber,
          attendance: new Map(),
          totalAttendance: 0,
        });
      }
      const student = allSheetStudents.get(row.studentName)!;
      student.attendance.set(monthKey, row.attendanceDates);
      student.totalAttendance += row.attendanceDates.length;
    }
  }

  // 출석 기록이 있는 학생만 필터
  const activeSheetStudents = new Map<string, typeof allSheetStudents extends Map<string, infer V> ? V : never>();
  for (const [name, data] of allSheetStudents) {
    if (data.totalAttendance > 0) {
      activeSheetStudents.set(name, data);
    }
  }

  console.log(`📊 스프레드시트: 전체 ${allSheetStudents.size}명, 출석 기록 있는 학생 ${activeSheetStudents.size}명\n`);

  // 2. DB 데이터 로드
  const dbStudents = await getDBData();
  const dbStudentMap = new Map(dbStudents.map(s => [s.name, s]));
  console.log(`🗄️  DB: 전체 ${dbStudents.length}명\n`);

  const discrepancies: Discrepancy[] = [];

  // ─── 3. 학생 목록 비교 ─────────────────────────────────
  console.log("── 학생 목록 비교 ──────────────────────────────────────\n");

  // 스프레드시트에는 있지만 DB에 없는 학생
  for (const [name, data] of activeSheetStudents) {
    if (!dbStudentMap.has(name)) {
      discrepancies.push({
        type: "STUDENT_MISSING_IN_DB",
        studentName: name,
        detail: `스프레드시트 번호 ${data.number}, 총 출석 ${data.totalAttendance}회`,
      });
    }
  }

  // DB에는 있지만 스프레드시트에 출석 기록이 없는 학생
  for (const [name] of dbStudentMap) {
    if (!activeSheetStudents.has(name)) {
      const inSheet = allSheetStudents.has(name);
      discrepancies.push({
        type: "STUDENT_MISSING_IN_SHEET",
        studentName: name,
        detail: inSheet
          ? "스프레드시트에 이름은 있으나 출석 기록 0건"
          : "스프레드시트에 이름 자체가 없음",
      });
    }
  }

  const studentIssues = discrepancies.filter(d =>
    d.type === "STUDENT_MISSING_IN_DB" || d.type === "STUDENT_MISSING_IN_SHEET"
  );

  if (studentIssues.length === 0) {
    console.log("  ✅ 학생 목록 일치\n");
  } else {
    for (const d of studentIssues) {
      const icon = d.type === "STUDENT_MISSING_IN_DB" ? "❌ DB 누락" : "⚠️  시트 누락";
      console.log(`  ${icon}: ${d.studentName} — ${d.detail}`);
    }
    console.log();
  }

  // ─── 4. 출석 기록 비교 ─────────────────────────────────
  console.log("── 출석 기록 비교 ──────────────────────────────────────\n");

  let totalSheetAttendance = 0;
  let totalDbAttendance = 0;
  let matchCount = 0;
  let sheetOnlyCount = 0;
  let dbOnlyCount = 0;

  for (const [name, sheetData] of activeSheetStudents) {
    const dbStudent = dbStudentMap.get(name);
    if (!dbStudent) continue;

    // DB 출석을 날짜별 Set으로 변환 (PRESENT, LATE만 — ABSENT은 출석 아님)
    const dbAttendanceDates = new Set<string>();
    for (const att of dbStudent.attendances) {
      if (att.status === "PRESENT" || att.status === "LATE") {
        const dateStr = new Date(att.date).toISOString().split("T")[0];
        dbAttendanceDates.add(dateStr);
      }
    }

    // 스프레드시트 출석 날짜 전체
    const sheetAttendanceDates = new Set<string>();
    for (const [, dates] of sheetData.attendance) {
      for (const d of dates) {
        sheetAttendanceDates.add(d);
      }
    }

    totalSheetAttendance += sheetAttendanceDates.size;
    totalDbAttendance += dbAttendanceDates.size;

    // 시트에만 있는 출석
    for (const date of sheetAttendanceDates) {
      if (dbAttendanceDates.has(date)) {
        matchCount++;
      } else {
        sheetOnlyCount++;
        discrepancies.push({
          type: "ATTENDANCE_IN_SHEET_NOT_DB",
          studentName: name,
          month: date.substring(0, 7),
          detail: `${date} — 스프레드시트에 출석 체크, DB에 없음`,
        });
      }
    }

    // DB에만 있는 출석
    for (const date of dbAttendanceDates) {
      if (!sheetAttendanceDates.has(date)) {
        dbOnlyCount++;
        discrepancies.push({
          type: "ATTENDANCE_IN_DB_NOT_SHEET",
          studentName: name,
          month: date.substring(0, 7),
          detail: `${date} — DB에 출석 기록, 스프레드시트에 없음`,
        });
      }
    }
  }

  console.log(`  스프레드시트 총 출석: ${totalSheetAttendance}건`);
  console.log(`  DB 총 출석 (PRESENT+LATE): ${totalDbAttendance}건`);
  console.log(`  ✅ 일치: ${matchCount}건`);
  console.log(`  ❌ 시트에만 있음: ${sheetOnlyCount}건`);
  console.log(`  ⚠️  DB에만 있음: ${dbOnlyCount}건`);
  console.log();

  // ─── 5. 상세 불일치 리포트 ─────────────────────────────
  const attendanceIssues = discrepancies.filter(d =>
    d.type === "ATTENDANCE_IN_SHEET_NOT_DB" || d.type === "ATTENDANCE_IN_DB_NOT_SHEET"
  );

  if (attendanceIssues.length > 0) {
    console.log("── 상세 불일치 목록 ────────────────────────────────────\n");

    // 학생별로 그룹핑
    const byStudent = new Map<string, Discrepancy[]>();
    for (const d of attendanceIssues) {
      if (!byStudent.has(d.studentName)) byStudent.set(d.studentName, []);
      byStudent.get(d.studentName)!.push(d);
    }

    for (const [name, issues] of byStudent) {
      console.log(`  📌 ${name} (${issues.length}건 불일치):`);
      for (const issue of issues.slice(0, 10)) {
        const icon = issue.type === "ATTENDANCE_IN_SHEET_NOT_DB" ? "  ➡️  시트→DB 누락" : "  ⬅️  DB→시트 누락";
        console.log(`    ${icon}: ${issue.detail}`);
      }
      if (issues.length > 10) {
        console.log(`    ... 외 ${issues.length - 10}건`);
      }
      console.log();
    }
  }

  // ─── 6. 요약 ──────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  요약");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  학생 문제: ${studentIssues.length}건`);
  console.log(`  출석 불일치: ${attendanceIssues.length}건`);
  console.log(`  정합성: ${matchCount}/${totalSheetAttendance} (${((matchCount / totalSheetAttendance) * 100).toFixed(1)}%)`);
  console.log("═══════════════════════════════════════════════════════════\n");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
