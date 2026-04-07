// ─── Enums ───────────────────────────────────────────────

export enum StudentStatus {
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  WITHDRAWN = "WITHDRAWN",
}

export enum AttendanceStatus {
  PRESENT = "PRESENT",
  ABSENT = "ABSENT",
  LATE = "LATE",
  MAKEUP = "MAKEUP",
}

export enum PaymentMethod {
  CASH = "CASH",
  CARD = "CARD",
  TRANSFER = "TRANSFER",
}

export enum PaymentStatus {
  PAID = "PAID",
  PENDING = "PENDING",
}

export enum MemoCategory {
  GENERAL = "GENERAL",
  PROGRESS = "PROGRESS",
  ISSUE = "ISSUE",
  PARENT_CONTACT = "PARENT_CONTACT",
  OTHER = "OTHER",
}

export type LedgerType = "CREDIT" | "DEBIT" | "PLAN_CHANGE";
export type PaymentState = "OK" | "NEEDS_PAYMENT" | "PENDING_CREDIT" | "NEW" | "NO_SUBSCRIPTION";

// ─── Interfaces ──────────────────────────────────────────

export interface Student {
  id: string;
  name: string;
  phone: string | null;
  parentPhone: string | null;
  school: string | null;
  grade: string | null;
  status: StudentStatus;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  id: string;
  studentId: string;
  daysPerWeek: number;
  scheduleDays: string[];
  scheduleTime: string; // "HH:MM" format
  startDate: Date;
  endDate: Date | null;
  monthlyFee: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LedgerEntry {
  id: string;
  studentId: string;
  type: LedgerType;
  date: Date;
  seq: number; // monotonic insertion order (sort tiebreaker)
  sessionDelta: number; // +N(CREDIT), -1(DEBIT), -balance(PLAN_CHANGE)
  balanceAfter: number; // recomputed

  // CREDIT fields
  amount?: number;
  method?: PaymentMethod | null;
  paymentStatus?: PaymentStatus;

  // DEBIT fields
  attendanceStatus?: AttendanceStatus;
  checkInAt?: Date | null;

  // Common: plan snapshot at the time
  daysPerWeek?: number;
  monthlyFee?: number;

  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BalanceInfo {
  balance: number;
  totalPerCycle: number;
  currentCycleUsed: number;
  currentCycleTotal: number;
  currentCycleRemaining: number;
  needsPayment: boolean;
  hasPaymentHistory: boolean;
  hasPendingCredit: boolean;
  paymentState: PaymentState;
}

export interface Memo {
  id: string;
  studentId: string;
  category: MemoCategory;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudentWithRelations extends Student {
  subscription: Subscription | null;
  ledger: LedgerEntry[];
  memos: Memo[];
}

export interface ClassDaySettings {
  enabledDays: string[];
}

export interface PublicHoliday {
  date: string;
  name: string;
}

export interface VacationPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface Plan {
  daysPerWeek: number;
  label: string;
  monthlyFee: number;
}

// ─── Global Store (survives HMR / module re-evaluation) ──

interface MockStore {
  idCounter: number;
  ledgerSeq: number; // monotonic seq counter for ledger entries
  students: Student[];
  subscriptions: Subscription[];
  ledger: LedgerEntry[];
  memos: Memo[];
  classDaySettings: ClassDaySettings;
  publicHolidays: PublicHoliday[];
  vacationPeriods: VacationPeriod[];
  plans: Plan[];
}

const GLOBAL_KEY = "__hongart_mock_store__" as const;
const SEED_VERSION_KEY = "__hongart_seed_version__" as const;
const CURRENT_SEED_VERSION = 23; // bump to reset seed data

function getStore(): MockStore {
  const g = globalThis as unknown as Record<string, MockStore | number | undefined>;
  if (!g[GLOBAL_KEY] || g[SEED_VERSION_KEY] !== CURRENT_SEED_VERSION) {
    g[GLOBAL_KEY] = createSeedData();
    g[SEED_VERSION_KEY] = CURRENT_SEED_VERSION;
  }
  return g[GLOBAL_KEY] as MockStore;
}

// ─── ID Generator ────────────────────────────────────────

function genId(): string {
  const store = getStore();
  return `mock-${(store.idCounter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Seed Data Factory ──────────────────────────────────

function createSeedData(): MockStore {
  const now = new Date("2026-04-05T10:00:00+09:00");

  const students: Student[] = [
    { id: "s1", name: "김서연", phone: "010-1234-5678", parentPhone: "010-9876-5432", school: "한빛초등학교", grade: "초5", status: StudentStatus.ACTIVE, note: null, createdAt: new Date("2025-09-01"), updatedAt: now },
    { id: "s2", name: "윤진원", phone: null, parentPhone: "010-5555-1234", school: null, grade: null, status: StudentStatus.ACTIVE, note: null, createdAt: new Date("2026-04-06"), updatedAt: now },
  ];

  const subscriptions: Subscription[] = [
    { id: "sub1", studentId: "s1", daysPerWeek: 2, scheduleDays: ["TUE", "THU"], scheduleTime: "15:00", startDate: new Date("2025-09-01T00:00:00+09:00"), endDate: null, monthlyFee: 140000, isActive: true, createdAt: new Date("2025-09-01"), updatedAt: now },
    { id: "sub2", studentId: "s2", daysPerWeek: 1, scheduleDays: ["MON", "TUE", "WED", "THU", "FRI"], scheduleTime: "15:00", startDate: new Date("2026-04-06T00:00:00+09:00"), endDate: null, monthlyFee: 100000, isActive: true, createdAt: new Date("2026-04-06"), updatedAt: now },
  ];

  // Ledger seed: 04/01 CREDIT(PAID,+8), 04/01 DEBIT(PRESENT,-1), 04/03 DEBIT(PRESENT,-1)
  const ledger: LedgerEntry[] = [
    {
      id: "led-01-s1",
      studentId: "s1",
      type: "CREDIT",
      date: new Date("2026-04-01T09:00:00+09:00"),
      seq: 1,
      sessionDelta: 8,
      balanceAfter: 8,
      amount: 140000,
      method: PaymentMethod.TRANSFER,
      paymentStatus: PaymentStatus.PAID,
      daysPerWeek: 2,
      monthlyFee: 140000,
      note: null,
      createdAt: new Date("2026-04-01T09:00:00+09:00"),
      updatedAt: new Date("2026-04-01T09:00:00+09:00"),
    },
    {
      id: "led-02-s1",
      studentId: "s1",
      type: "DEBIT",
      date: new Date("2026-04-01T15:05:00+09:00"),
      seq: 2,
      sessionDelta: -1,
      balanceAfter: 7,
      attendanceStatus: AttendanceStatus.PRESENT,
      checkInAt: new Date("2026-04-01T15:05:00+09:00"),
      daysPerWeek: 2,
      monthlyFee: 140000,
      note: null,
      createdAt: new Date("2026-04-01T15:05:00+09:00"),
      updatedAt: new Date("2026-04-01T15:05:00+09:00"),
    },
    {
      id: "led-03-s1",
      studentId: "s1",
      type: "DEBIT",
      date: new Date("2026-04-03T15:01:00+09:00"),
      seq: 3,
      sessionDelta: -1,
      balanceAfter: 6,
      attendanceStatus: AttendanceStatus.PRESENT,
      checkInAt: new Date("2026-04-03T15:01:00+09:00"),
      daysPerWeek: 2,
      monthlyFee: 140000,
      note: null,
      createdAt: new Date("2026-04-03T15:01:00+09:00"),
      updatedAt: new Date("2026-04-03T15:01:00+09:00"),
    },
    // ── 윤진원 (s2): 주1회, balance=0, 11 entries ──
    // seq 10: DEBIT 4/6 PRESENT (before payment, balance goes -1)
    {
      id: "led-01-s2", studentId: "s2", type: "DEBIT",
      date: new Date("2026-04-06T15:05:00+09:00"), seq: 10, sessionDelta: -1, balanceAfter: -1,
      attendanceStatus: AttendanceStatus.PRESENT, checkInAt: new Date("2026-04-06T15:05:00+09:00"),
      daysPerWeek: 1, monthlyFee: 100000, note: null,
      createdAt: new Date("2026-04-06T15:05:00+09:00"), updatedAt: new Date("2026-04-06T15:05:00+09:00"),
    },
    // seq 11: CREDIT 4/7 100000 PAID +4 (balance: -1+4=3)
    {
      id: "led-02-s2", studentId: "s2", type: "CREDIT",
      date: new Date("2026-04-07T09:00:00+09:00"), seq: 11, sessionDelta: 4, balanceAfter: 3,
      amount: 100000, method: PaymentMethod.TRANSFER, paymentStatus: PaymentStatus.PAID,
      daysPerWeek: 1, monthlyFee: 100000, note: null,
      createdAt: new Date("2026-04-07T09:00:00+09:00"), updatedAt: new Date("2026-04-07T09:00:00+09:00"),
    },
    // seq 12: CREDIT 4/7 100000 PAID +4 (balance: 3+4=7)
    {
      id: "led-03-s2", studentId: "s2", type: "CREDIT",
      date: new Date("2026-04-07T09:01:00+09:00"), seq: 12, sessionDelta: 4, balanceAfter: 7,
      amount: 100000, method: PaymentMethod.TRANSFER, paymentStatus: PaymentStatus.PAID,
      daysPerWeek: 1, monthlyFee: 100000, note: null,
      createdAt: new Date("2026-04-07T09:01:00+09:00"), updatedAt: new Date("2026-04-07T09:01:00+09:00"),
    },
    // seq 13: DEBIT 4/7 PRESENT (balance: 7-1=6)
    {
      id: "led-04-s2", studentId: "s2", type: "DEBIT",
      date: new Date("2026-04-07T15:05:00+09:00"), seq: 13, sessionDelta: -1, balanceAfter: 6,
      attendanceStatus: AttendanceStatus.PRESENT, checkInAt: new Date("2026-04-07T15:05:00+09:00"),
      daysPerWeek: 1, monthlyFee: 100000, note: null,
      createdAt: new Date("2026-04-07T15:05:00+09:00"), updatedAt: new Date("2026-04-07T15:05:00+09:00"),
    },
    // seq 14: DEBIT 4/8 ABSENT (balance stays 6)
    {
      id: "led-05-s2", studentId: "s2", type: "DEBIT",
      date: new Date("2026-04-08T15:00:00+09:00"), seq: 14, sessionDelta: 0, balanceAfter: 6,
      attendanceStatus: AttendanceStatus.ABSENT, checkInAt: null,
      daysPerWeek: 1, monthlyFee: 100000, note: null,
      createdAt: new Date("2026-04-08T15:00:00+09:00"), updatedAt: new Date("2026-04-08T15:00:00+09:00"),
    },
    // seq 15: DEBIT 4/9 PRESENT (balance: 6-1=5)
    {
      id: "led-06-s2", studentId: "s2", type: "DEBIT",
      date: new Date("2026-04-09T15:05:00+09:00"), seq: 15, sessionDelta: -1, balanceAfter: 5,
      attendanceStatus: AttendanceStatus.PRESENT, checkInAt: new Date("2026-04-09T15:05:00+09:00"),
      daysPerWeek: 1, monthlyFee: 100000, note: null,
      createdAt: new Date("2026-04-09T15:05:00+09:00"), updatedAt: new Date("2026-04-09T15:05:00+09:00"),
    },
    // seq 16: DEBIT 4/12 PRESENT (balance: 5-1=4)
    {
      id: "led-07-s2", studentId: "s2", type: "DEBIT",
      date: new Date("2026-04-12T15:05:00+09:00"), seq: 16, sessionDelta: -1, balanceAfter: 4,
      attendanceStatus: AttendanceStatus.PRESENT, checkInAt: new Date("2026-04-12T15:05:00+09:00"),
      daysPerWeek: 1, monthlyFee: 100000, note: null,
      createdAt: new Date("2026-04-12T15:05:00+09:00"), updatedAt: new Date("2026-04-12T15:05:00+09:00"),
    },
    // seq 17: DEBIT 4/13 PRESENT (balance: 4-1=3)
    {
      id: "led-08-s2", studentId: "s2", type: "DEBIT",
      date: new Date("2026-04-13T15:05:00+09:00"), seq: 17, sessionDelta: -1, balanceAfter: 3,
      attendanceStatus: AttendanceStatus.PRESENT, checkInAt: new Date("2026-04-13T15:05:00+09:00"),
      daysPerWeek: 1, monthlyFee: 100000, note: null,
      createdAt: new Date("2026-04-13T15:05:00+09:00"), updatedAt: new Date("2026-04-13T15:05:00+09:00"),
    },
    // seq 18: DEBIT 4/14 PRESENT (balance: 3-1=2)
    {
      id: "led-09-s2", studentId: "s2", type: "DEBIT",
      date: new Date("2026-04-14T15:05:00+09:00"), seq: 18, sessionDelta: -1, balanceAfter: 2,
      attendanceStatus: AttendanceStatus.PRESENT, checkInAt: new Date("2026-04-14T15:05:00+09:00"),
      daysPerWeek: 1, monthlyFee: 100000, note: null,
      createdAt: new Date("2026-04-14T15:05:00+09:00"), updatedAt: new Date("2026-04-14T15:05:00+09:00"),
    },
    // seq 19: DEBIT 4/15 PRESENT (balance: 2-1=1)
    {
      id: "led-10-s2", studentId: "s2", type: "DEBIT",
      date: new Date("2026-04-15T15:05:00+09:00"), seq: 19, sessionDelta: -1, balanceAfter: 1,
      attendanceStatus: AttendanceStatus.PRESENT, checkInAt: new Date("2026-04-15T15:05:00+09:00"),
      daysPerWeek: 1, monthlyFee: 100000, note: null,
      createdAt: new Date("2026-04-15T15:05:00+09:00"), updatedAt: new Date("2026-04-15T15:05:00+09:00"),
    },
    // seq 20: DEBIT 4/16 PRESENT (balance: 1-1=0)
    {
      id: "led-11-s2", studentId: "s2", type: "DEBIT",
      date: new Date("2026-04-16T15:05:00+09:00"), seq: 20, sessionDelta: -1, balanceAfter: 0,
      attendanceStatus: AttendanceStatus.PRESENT, checkInAt: new Date("2026-04-16T15:05:00+09:00"),
      daysPerWeek: 1, monthlyFee: 100000, note: null,
      createdAt: new Date("2026-04-16T15:05:00+09:00"), updatedAt: new Date("2026-04-16T15:05:00+09:00"),
    },
  ];

  const memos: Memo[] = [];

  return {
    idCounter: 1000,
    ledgerSeq: 100, // start after seed seq values (s1: 1-3, s2: 10-20)
    students,
    subscriptions,
    ledger,
    memos,
    classDaySettings: { enabledDays: ["MON", "TUE", "WED", "THU", "FRI", "SAT"] },
    publicHolidays: [],
    vacationPeriods: [
      { id: "vac1", name: "여름방학", startDate: "2026-07-27", endDate: "2026-08-14" },
      { id: "vac2", name: "겨울방학", startDate: "2026-12-21", endDate: "2027-01-02" },
    ],
    plans: [
      { daysPerWeek: 1, label: "주 1회", monthlyFee: 100000 },
      { daysPerWeek: 2, label: "주 2회", monthlyFee: 140000 },
      { daysPerWeek: 3, label: "주 3회", monthlyFee: 170000 },
    ],
  };
}

// ─── Ledger Sorting ─────────────────────────────────────

const TYPE_ORDER: Record<LedgerType, number> = { CREDIT: 0, PLAN_CHANGE: 1, DEBIT: 2 };

function nextSeq(): number {
  const store = getStore();
  return ++store.ledgerSeq;
}

function sortLedger(entries: LedgerEntry[]): LedgerEntry[] {
  return entries.sort((a, b) => {
    const dateDiff = a.date.getTime() - b.date.getTime();
    if (dateDiff !== 0) return dateDiff;
    // Same date: use seq (insertion order) as primary tiebreaker
    if (a.seq !== b.seq) return a.seq - b.seq;
    // Fallback: TYPE_ORDER
    return TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
  });
}

// ─── Recompute Balance ──────────────────────────────────

export function recomputeBalance(studentId: string): void {
  const { ledger } = getStore();
  const entries = sortLedger(ledger.filter((e) => e.studentId === studentId));
  let balance = 0;
  for (const entry of entries) {
    // PENDING CREDIT은 결제 확정 전이므로 세션을 추가하지 않음
    const delta =
      entry.type === "CREDIT" && entry.paymentStatus === PaymentStatus.PENDING
        ? 0
        : entry.sessionDelta;
    balance += delta;
    entry.balanceAfter = balance;
  }
}

export function getBalance(studentId: string): number {
  const { ledger } = getStore();
  const entries = ledger.filter((e) => e.studentId === studentId);
  if (entries.length === 0) return 0;
  const sorted = sortLedger([...entries]);
  return sorted[sorted.length - 1].balanceAfter;
}

export function getBalanceInfo(studentId: string): BalanceInfo {
  const sub = getSubscriptionByStudentId(studentId);
  const totalPerCycle = sub ? sub.daysPerWeek * 4 : 0;
  const balance = getBalance(studentId);

  const { ledger } = getStore();
  const entries = ledger.filter((e) => e.studentId === studentId);
  const hasPaymentHistory = entries.some((e) => e.type === "CREDIT" && e.paymentStatus === PaymentStatus.PAID);
  const hasPendingCredit = entries.some((e) => e.type === "CREDIT" && e.paymentStatus === PaymentStatus.PENDING);

  // Current cycle: 버킷 관점에서 현재 사이클 사용/잔여 계산
  // balance는 전체 잔여, totalPerCycle은 1회 결제당 회수
  // 현재 버킷 잔여 = min(balance, totalPerCycle)
  const currentCycleTotal = totalPerCycle;
  const currentCycleRemaining = Math.max(0, Math.min(balance, totalPerCycle));
  const cycleUsed = totalPerCycle > 0
    ? Math.max(0, totalPerCycle - currentCycleRemaining)
    : 0;
  // needsPayment: 새 결제 엔트리를 생성해야 하는 상태
  // PENDING CREDIT이 이미 있으면 시스템이 결제를 요청한 상태이므로 false
  const needsPayment = balance <= 0 && !hasPendingCredit;

  // Derive paymentState
  let paymentState: PaymentState;
  if (!sub) {
    paymentState = "NO_SUBSCRIPTION";
  } else if (!hasPaymentHistory) {
    paymentState = "NEW";
  } else if (hasPendingCredit) {
    paymentState = "PENDING_CREDIT";
  } else if (balance <= 0) {
    paymentState = "NEEDS_PAYMENT";
  } else {
    paymentState = "OK";
  }

  return {
    balance,
    totalPerCycle,
    currentCycleUsed: cycleUsed,
    currentCycleTotal,
    currentCycleRemaining,
    needsPayment,
    hasPaymentHistory,
    hasPendingCredit,
    paymentState,
  };
}

// ─── CRUD Functions: Students ────────────────────────────

export interface StudentFilter {
  status?: StudentStatus;
  search?: string;
}

export function getStudents(filter?: StudentFilter): Student[] {
  const { students } = getStore();
  let result = [...students];
  if (filter?.status) {
    result = result.filter((s) => s.status === filter.status);
  }
  if (filter?.search) {
    const q = filter.search.toLowerCase();
    result = result.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.school?.toLowerCase().includes(q) ||
        s.phone?.includes(q),
    );
  }
  return result;
}

export function getStudentById(id: string): StudentWithRelations | null {
  const { students, subscriptions, ledger, memos } = getStore();
  const student = students.find((s) => s.id === id);
  if (!student) return null;

  const sub = subscriptions.find((s) => s.studentId === id && s.isActive) ?? null;
  const studentLedger = sortLedger([...ledger.filter((e) => e.studentId === id)]);
  const studentMemos = memos
    .filter((m) => m.studentId === id)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    ...student,
    subscription: sub,
    ledger: studentLedger,
    memos: studentMemos,
  };
}

export function createStudent(
  data: Omit<Student, "id" | "createdAt" | "updatedAt">,
): Student {
  const { students } = getStore();
  const student: Student = {
    ...data,
    id: genId(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  students.push(student);
  return student;
}

export function updateStudent(
  id: string,
  data: Partial<Omit<Student, "id" | "createdAt" | "updatedAt">>,
): Student | null {
  const { students } = getStore();
  const idx = students.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  students[idx] = { ...students[idx], ...data, updatedAt: new Date() };
  return students[idx];
}

export function deleteStudent(id: string): boolean {
  const store = getStore();
  const idx = store.students.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  store.students.splice(idx, 1);
  store.subscriptions = store.subscriptions.filter((s) => s.studentId !== id);
  store.ledger = store.ledger.filter((e) => e.studentId !== id);
  store.memos = store.memos.filter((m) => m.studentId !== id);
  return true;
}

// ─── CRUD Functions: Subscriptions ───────────────────────

export function getSubscriptionByStudentId(
  studentId: string,
): Subscription | null {
  const { subscriptions } = getStore();
  return (
    subscriptions.find((s) => s.studentId === studentId && s.isActive) ?? null
  );
}

export function createSubscription(
  data: Omit<Subscription, "id" | "createdAt" | "updatedAt">,
): Subscription {
  const { subscriptions } = getStore();
  const sub: Subscription = {
    ...data,
    id: genId(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  subscriptions.push(sub);
  return sub;
}

export function updateSubscription(
  id: string,
  data: Partial<Omit<Subscription, "id" | "createdAt" | "updatedAt">>,
): Subscription | null {
  const { subscriptions } = getStore();
  const idx = subscriptions.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  subscriptions[idx] = { ...subscriptions[idx], ...data, updatedAt: new Date() };
  return subscriptions[idx];
}

// ─── Ledger CRUD ─────────────────────────────────────────

export function getLedgerByStudentId(studentId: string): LedgerEntry[] {
  const { ledger } = getStore();
  return sortLedger([...ledger.filter((e) => e.studentId === studentId)]);
}

export function getLedgerByDate(dateStr: string): (LedgerEntry & { studentName: string })[] {
  const { ledger, students } = getStore();
  const target = new Date(dateStr + "T00:00:00+09:00");
  const nextDay = new Date(target.getTime() + 24 * 60 * 60 * 1000);

  const filtered = ledger
    .filter((e) => e.date >= target && e.date < nextDay)
    .map((e) => ({
      ...e,
      studentName: students.find((s) => s.id === e.studentId)?.name ?? "",
    }));
  return filtered.sort((a, b) => {
    const dateDiff = a.date.getTime() - b.date.getTime();
    if (dateDiff !== 0) return dateDiff;
    if (a.seq !== b.seq) return a.seq - b.seq;
    return TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
  });
}

export function addCredit(data: {
  studentId: string;
  date: Date;
  sessionDelta: number;
  amount: number;
  method: PaymentMethod | null;
  paymentStatus: PaymentStatus;
  note: string | null;
}): LedgerEntry {
  const { ledger } = getStore();
  const sub = getSubscriptionByStudentId(data.studentId);
  const entry: LedgerEntry = {
    id: genId(),
    studentId: data.studentId,
    type: "CREDIT",
    date: data.date,
    seq: nextSeq(),
    sessionDelta: data.sessionDelta,
    balanceAfter: 0,
    amount: data.amount,
    method: data.method,
    paymentStatus: data.paymentStatus,
    daysPerWeek: sub?.daysPerWeek,
    monthlyFee: sub?.monthlyFee,
    note: data.note,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  ledger.push(entry);
  recomputeBalance(data.studentId);
  return entry;
}

export function addDebit(data: {
  studentId: string;
  date: Date;
  attendanceStatus: AttendanceStatus;
  checkInAt: Date | null;
  note: string | null;
}): LedgerEntry {
  const { ledger } = getStore();
  const sub = getSubscriptionByStudentId(data.studentId);
  const counts = data.attendanceStatus === AttendanceStatus.ABSENT;
  const entry: LedgerEntry = {
    id: genId(),
    studentId: data.studentId,
    type: "DEBIT",
    date: data.date,
    seq: nextSeq(),
    sessionDelta: counts ? 0 : -1,
    balanceAfter: 0,
    attendanceStatus: data.attendanceStatus,
    checkInAt: data.checkInAt,
    daysPerWeek: sub?.daysPerWeek,
    monthlyFee: sub?.monthlyFee,
    note: data.note,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  ledger.push(entry);
  recomputeBalance(data.studentId);
  return entry;
}

export function addPlanChange(data: {
  studentId: string;
  date: Date;
  sessionDelta: number; // -(current balance)
  note: string | null;
}): LedgerEntry {
  const { ledger } = getStore();
  const sub = getSubscriptionByStudentId(data.studentId);
  const entry: LedgerEntry = {
    id: genId(),
    studentId: data.studentId,
    type: "PLAN_CHANGE",
    date: data.date,
    seq: nextSeq(),
    sessionDelta: data.sessionDelta,
    balanceAfter: 0,
    daysPerWeek: sub?.daysPerWeek,
    monthlyFee: sub?.monthlyFee,
    note: data.note,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  ledger.push(entry);
  recomputeBalance(data.studentId);
  return entry;
}

export function updateLedgerEntry(
  id: string,
  data: Partial<Pick<LedgerEntry, "attendanceStatus" | "checkInAt" | "paymentStatus" | "method" | "amount" | "sessionDelta" | "note">>,
): LedgerEntry | null {
  const { ledger } = getStore();
  const idx = ledger.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  const entry = ledger[idx];

  // If changing attendanceStatus, update sessionDelta
  if (data.attendanceStatus !== undefined) {
    const wasAbsent = entry.attendanceStatus === AttendanceStatus.ABSENT;
    const isAbsent = data.attendanceStatus === AttendanceStatus.ABSENT;
    if (wasAbsent && !isAbsent) data.sessionDelta = -1;
    if (!wasAbsent && isAbsent) data.sessionDelta = 0;
  }

  // If PENDING→PAID on a CREDIT, set sessionDelta if it was 0
  if (data.paymentStatus === PaymentStatus.PAID && entry.paymentStatus === PaymentStatus.PENDING) {
    if (entry.sessionDelta === 0) {
      const sub = getSubscriptionByStudentId(entry.studentId);
      data.sessionDelta = sub ? sub.daysPerWeek * 4 : 0;
    }
  }

  ledger[idx] = { ...entry, ...data, updatedAt: new Date() };
  recomputeBalance(entry.studentId);
  return ledger[idx];
}

export function deleteLedgerEntry(id: string): boolean {
  const { ledger } = getStore();
  const idx = ledger.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  const studentId = ledger[idx].studentId;
  ledger.splice(idx, 1);
  recomputeBalance(studentId);
  return true;
}

// ─── Unpaid helpers ─────────────────────────────────────

export function getUnpaidStudents(): {
  studentId: string;
  studentName: string;
  balance: number;
  monthlyFee: number;
  sessionDelta: number;
}[] {
  const { students } = getStore();
  const result: {
    studentId: string;
    studentName: string;
    balance: number;
    monthlyFee: number;
    sessionDelta: number;
  }[] = [];
  for (const s of students) {
    if (s.status !== StudentStatus.ACTIVE) continue;
    const info = getBalanceInfo(s.id);
    // needsPayment만: PENDING CREDIT은 getAllCredits()로 별도 표시됨
    if (info.needsPayment) {
      const sub = getSubscriptionByStudentId(s.id);
      result.push({
        studentId: s.id,
        studentName: s.name,
        balance: info.balance,
        monthlyFee: sub?.monthlyFee ?? 0,
        sessionDelta: sub ? sub.daysPerWeek * 4 : 0,
      });
    }
  }
  return result;
}

export function getUnpaidCount(): number {
  return getUnpaidStudents().length;
}

/** Total count for badge: unpaid students + PENDING credit entries */
export function getTotalUnpaidCount(): number {
  const { ledger } = getStore();
  const pendingCredits = ledger.filter(
    (e) => e.type === "CREDIT" && e.paymentStatus === PaymentStatus.PENDING
  ).length;
  return getUnpaidStudents().length + pendingCredits;
}

// ─── Ledger queries for attendance page ─────────────────

export function getDebitsByDate(dateStr: string): (LedgerEntry & { studentName: string })[] {
  const { ledger, students } = getStore();
  const target = new Date(dateStr + "T00:00:00+09:00");
  const nextDay = new Date(target.getTime() + 24 * 60 * 60 * 1000);

  return ledger
    .filter((e) => e.type === "DEBIT" && e.date >= target && e.date < nextDay)
    .map((e) => ({
      ...e,
      studentName: students.find((s) => s.id === e.studentId)?.name ?? "",
    }));
}

/** Convert a Date to KST date string "YYYY-MM-DD" */
function toKSTDateStr(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
}

export function getDebitsByStudentId(
  studentId: string,
  month?: string,
): LedgerEntry[] {
  const { ledger } = getStore();
  let result = ledger.filter((e) => e.studentId === studentId && e.type === "DEBIT");
  if (month) {
    result = result.filter((e) => toKSTDateStr(e.date).startsWith(month));
  }
  return result.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function getCreditsByStudentId(studentId: string): LedgerEntry[] {
  const { ledger } = getStore();
  return ledger
    .filter((e) => e.studentId === studentId && e.type === "CREDIT")
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function getAllCredits(statusFilter?: PaymentStatus): {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  method: string | null;
  status: PaymentStatus;
  date: string;
  paidAt: string | null;
  note: string | null;
  sessionDelta: number;
}[] {
  const { ledger, students } = getStore();
  let credits = ledger.filter((e) => e.type === "CREDIT");
  if (statusFilter) {
    credits = credits.filter((e) => e.paymentStatus === statusFilter);
  }
  // Sort: PENDING first, then by date desc
  const statusOrder: Record<string, number> = { PENDING: 0, PAID: 1 };
  credits.sort(
    (a, b) =>
      (statusOrder[a.paymentStatus ?? "PAID"] ?? 2) -
        (statusOrder[b.paymentStatus ?? "PAID"] ?? 2) ||
      b.date.getTime() - a.date.getTime(),
  );
  return credits.map((e) => ({
    id: e.id,
    studentId: e.studentId,
    studentName: students.find((s) => s.id === e.studentId)?.name ?? "",
    amount: e.amount ?? 0,
    method: e.method ?? null,
    status: e.paymentStatus ?? PaymentStatus.PAID,
    date: e.date.toISOString(),
    paidAt:
      e.paymentStatus === PaymentStatus.PAID
        ? e.updatedAt.toISOString()
        : null,
    note: e.note,
    sessionDelta: e.sessionDelta,
  }));
}

// ─── CRUD Functions: Memos ───────────────────────────────

export function getMemosByStudentId(studentId: string): Memo[] {
  const { memos } = getStore();
  return memos
    .filter((m) => m.studentId === studentId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function createMemo(
  data: Omit<Memo, "id" | "createdAt" | "updatedAt">,
): Memo {
  const { memos } = getStore();
  const memo: Memo = {
    ...data,
    id: genId(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memos.push(memo);
  return memo;
}

// ─── Class Day Settings ─────────────────────────────────

export function getClassDaySettings(): ClassDaySettings {
  const { classDaySettings } = getStore();
  return { enabledDays: [...classDaySettings.enabledDays] };
}

export function updateClassDaySettings(enabledDays: string[]): ClassDaySettings {
  const store = getStore();
  store.classDaySettings.enabledDays = [...enabledDays];
  return { enabledDays: [...store.classDaySettings.enabledDays] };
}

// ─── Public Holidays (2026 대한민국) ────────────────────

export function getPublicHolidays(): PublicHoliday[] {
  const { publicHolidays } = getStore();
  return publicHolidays.map((h) => ({ ...h }));
}

export function setPublicHolidays(holidays: PublicHoliday[]): void {
  const store = getStore();
  store.publicHolidays.length = 0;
  store.publicHolidays.push(...holidays);
}

// ─── Vacation Periods ───────────────────────────────────

export function getVacationPeriods(): VacationPeriod[] {
  const { vacationPeriods } = getStore();
  return vacationPeriods.map((v) => ({ ...v }));
}

export function createVacationPeriod(
  data: Omit<VacationPeriod, "id">,
): VacationPeriod {
  const { vacationPeriods } = getStore();
  const vac: VacationPeriod = { ...data, id: genId() };
  vacationPeriods.push(vac);
  return { ...vac };
}

export function updateVacationPeriod(
  id: string,
  data: Partial<Omit<VacationPeriod, "id">>,
): VacationPeriod | null {
  const { vacationPeriods } = getStore();
  const idx = vacationPeriods.findIndex((v) => v.id === id);
  if (idx === -1) return null;
  vacationPeriods[idx] = { ...vacationPeriods[idx], ...data };
  return { ...vacationPeriods[idx] };
}

export function deleteVacationPeriod(id: string): boolean {
  const { vacationPeriods } = getStore();
  const idx = vacationPeriods.findIndex((v) => v.id === id);
  if (idx === -1) return false;
  vacationPeriods.splice(idx, 1);
  return true;
}

// ─── Date Status Helper ─────────────────────────────────

export type DateStatus =
  | { status: "holiday"; name: string }
  | { status: "vacation"; name: string }
  | { status: "disabled_day" }
  | { status: "normal" };

export function getDateStatus(dateStr: string): DateStatus {
  const { publicHolidays, vacationPeriods, classDaySettings } = getStore();

  const holiday = publicHolidays.find((h) => h.date === dateStr);
  if (holiday) return { status: "holiday", name: holiday.name };

  const vacation = vacationPeriods.find(
    (v) => dateStr >= v.startDate && dateStr <= v.endDate,
  );
  if (vacation) return { status: "vacation", name: vacation.name };

  const dayOfWeek = new Date(dateStr + "T00:00:00+09:00").getDay();
  const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const dayName = dayNames[dayOfWeek];
  if (!classDaySettings.enabledDays.includes(dayName)) {
    return { status: "disabled_day" };
  }

  return { status: "normal" };
}

// ─── Plans (수강 플랜) ───────────────────────────────────

export function getPlans(): Plan[] {
  const { plans } = getStore();
  return [...plans];
}

export function updatePlan(daysPerWeek: number, monthlyFee: number): Plan | null {
  const { plans } = getStore();
  const plan = plans.find(p => p.daysPerWeek === daysPerWeek);
  if (!plan) return null;
  plan.monthlyFee = monthlyFee;
  return { ...plan };
}

// ─── Schedule ────────────────────────────────────────────

export interface ScheduleEntry {
  studentId: string;
  studentName: string;
  scheduleTime: string;
  scheduleDays: string[];
  daysPerWeek: number;
  startDate: string;
}

export function getWeeklySchedule(): ScheduleEntry[] {
  const { students, subscriptions } = getStore();
  const activeStudents = students.filter(s => s.status === StudentStatus.ACTIVE);
  const entries: ScheduleEntry[] = [];
  for (const student of activeStudents) {
    const sub = subscriptions.find(s => s.studentId === student.id && s.isActive);
    if (sub) {
      const kst = new Date(sub.startDate.getTime() + 9 * 60 * 60 * 1000);
      const startDateStr = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
      entries.push({
        studentId: student.id,
        studentName: student.name,
        scheduleTime: sub.scheduleTime,
        scheduleDays: sub.scheduleDays,
        daysPerWeek: sub.daysPerWeek,
        startDate: startDateStr,
      });
    }
  }
  return entries.sort((a, b) => a.scheduleTime.localeCompare(b.scheduleTime));
}

// ─── Dashboard / Analytics ───────────────────────────────

export interface DashboardStats {
  todayAttendance: { present: number; total: number };
  totalStudents: { active: number; paused: number; withdrawn: number };
  monthlyPayment: { paidAmount: number; totalCredits: number };
  attendanceRate: number;
  unpaidStudents: { studentId: string; studentName: string; balance: number }[];
  weeklyAttendance: { day: string; count: number }[];
}

export function getDashboardStats(): DashboardStats {
  const { students, ledger } = getStore();
  const now = new Date();
  const todayStr = toKSTDateStr(now);
  const todayStart = new Date(todayStr + "T00:00:00+09:00");
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  // Today's attendance
  const todayDebits = ledger.filter(
    (e) => e.type === "DEBIT" && e.date >= todayStart && e.date < todayEnd
  );
  const presentCount = todayDebits.filter(
    (e) => e.attendanceStatus === AttendanceStatus.PRESENT || e.attendanceStatus === AttendanceStatus.LATE
  ).length;

  // Student counts
  const active = students.filter((s) => s.status === StudentStatus.ACTIVE).length;
  const paused = students.filter((s) => s.status === StudentStatus.PAUSED).length;
  const withdrawn = students.filter((s) => s.status === StudentStatus.WITHDRAWN).length;

  // Monthly payments: CREDIT entries in current month
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthCredits = ledger.filter(
    (e) => e.type === "CREDIT" && toKSTDateStr(e.date).startsWith(currentMonth)
  );
  const paidAmount = monthCredits
    .filter((e) => e.paymentStatus === PaymentStatus.PAID)
    .reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const totalCredits = monthCredits.reduce((sum, e) => sum + (e.amount ?? 0), 0);

  // Attendance rate this month
  const monthDebits = ledger.filter(
    (e) => e.type === "DEBIT" && toKSTDateStr(e.date).startsWith(currentMonth)
  );
  const attended = monthDebits.filter(
    (e) => e.attendanceStatus === AttendanceStatus.PRESENT ||
           e.attendanceStatus === AttendanceStatus.LATE ||
           e.attendanceStatus === AttendanceStatus.MAKEUP
  ).length;
  const attendanceRate = monthDebits.length > 0
    ? Math.round((attended / monthDebits.length) * 100)
    : 0;

  // Unpaid students
  const unpaidStudents = getUnpaidStudents();

  // Weekly attendance (Mon-Sun of current week)
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  const dayLabels = ["월", "화", "수", "목", "금", "토", "일"];
  const weeklyAttendance: { day: string; count: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = toKSTDateStr(d);
    const dayStart = new Date(dateStr + "T00:00:00+09:00");
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const count = ledger.filter(
      (e) => e.type === "DEBIT" && e.date >= dayStart && e.date < dayEnd &&
             (e.attendanceStatus === AttendanceStatus.PRESENT ||
              e.attendanceStatus === AttendanceStatus.LATE ||
              e.attendanceStatus === AttendanceStatus.MAKEUP)
    ).length;
    weeklyAttendance.push({ day: dayLabels[i], count });
  }

  return {
    todayAttendance: { present: presentCount, total: todayDebits.length },
    totalStudents: { active, paused, withdrawn },
    monthlyPayment: { paidAmount, totalCredits },
    attendanceRate,
    unpaidStudents,
    weeklyAttendance,
  };
}

export interface AnalyticsData {
  monthlyTrend: { month: string; rate: number }[];
  dailyDistribution: { day: string; count: number }[];
  studentRanking: { studentId: string; name: string; rate: number; presentCount: number; totalCount: number }[];
}

export function getAnalyticsData(periodMonths: number = 3): AnalyticsData {
  const { students, ledger } = getStore();
  const now = new Date();
  const activeStudents = students.filter((s) => s.status === StudentStatus.ACTIVE);

  // Monthly trend
  const monthlyTrend: { month: string; rate: number }[] = [];
  for (let i = periodMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthDebits = ledger.filter(
      (e) => e.type === "DEBIT" && toKSTDateStr(e.date).startsWith(monthStr)
    );
    const att = monthDebits.filter(
      (e) => e.attendanceStatus !== AttendanceStatus.ABSENT
    ).length;
    const rate = monthDebits.length > 0 ? Math.round((att / monthDebits.length) * 100) : 0;
    monthlyTrend.push({ month: monthStr, rate });
  }

  // Daily distribution
  const dayMap = ["일", "월", "화", "수", "목", "금", "토"];
  const dayCounts: Record<string, number> = { "월": 0, "화": 0, "수": 0, "목": 0, "금": 0, "토": 0, "일": 0 };
  for (const e of ledger) {
    if (e.type !== "DEBIT" || e.attendanceStatus === AttendanceStatus.ABSENT) continue;
    const dayName = dayMap[e.date.getDay()];
    dayCounts[dayName]++;
  }
  const dailyDistribution = ["월", "화", "수", "목", "금", "토", "일"].map(
    (day) => ({ day, count: dayCounts[day] })
  );

  // Student ranking
  const studentRanking = activeStudents
    .map((s) => {
      const debits = ledger.filter((e) => e.studentId === s.id && e.type === "DEBIT");
      const presentCount = debits.filter((e) => e.attendanceStatus !== AttendanceStatus.ABSENT).length;
      const rate = debits.length > 0 ? Math.round((presentCount / debits.length) * 100) : 0;
      return { studentId: s.id, name: s.name, rate, presentCount, totalCount: debits.length };
    })
    .sort((a, b) => b.rate - a.rate);

  return { monthlyTrend, dailyDistribution, studentRanking };
}
