// Payment verification script - read-only, no file modifications
const http = require('http');

const CARRY_OVER_RAW = [
  ["s01",-3],["s02",-2],["s04",6],["s07",3],["s08",3],["s09",4],["s10",2],
  ["s11",-2],["s12",-4],["s13",2],["s14",5],["s15",1],["s16",-6],["s17",6],
  ["s18",5],["s19",-2],["s20",-4],["s22",1],["s25",1],["s26",1],["s27",1],
  ["s31",12],["s32",4],["s33",8],["s34",4],["s35",4],["s36",8],["s37",4],
  ["s38",4],["s39",8],["s40",4],["s41",4],["s42",4],["s43",4],["s44",4],
  ["s45",4],["s46",4],["s47",4],["s48",4],["s49",4],["s50",8],["s51",4],
  ["s52",8],["s53",8],["s54",4]
];

const PAYMENT_ROUNDS_RAW = [
  ["s01",0,4],["s01",1,4],["s01",2,4],["s01",3,4],["s01",4,4],["s01",5,4],["s01",6,4],["s01",7,4],["s01",8,4],["s01",9,4],["s01",10,3],
  ["s02",0,4],["s02",1,4],["s02",2,4],["s02",3,4],["s02",4,4],["s02",5,4],["s02",6,4],["s02",7,4],["s02",8,4],["s02",9,4],["s02",10,4],["s02",11,4],
  ["s03",0,4],["s03",1,4],["s03",2,4],["s03",3,4],["s03",4,4],["s03",5,4],["s03",6,4],["s03",7,4],["s03",8,4],["s03",9,4],["s03",10,4],["s03",11,4],
  ["s04",0,7],["s04",1,8],["s04",2,7],["s04",3,8],["s04",4,8],["s04",5,8],["s04",6,8],["s04",7,8],["s04",8,7],["s04",9,8],["s04",10,8],["s04",11,8],
  ["s05",0,8],["s05",1,8],["s05",2,8],["s05",3,8],["s05",4,8],["s05",5,8],["s05",6,8],["s05",7,8],["s05",8,8],["s05",9,8],["s05",10,8],["s05",11,8],
  ["s06",0,8],["s06",1,8],["s06",2,8],["s06",3,8],["s06",4,8],["s06",5,8],["s06",6,8],["s06",7,8],["s06",8,8],["s06",9,8],["s06",10,8],
  ["s07",0,4],["s07",1,4],["s07",2,4],["s07",3,4],["s07",4,4],["s07",5,4],["s07",6,4],["s07",7,4],["s07",8,4],["s07",9,4],["s07",10,4],["s07",11,4],
  ["s08",0,8],["s08",1,8],["s08",2,8],["s08",3,8],["s08",4,8],["s08",5,8],["s08",6,8],["s08",7,8],["s08",8,8],["s08",9,8],["s08",10,8],["s08",11,12],
  ["s09",0,8],["s09",1,8],["s09",2,8],["s09",3,8],["s09",4,8],["s09",5,8],["s09",6,8],["s09",7,8],["s09",8,8],["s09",9,8],["s09",10,8],
  ["s10",0,8],["s10",1,8],["s10",2,8],["s10",3,8],["s10",4,8],["s10",5,8],["s10",6,8],["s10",7,8],["s10",8,8],["s10",9,8],["s10",10,8],
  ["s11",0,8],["s11",1,8],["s11",2,8],["s11",3,8],["s11",4,8],["s11",5,8],["s11",6,8],["s11",7,8],["s11",8,8],["s11",9,8],["s11",10,8],["s11",11,8],["s11",12,8],
  ["s12",0,8],["s12",1,8],["s12",2,8],["s12",3,8],["s12",4,8],["s12",5,8],["s12",6,8],["s12",7,8],["s12",8,8],["s12",9,8],["s12",10,8],["s12",11,8],["s12",12,8],
  ["s13",0,5],["s13",1,4],["s13",2,5],["s13",3,4],["s13",4,4],["s13",5,4],["s13",6,4],["s13",7,4],["s13",8,5],["s13",9,4],["s13",10,4],["s13",11,4],
  ["s14",0,8],["s14",1,8],["s14",2,8],["s14",3,8],["s14",4,8],["s14",5,8],["s14",6,8],["s14",7,8],["s14",8,8],["s14",9,8],["s14",10,8],
  ["s15",0,8],["s15",1,8],["s15",2,8],["s15",3,8],["s15",4,8],["s15",5,8],["s15",6,8],["s15",7,8],["s15",8,8],["s15",9,8],["s15",10,8],
  ["s16",0,8],["s16",1,8],["s16",2,8],["s16",3,8],["s16",4,8],["s16",5,8],["s16",6,8],["s16",7,8],["s16",8,6],["s16",9,4],["s16",10,4],["s16",11,4],["s16",12,4],
  ["s17",0,8],["s17",1,8],["s17",2,8],["s17",3,8],["s17",4,8],["s17",5,8],["s17",6,8],["s17",7,8],["s17",8,8],["s17",9,8],["s17",10,8],
  ["s18",0,8],["s18",1,8],["s18",2,8],["s18",3,8],["s18",4,8],["s18",5,8],["s18",6,8],["s18",7,8],["s18",8,8],["s18",9,8],["s18",10,8],
  ["s19",0,4],["s19",1,4],["s19",2,4],["s19",3,4],["s19",4,4],["s19",5,4],["s19",6,4],["s19",7,4],["s19",8,4],["s19",9,4],["s19",10,4],["s19",11,4],["s19",12,4],
  ["s20",0,8],["s20",1,8],["s20",2,8],["s20",3,8],["s20",4,8],["s20",5,8],["s20",6,8],["s20",7,8],["s20",8,8],["s20",9,8],["s20",10,8],["s20",11,8],
  ["s21",0,4],["s21",1,5],["s21",2,4],["s21",3,4],["s21",4,4],["s21",5,4],["s21",6,4],["s21",7,4],["s21",8,4],["s21",9,4],["s21",10,4],
  ["s22",0,4],["s22",1,4],["s22",2,4],["s22",3,4],["s22",4,4],["s22",5,4],["s22",6,4],["s22",7,4],["s22",8,4],["s22",9,4],["s22",10,4],["s22",11,4],["s22",12,4],
  ["s23",0,4],["s23",1,4],["s23",2,4],["s23",3,4],["s23",4,4],["s23",5,4],["s23",6,4],["s23",7,4],["s23",8,4],["s23",9,4],["s23",10,4],
  ["s24",0,4],["s24",1,4],["s24",2,4],["s24",3,4],["s24",4,4],["s24",5,4],["s24",6,4],["s24",7,4],["s24",8,4],["s24",9,4],["s24",10,4],["s24",11,4],
  ["s25",0,4],["s25",1,4],["s25",2,4],["s25",3,4],["s25",4,4],["s25",5,8],["s25",6,4],["s25",7,4],
  ["s26",0,4],["s26",1,4],["s26",2,4],["s26",3,4],["s26",4,4],["s26",5,4],["s26",6,4],["s26",7,4],["s26",8,4],["s26",9,4],["s26",10,4],
  ["s27",0,4],["s27",1,4],["s27",2,4],["s27",3,4],["s27",4,4],["s27",5,4],["s27",6,4],["s27",7,4],["s27",8,4],["s27",9,4],["s27",10,4],["s27",11,4],
  ["s28",0,4],["s28",1,4],["s28",2,4],["s28",3,4],["s28",4,4],["s28",5,4],["s28",6,4],["s28",7,4],["s28",8,4],["s28",9,4],["s28",10,4],["s28",11,4],
  ["s29",0,4],["s29",1,4],["s29",2,4],["s29",3,4],["s29",4,4],["s29",5,4],["s29",6,4],["s29",7,4],["s29",8,4],["s29",9,4],["s29",10,4],["s29",11,4],
  ["s30",0,4],["s30",1,4],["s30",2,4],["s30",3,4],["s30",4,4],["s30",5,4],["s30",6,4],["s30",7,4],["s30",8,4],["s30",9,4],["s30",10,4],
  ["s31",0,12],["s31",1,12],["s31",2,12],["s31",3,12],["s31",4,12],["s31",5,12],["s31",6,12],["s31",7,12],["s31",8,12],["s31",9,12],["s31",10,12],
  ["s32",0,4],["s32",1,4],["s32",2,4],["s32",3,4],["s32",4,4],["s32",5,4],["s32",6,4],["s32",7,4],["s32",8,4],["s32",9,4],["s32",10,4],
  ["s33",0,9],["s33",1,8],["s33",2,8],["s33",3,8],["s33",4,8],["s33",5,8],["s33",6,8],["s33",7,8],["s33",8,8],
  ["s34",0,4],["s34",1,4],["s34",2,4],["s34",3,4],["s34",4,4],["s34",5,4],["s34",6,4],["s34",7,4],
  ["s35",0,4],["s35",1,8],["s35",2,8],["s35",3,8],["s35",4,8],["s35",5,8],["s35",6,8],["s35",7,8],
  ["s36",0,8],["s36",1,8],["s36",2,8],["s36",3,8],["s36",4,8],["s36",5,8],["s36",6,4],
  ["s37",0,4],["s37",1,4],["s37",2,4],["s37",3,4],["s37",4,4],
  ["s38",0,4],["s38",1,4],["s38",2,4],["s38",3,4],["s38",4,4],["s38",5,4],
  ["s39",0,8],["s39",1,8],["s39",2,8],["s39",3,4],
  ["s40",0,4],["s40",1,4],["s40",2,4],
  ["s41",0,8],["s41",1,4],["s41",2,4],
  ["s42",0,4],
  ["s43",0,4],
  ["s44",0,4],
  ["s45",0,4],
  ["s46",0,4],
  ["s49",0,4],
  ["s54",0,4],
];

