import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SHEET: Record<string, number> = {
  "서동준":-6,"이윤서":-1,"정윤영":1,"최하연":6,"나윤서":4,"김리하":-6,
  "하라윤":2,"임정윤":6,"김지유":2,"최혜원":0,"류지아":5,"문하윤":4,
  "최은수":3,"정예린":-3,"고해서":-6,"길민준":0,"강지윤":-1,"이태율":-2,
  "조현래":2,"송서율":-4,"이수현":0,"최은우":3,"강하준":0,"김주아":1,
  "전수호":3,"이나윤":-1,"정원":0,"홍채이":1,"인하엘":0,"임건우":-1,
  "이하율":3,"김지안":-1,"현채은":8,"송서연":-1,"황찬":1,"정다민":-2,
  "임지안":-1,"이루미":0,"조혜준":0,"김민겸":0,"이로이":-4,"박서은":3,
  "정하윤":3,"김건우":3,"최은호":3,"장승우":3,"안제하":-1,"정예나":-1,
  "하예윤":3,"이혜성":-2,"김서진":0,"유이도":2,"유이르":2,"펜더아린":3,
};

async function main() {
  const students = await prisma.student.findMany({
    orderBy: { name: "asc" },
    include: {
      paymentSessions: { orderBy: { createdAt: "asc" } },
      attendances: true,
    },
  });

  const lines: string[] = [];
  let matchCount = 0;
  let mismatchCount = 0;
  const mismatches: string[] = [];

  for (const s of students) {
    const cap = s.paymentSessions.reduce((sum, ps) => sum + ps.capacity, 0);
    const consuming = s.attendances.filter(a => a.status !== "ABSENT").length;
    const dbRemaining = cap - consuming;
    const sheetRemaining = SHEET[s.name];
    if (sheetRemaining === undefined) continue;

    const match = dbRemaining === sheetRemaining;
    if (match) matchCount++; else mismatchCount++;

    const status = match ? "OK" : "MISMATCH";
    lines.push(`${s.name}\t시트=${sheetRemaining}\tDB=${dbRemaining}\tcap=${cap}\t소모=${consuming}\t출석=${s.attendances.length}\t${status}`);
    if (!match) {
      mismatches.push(`${s.name}: 시트=${sheetRemaining}, DB=${dbRemaining}, diff=${dbRemaining - sheetRemaining} (cap=${cap}, 소모=${consuming})`);
    }
  }

  for (const l of lines) console.log(l);
  console.log(`\n=== 일치: ${matchCount}명, 불일치: ${mismatchCount}명 ===`);
  if (mismatches.length > 0) {
    console.log("\n불일치 상세:");
    for (const m of mismatches) console.log("  " + m);
  }

  await prisma.$disconnect();
}
main();
