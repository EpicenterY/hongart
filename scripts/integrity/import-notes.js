#!/usr/bin/env node
/**
 * 종합출석부(summary.csv)의 메모 → Student.note 임포트
 *
 * summary.csv 구조:
 *   col 0: 번호, col 1: 이름, ..., col 21: 전화번호(부모), col 22: 전화번호(아이), col 23: 메모
 *
 * 사용법: node scripts/integrity/import-notes.js [--dry-run]
 */

const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const prisma = new PrismaClient();

  try {
    // 1. summary.csv 읽기
    const csvPath = path.join(__dirname, "summary.csv");
    const raw = fs.readFileSync(csvPath, "utf-8");
    const lines = raw.split("\n");

    // 2. 데이터 행 파싱 (번호가 있는 행만)
    const entries = [];
    for (const line of lines) {
      const cols = line.split(",");
      const num = parseInt(cols[0], 10);
      if (isNaN(num) || num <= 0) continue;

      const name = (cols[1] || "").trim();
      const note = (cols[23] || "").trim();
      if (!name || !note) continue;

      entries.push({ num, name, note });
    }

    console.log(`메모가 있는 학생: ${entries.length}명`);
    if (entries.length === 0) {
      console.log("임포트할 메모가 없습니다.");
      return;
    }

    // 3. DB에서 전체 학생 조회
    const students = await prisma.student.findMany({
      select: { id: true, name: true, note: true },
    });
    const nameMap = new Map();
    for (const s of students) {
      if (!nameMap.has(s.name)) nameMap.set(s.name, []);
      nameMap.get(s.name).push(s);
    }

    // 4. 매칭 및 업데이트
    let updated = 0;
    let skipped = 0;
    const results = [];

    for (const entry of entries) {
      const candidates = nameMap.get(entry.name);
      if (!candidates || candidates.length === 0) {
        results.push(`  ❌ #${entry.num} ${entry.name}: DB에 없음`);
        skipped++;
        continue;
      }

      // 동명이인: 첫 번째 매칭 (summary.csv는 시트 번호 순 = DB 임포트 순)
      // 동명이인은 sheets-data.ts 매핑에서 이미 구분됨 (이지아/이지아A 등)
      const target = candidates.length === 1 ? candidates[0] : candidates.shift();

      if (target.note === entry.note) {
        results.push(`  ⏭️ #${entry.num} ${entry.name}: 이미 동일 (${entry.note})`);
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        results.push(`  🔍 #${entry.num} ${entry.name}: "${entry.note}" (dry-run)`);
      } else {
        await prisma.student.update({
          where: { id: target.id },
          data: { note: entry.note },
        });
        results.push(`  ✅ #${entry.num} ${entry.name}: "${entry.note}"`);
      }
      updated++;
    }

    console.log(`\n결과 (${DRY_RUN ? "DRY RUN" : "실행"}):`);
    for (const r of results) console.log(r);
    console.log(`\n업데이트: ${updated}명, 스킵: ${skipped}명`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