// All student IDs from STUDENT_RAW
const ALL_STUDENTS = [
  "s01","s02","s03","s04","s05","s06","s07","s08","s09","s10",
  "s11","s12","s13","s14","s15","s16","s17","s18","s19","s20",
  "s21","s22","s23","s24","s25","s26","s27","s28","s29","s30",
  "s31","s32","s33","s34","s35","s36","s37","s38","s39","s40",
  "s41","s42","s43","s44","s45","s46","s47","s48","s49","s50",
  "s51","s52","s53","s54"
];

const feeMap = {1:100000, 2:140000, 3:170000};
const coMap = new Map(CARRY_OVER_RAW);
const roundsMap = new Map();
for (const [sid, mi, cap] of PAYMENT_ROUNDS_RAW) {
  if (!roundsMap.has(sid)) roundsMap.set(sid, []);
  roundsMap.get(sid).push([mi, cap]);
}

function computeExpected(id) {
  const co = coMap.get(id) || 0;
  const rounds = roundsMap.get(id) || [];
  const debt = co < 0 ? Math.abs(co) : 0;

  const sessions = [];

  if (co > 0) {
    sessions.push({ id: "ps-"+id+"-co", capacity: co, type: "carry-over" });
  }

  for (let ri = 0; ri < rounds.length; ri++) {
    const [mi, cap] = rounds[ri];
    const adjustedCap = ri === 0 && debt > 0 ? cap - debt : cap;
    const dpwForRound = cap <= 5 ? 1 : cap <= 9 ? 2 : 3;
    sessions.push({
      id: "ps-"+id+"-m"+mi,
      capacity: adjustedCap,
      dpw: dpwForRound,
      amount: feeMap[dpwForRound],
      type: ri === 0 && debt > 0 ? "debt-deducted" : "normal",
    });
  }

  return {
    sessionCount: sessions.length,
    sessions: sessions,
    totalCapacity: sessions.reduce((s, x) => s + x.capacity, 0),
    carryOver: co,
    debt: debt,
  };
}

