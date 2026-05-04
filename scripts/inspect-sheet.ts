const SPREADSHEET_ID = "1f68PgFP5t4wZkrTg3cgB3HojNQKlHxKf8FlKSYwQFRc";

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
  const res = await fetch(url);
  const text = await res.text();
  const rows = parseCSV(text);

  console.log("=== 헤더 구조 ===");
  for (let r = 0; r < 4; r++) {
    console.log(`Row ${r} (${rows[r].length} cols):`);
    rows[r].forEach((v, c) => { if (v.trim()) console.log(`  col[${c}] = "${v}"`); });
  }

  // 비활성 학생 예시 (#1 정하음)
  console.log("\n=== 비활성 학생: 정하음 (#1) ===");
  for (let r = 4; r < rows.length; r++) {
    if (rows[r][1]?.trim() === "정하음") {
      rows[r].forEach((v, c) => { if (v.trim()) console.log(`  col[${c}] = "${v}"`); });
      break;
    }
  }

  // 활성 학생 예시 (서동준)
  console.log("\n=== 활성 학생: 서동준 ===");
  for (let r = 4; r < rows.length; r++) {
    if (rows[r][1]?.trim() === "서동준") {
      rows[r].forEach((v, c) => { if (v.trim()) console.log(`  col[${c}] = "${v}"`); });
      break;
    }
  }

  // 필터 해제 확인: 총 학생 수
  let total = 0;
  for (let r = 4; r < rows.length; r++) {
    const num = rows[r][0]?.trim();
    if (num && num !== "") total++;
  }
  console.log(`\n총 학생 수: ${total}명`);
}

main().catch(console.error);
