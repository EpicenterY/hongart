const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const students = await p.student.findMany({
    orderBy: { name: "asc" },
    include: {
      attendances: {
        where: { status: { in: ["PRESENT", "LATE"] } },
        select: { date: true }
      },
      paymentSessions: { select: { id: true } }
    }
  });

  const nameMap = {};
  for (const s of students) {
    if (!nameMap[s.name]) nameMap[s.name] = [];
    nameMap[s.name].push({
      id: s.id.slice(0, 8),
      status: s.status,
      grade: s.grade || "-",
      school: s.school || "-",
      attCount: s.attendances.length,
      payCount: s.paymentSessions.length
    });
  }

  const dupes = Object.entries(nameMap).filter(([, v]) => v.length > 1);
  console.log("DB 동명이인:", dupes.length, "쌍\n");

  for (const [name, arr] of dupes) {
    console.log(name + " (" + arr.length + "명):");
    for (let i = 0; i < arr.length; i++) {
      const s = arr[i];
      console.log(
        "  #" + (i + 1),
        "id=" + s.id + "...",
        "status=" + s.status,
        "grade=" + s.grade,
        "school=" + s.school,
        "출석=" + s.attCount + "건",
        "결제=" + s.payCount + "건"
      );
    }
    console.log();
  }

  await p.$disconnect();
})();