function fetchStudent(id) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/students/' + id,
      headers: { 'Cookie': 'hongart-session=authenticated' }
    };
    http.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Parse error for ' + id + ': ' + data.slice(0, 200))); }
      });
    }).on('error', reject);
  });
}

async function verify() {
  const discrepancies = [];
  let okCount = 0;

  for (const id of ALL_STUDENTS) {
    const expected = computeExpected(id);
    let actual;
    try {
      actual = await fetchStudent(id);
    } catch(e) {
      discrepancies.push({ id, error: e.message });
      continue;
    }

    const actualSessions = actual.paymentSessions || [];
    const actualAttendance = (actual.attendance || []).filter(a => a.status === "PRESENT" || a.status === "LATE" || a.status === "MAKEUP");

    const issues = [];

    // Check session count
    if (actualSessions.length !== expected.sessionCount) {
      issues.push("Session count mismatch: expected=" + expected.sessionCount + " actual=" + actualSessions.length);
    }

    // Check each session capacity
    const actualSessionMap = new Map();
    for (const s of actualSessions) {
      actualSessionMap.set(s.id, s);
    }

    for (const es of expected.sessions) {
      const as = actualSessionMap.get(es.id);
      if (!as) {
        issues.push("Missing session: " + es.id);
      } else {
        if (as.capacity !== es.capacity) {
          issues.push("Capacity mismatch for " + es.id + ": expected=" + es.capacity + " actual=" + as.capacity);
        }
        if (es.type !== "carry-over" && as.amount !== es.amount) {
          issues.push("Amount mismatch for " + es.id + ": expected=" + es.amount + " actual=" + as.amount);
        }
      }
    }

    // Check total capacity
    const actualTotalCap = actualSessions.reduce((s, x) => s + x.capacity, 0);
    if (actualTotalCap !== expected.totalCapacity) {
      issues.push("Total capacity mismatch: expected=" + expected.totalCapacity + " actual=" + actualTotalCap);
    }

    // Check remaining = totalCapacity - consuming attendance
    const consuming = actualAttendance.length;
    const expectedRemaining = actualTotalCap - consuming;

    if (issues.length > 0) {
      discrepancies.push({ id, name: actual.name, issues, expected, actualTotalCap, consuming, expectedRemaining });
    } else {
      okCount++;
      // Print brief summary for edge cases
      if (expected.debt > 0 || expected.carryOver > 0) {
        console.log("OK [EDGE] " + id + " (" + actual.name + "): co=" + expected.carryOver +
          " debt=" + expected.debt + " sessions=" + expected.sessionCount +
          " totalCap=" + expected.totalCapacity + " consuming=" + consuming +
          " remaining=" + expectedRemaining);
      }
    }
  }

  console.log("\n=== RESULTS ===");
  console.log("OK: " + okCount + "/" + ALL_STUDENTS.length);

  if (discrepancies.length > 0) {
    console.log("DISCREPANCIES: " + discrepancies.length);
    for (const d of discrepancies) {
      console.log("\n--- " + d.id + " (" + (d.name || "?") + ") ---");
      if (d.error) {
        console.log("  ERROR: " + d.error);
      } else {
        for (const i of d.issues) {
          console.log("  " + i);
        }
        console.log("  Expected: sessions=" + d.expected.sessionCount + " totalCap=" + d.expected.totalCapacity + " co=" + d.expected.carryOver + " debt=" + d.expected.debt);
        console.log("  Actual: totalCap=" + d.actualTotalCap + " consuming=" + d.consuming + " remaining=" + d.expectedRemaining);
      }
    }
  } else {
    console.log("No discrepancies found!");
  }

  // Also verify STUDENT_RAW 'remaining' field vs computed remaining
  console.log("\n=== REMAINING FIELD CHECK (STUDENT_RAW field[5]) ===");
  const STUDENT_REMAINING = {
    "s01":-6,"s02":-1,"s03":1,"s04":6,"s05":4,"s06":-6,"s07":2,"s08":6,"s09":2,"s10":0,
    "s11":5,"s12":4,"s13":3,"s14":-3,"s15":-6,"s16":0,"s17":-1,"s18":-2,"s19":2,"s20":-4,
    "s21":0,"s22":3,"s23":0,"s24":1,"s25":3,"s26":-1,"s27":0,"s28":1,"s29":0,"s30":-1,
    "s31":3,"s32":-1,"s33":8,"s34":-1,"s35":1,"s36":-2,"s37":-1,"s38":0,"s39":0,"s40":0,
    "s41":-4,"s42":3,"s43":3,"s44":3,"s45":3,"s46":3,"s47":-1,"s48":-1,"s49":3,"s50":-2,
    "s51":0,"s52":2,"s53":2,"s54":3
  };

  let remainingOk = 0;
  const remainingIssues = [];

  for (const id of ALL_STUDENTS) {
    let actual;
    try { actual = await fetchStudent(id); } catch(e) { continue; }

    const actualSessions = actual.paymentSessions || [];
    const actualAtt = (actual.attendance || []).filter(a =>
      a.status === "PRESENT" || a.status === "LATE" || a.status === "MAKEUP"
    );
    const actualTotalCap = actualSessions.reduce((s, x) => s + x.capacity, 0);
    const computedRemaining = actualTotalCap - actualAtt.length;
    const expectedRemaining = STUDENT_REMAINING[id];

    if (computedRemaining === expectedRemaining) {
      remainingOk++;
    } else {
      remainingIssues.push(id + " (" + actual.name + "): STUDENT_RAW remaining=" + expectedRemaining +
        " computed=" + computedRemaining + " (totalCap=" + actualTotalCap + " att=" + actualAtt.length + ")");
    }
  }

  console.log("Remaining match: " + remainingOk + "/" + ALL_STUDENTS.length);
  if (remainingIssues.length > 0) {
    console.log("Remaining mismatches:");
    for (const i of remainingIssues) {
      console.log("  " + i);
    }
  }
}

verify().catch(e => console.error("Fatal:", e));
