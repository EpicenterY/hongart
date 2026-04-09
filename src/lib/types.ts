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

export enum MemoCategory {
  GENERAL = "GENERAL",
  PROGRESS = "PROGRESS",
  ISSUE = "ISSUE",
  PARENT_CONTACT = "PARENT_CONTACT",
  OTHER = "OTHER",
}

export type PaymentState = "OK" | "NEEDS_PAYMENT" | "NEW" | "NO_SUBSCRIPTION";

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

export interface ScheduleSlot {
  day: string;   // "MON" | "TUE" | ...
  time: string;  // "HH:MM" format
}

export interface Subscription {
  id: string;
  studentId: string;
  daysPerWeek: number;
  schedule: ScheduleSlot[];
  startDate: Date;
  endDate: Date | null;
  monthlyFee: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentSession {
  id: string;
  studentId: string;
  capacity: number;
  frozen: boolean;
  amount: number;
  method: PaymentMethod;
  daysPerWeek: number;
  monthlyFee: number;
  note: string | null;
  createdAt: Date;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: Date;
  timeSlot: string;
  status: AttendanceStatus;
  checkInAt: Date | null;
  note: string | null;
  createdAt: Date;
}

export interface FilledSession {
  session: PaymentSession;
  assigned: AttendanceRecord[];
  absents: AttendanceRecord[];
  filledCount: number;
  remaining: number;
}

export interface FillingResult {
  filledSessions: FilledSession[];
  unassigned: AttendanceRecord[];
  totalCapacity: number;
  totalConsuming: number;
  remaining: number;
}

export interface BalanceInfo {
  remaining: number;
  totalCapacity: number;
  totalConsuming: number;
  currentSessionUsed: number;
  currentSessionTotal: number;
  currentSessionRemaining: number;
  paymentState: PaymentState;
  hasPaymentHistory: boolean;
}

export interface Memo {
  id: string;
  studentId: string;
  category: MemoCategory;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PendingPlanChange {
  id: string;
  studentId: string;
  previousDaysPerWeek: number;
  previousSchedule: ScheduleSlot[];
  previousMonthlyFee: number;
  frozenSessionId: string | null;
  recommendedAmount: number;
  isCredit: boolean;
  createdAt: Date;
}

export interface StudentWithRelations extends Student {
  subscription: Subscription | null;
  paymentSessions: PaymentSession[];
  attendance: AttendanceRecord[];
  memos: Memo[];
  pendingPlanChange: PendingPlanChange | null;
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

export interface ScheduleOverride {
  id: string;
  studentId: string;
  originalDate: string;
  newDate: string;
  newTime: string;
  createdAt: Date;
}

export interface StudentFilter {
  status?: StudentStatus;
  search?: string;
}

export interface ScheduleEntry {
  studentId: string;
  studentName: string;
  schedule: ScheduleSlot[];
  daysPerWeek: number;
  startDate: string;
}

export type DateStatus =
  | { status: "holiday"; name: string }
  | { status: "vacation"; name: string }
  | { status: "disabled_day" }
  | { status: "normal" };

export interface DashboardStats {
  todayAttendance: { present: number; total: number };
  totalStudents: { active: number; paused: number; withdrawn: number };
  monthlyPayment: { paidAmount: number; totalCredits: number };
  attendanceRate: number;
  unpaidStudents: { studentId: string; studentName: string; remaining: number }[];
  weeklyAttendance: { day: string; count: number }[];
}

export interface AnalyticsData {
  monthlyRevenue: { month: string; amount: number }[];
  studentCountTrend: { month: string; count: number }[];
  planDistribution: { plan: string; count: number; percentage: number }[];
  longestStudents: { name: string; months: number; startDate: string }[];
}

// ─── Pure Functions ──────────────────────────────────────

/** 소모성 출석 여부 (PRESENT/LATE/MAKEUP) */
export function isConsuming(status: AttendanceStatus): boolean {
  return status !== AttendanceStatus.ABSENT;
}

/**
 * 순수 함수: 세션 목록과 출석 기록으로 FillingResult를 계산
 */
export function computeFilling(
  sessions: PaymentSession[],
  records: AttendanceRecord[],
): FillingResult {
  const sortedSessions = [...sessions].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );
  const sortedRecords = [...records].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  const filledSessions: FilledSession[] = sortedSessions.map((session) => ({
    session,
    assigned: [],
    absents: [],
    filledCount: 0,
    remaining: session.capacity,
  }));

  const unassigned: AttendanceRecord[] = [];

  let sessionIdx = 0;
  for (const record of sortedRecords) {
    const consuming = isConsuming(record.status);

    if (consuming) {
      while (sessionIdx < filledSessions.length && filledSessions[sessionIdx].remaining <= 0) {
        sessionIdx++;
      }
      if (sessionIdx < filledSessions.length) {
        filledSessions[sessionIdx].assigned.push(record);
        filledSessions[sessionIdx].filledCount++;
        filledSessions[sessionIdx].remaining--;
      } else {
        unassigned.push(record);
      }
    } else {
      const idx = Math.min(sessionIdx, filledSessions.length - 1);
      if (idx >= 0) {
        filledSessions[idx].absents.push(record);
      }
    }
  }

  const totalCapacity = sortedSessions.reduce((sum, s) => sum + s.capacity, 0);
  const totalConsuming = sortedRecords.filter((r) => isConsuming(r.status)).length;

  return {
    filledSessions,
    unassigned,
    totalCapacity,
    totalConsuming,
    remaining: totalCapacity - totalConsuming,
  };
}

/** schedule에서 day 배열 추출 */
export function getScheduleDays(schedule: ScheduleSlot[]): string[] {
  return [...new Set(schedule.map(s => s.day))];
}

/** 특정 요일의 시간 조회 */
export function getScheduleTime(schedule: ScheduleSlot[], day: string): string | null {
  return schedule.find(s => s.day === day)?.time ?? null;
}

// ─── Helper: KST date string ────────────────────────────

export function toKSTDateStr(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
}
