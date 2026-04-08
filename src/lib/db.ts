import { prisma } from "./prisma";
import {
  type Student,
  type ScheduleSlot,
  type Subscription,
  type PaymentSession,
  type AttendanceRecord,
  type BalanceInfo,
  type PaymentState,
  type Memo,
  type PendingPlanChange,
  type StudentWithRelations,
  type StudentFilter,
  type ClassDaySettings,
  type PublicHoliday,
  type VacationPeriod,
  type Plan,
  type ScheduleOverride,
  type ScheduleEntry,
  type DateStatus,
  type DashboardStats,
  type AnalyticsData,
  StudentStatus,
  AttendanceStatus,
  PaymentMethod,
  computeFilling,
  toKSTDateStr,
} from "./types";
import type { Prisma, AttendanceStatus as PrismaAttendanceStatus } from "@prisma/client";

// ─── JSON Helpers ────────────────────────────────────────

function parseSchedule(json: Prisma.JsonValue): ScheduleSlot[] {
  if (Array.isArray(json)) return json as unknown as ScheduleSlot[];
  return [];
}

function parseEnabledDays(json: Prisma.JsonValue): string[] {
  if (Array.isArray(json)) return json as unknown as string[];
  return ["MON", "TUE", "WED", "THU", "FRI"];
}

// ─── Row → Interface Mappers ─────────────────────────────

type StudentRow = Awaited<ReturnType<typeof prisma.student.findFirst>>;
type SubscriptionRow = Awaited<ReturnType<typeof prisma.subscription.findFirst>>;
type PaymentSessionRow = Awaited<ReturnType<typeof prisma.paymentSession.findFirst>>;
type AttendanceRow = Awaited<ReturnType<typeof prisma.attendance.findFirst>>;
type MemoRow = Awaited<ReturnType<typeof prisma.memo.findFirst>>;
type PendingPlanChangeRow = Awaited<ReturnType<typeof prisma.pendingPlanChange.findFirst>>;
type ScheduleOverrideRow = Awaited<ReturnType<typeof prisma.scheduleOverride.findFirst>>;

function mapStudent(r: NonNullable<StudentRow>): Student {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    parentPhone: r.parentPhone,
    school: r.school,
    grade: r.grade,
    status: r.status as StudentStatus,
    note: r.note,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function mapSubscription(r: NonNullable<SubscriptionRow>): Subscription {
  return {
    id: r.id,
    studentId: r.studentId,
    daysPerWeek: r.daysPerWeek,
    schedule: parseSchedule(r.schedule),
    startDate: r.startDate,
    endDate: r.endDate,
    monthlyFee: r.monthlyFee,
    isActive: r.isActive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function mapPaymentSession(r: NonNullable<PaymentSessionRow>): PaymentSession {
  return {
    id: r.id,
    studentId: r.studentId,
    capacity: r.capacity,
    frozen: r.frozen,
    amount: r.amount,
    method: r.method as PaymentMethod,
    daysPerWeek: r.daysPerWeek,
    monthlyFee: r.monthlyFee,
    note: r.note,
    createdAt: r.createdAt,
  };
}

function mapAttendance(r: NonNullable<AttendanceRow>): AttendanceRecord {
  return {
    id: r.id,
    studentId: r.studentId,
    date: r.date,
    status: r.status as AttendanceStatus,
    checkInAt: r.checkInAt,
    note: r.note,
    createdAt: r.createdAt,
  };
}

function mapMemo(r: NonNullable<MemoRow>): Memo {
  return {
    id: r.id,
    studentId: r.studentId,
    category: r.category as unknown as Memo["category"],
    content: r.content,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function mapPendingPlanChange(r: NonNullable<PendingPlanChangeRow>): PendingPlanChange {
  return {
    id: r.id,
    studentId: r.studentId,
    previousDaysPerWeek: r.previousDaysPerWeek,
    previousSchedule: parseSchedule(r.previousSchedule),
    previousMonthlyFee: r.previousMonthlyFee,
    frozenSessionId: r.frozenSessionId,
    recommendedAmount: r.recommendedAmount,
    isCredit: r.isCredit,
    createdAt: r.createdAt,
  };
}

function mapScheduleOverride(r: NonNullable<ScheduleOverrideRow>): ScheduleOverride {
  return {
    id: r.id,
    studentId: r.studentId,
    originalDate: r.originalDate,
    newDate: r.newDate,
    newTime: r.newTime,
    createdAt: r.createdAt,
  };
}

// ─── Batch Query: Students with Balance ──────────────────

export async function getStudentsWithBalance(filter?: StudentFilter) {
  const where: Prisma.StudentWhereInput = {};
  if (filter?.status) where.status = filter.status;
  if (filter?.search) {
    const q = filter.search;
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { school: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }

  const rows = await prisma.student.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      subscription: true,
      paymentSessions: { orderBy: { createdAt: "asc" } },
      attendances: { orderBy: { date: "asc" } },
    },
  });

  return rows.map((row) => {
    const student = mapStudent(row);
    const sub = row.subscription ? mapSubscription(row.subscription) : null;
    const sessions = row.paymentSessions.map(mapPaymentSession);
    const records = row.attendances.map(mapAttendance);
    const filling = computeFilling(sessions, records);

    const hasPaymentHistory = sessions.length > 0;
    let paymentState: PaymentState;
    if (!sub) {
      paymentState = "NO_SUBSCRIPTION";
    } else if (!hasPaymentHistory) {
      paymentState = "NEW";
    } else if (filling.remaining <= 0) {
      paymentState = "NEEDS_PAYMENT";
    } else {
      paymentState = "OK";
    }

    const currentSession = [...sessions]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .find((s) => !s.frozen) ?? sessions[sessions.length - 1] ?? null;

    let currentSessionRemaining = 0;
    if (currentSession) {
      const fs = filling.filledSessions.find((f) => f.session.id === currentSession.id);
      const used = fs?.filledCount ?? 0;
      currentSessionRemaining = Math.max(0, currentSession.capacity - used);
    }

    return {
      ...student,
      subscription: sub
        ? { daysPerWeek: sub.daysPerWeek, schedule: sub.schedule, monthlyFee: sub.monthlyFee }
        : null,
      remainingClasses: paymentState === "OK" ? currentSessionRemaining : null,
      paymentState,
    };
  });
}

// ─── CRUD Functions: Students ────────────────────────────

export async function getStudents(filter?: StudentFilter): Promise<Student[]> {
  const where: Prisma.StudentWhereInput = {};
  if (filter?.status) where.status = filter.status;
  if (filter?.search) {
    const q = filter.search;
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { school: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];
  }
  const rows = await prisma.student.findMany({ where, orderBy: { name: "asc" } });
  return rows.map(mapStudent);
}

export async function getStudentById(id: string): Promise<StudentWithRelations | null> {
  const row = await prisma.student.findUnique({
    where: { id },
    include: {
      subscription: true,
      paymentSessions: { orderBy: { createdAt: "asc" } },
      attendances: { orderBy: { date: "asc" } },
      memos: { orderBy: { createdAt: "desc" } },
      pendingPlanChange: true,
    },
  });
  if (!row) return null;

  return {
    ...mapStudent(row),
    subscription: row.subscription ? mapSubscription(row.subscription) : null,
    paymentSessions: row.paymentSessions.map(mapPaymentSession),
    attendance: row.attendances.map(mapAttendance),
    memos: row.memos.map(mapMemo),
    pendingPlanChange: row.pendingPlanChange ? mapPendingPlanChange(row.pendingPlanChange) : null,
  };
}

export async function createStudent(
  data: Omit<Student, "id" | "createdAt" | "updatedAt">,
): Promise<Student> {
  const row = await prisma.student.create({
    data: {
      name: data.name,
      phone: data.phone,
      parentPhone: data.parentPhone,
      school: data.school,
      grade: data.grade,
      status: data.status,
      note: data.note,
    },
  });
  return mapStudent(row);
}

export async function updateStudent(
  id: string,
  data: Partial<Omit<Student, "id" | "createdAt" | "updatedAt">>,
): Promise<Student | null> {
  try {
    const row = await prisma.student.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.parentPhone !== undefined && { parentPhone: data.parentPhone }),
        ...(data.school !== undefined && { school: data.school }),
        ...(data.grade !== undefined && { grade: data.grade }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.note !== undefined && { note: data.note }),
      },
    });
    return mapStudent(row);
  } catch {
    return null;
  }
}

export async function deleteStudent(id: string): Promise<boolean> {
  try {
    await prisma.student.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

// ─── CRUD Functions: Subscriptions ───────────────────────

export async function getSubscriptionByStudentId(studentId: string): Promise<Subscription | null> {
  const row = await prisma.subscription.findFirst({
    where: { studentId, isActive: true },
  });
  return row ? mapSubscription(row) : null;
}

export async function createSubscription(
  data: Omit<Subscription, "id" | "createdAt" | "updatedAt">,
): Promise<Subscription> {
  const row = await prisma.subscription.create({
    data: {
      studentId: data.studentId,
      daysPerWeek: data.daysPerWeek,
      schedule: data.schedule as unknown as Prisma.JsonArray,
      startDate: data.startDate,
      endDate: data.endDate,
      monthlyFee: data.monthlyFee,
      isActive: data.isActive,
    },
  });
  return mapSubscription(row);
}

export async function updateSubscription(
  id: string,
  data: Partial<Omit<Subscription, "id" | "createdAt" | "updatedAt">>,
): Promise<Subscription | null> {
  try {
    const row = await prisma.subscription.update({
      where: { id },
      data: {
        ...(data.daysPerWeek !== undefined && { daysPerWeek: data.daysPerWeek }),
        ...(data.schedule !== undefined && { schedule: data.schedule as unknown as Prisma.JsonArray }),
        ...(data.monthlyFee !== undefined && { monthlyFee: data.monthlyFee }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.startDate !== undefined && { startDate: data.startDate }),
        ...(data.endDate !== undefined && { endDate: data.endDate }),
      },
    });
    return mapSubscription(row);
  } catch {
    return null;
  }
}

// ─── CRUD Functions: PaymentSessions ─────────────────────

export async function getPaymentSessionsByStudentId(studentId: string): Promise<PaymentSession[]> {
  const rows = await prisma.paymentSession.findMany({
    where: { studentId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(mapPaymentSession);
}

export async function getAllPaymentSessions(): Promise<PaymentSession[]> {
  const rows = await prisma.paymentSession.findMany({
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapPaymentSession);
}

export async function createPaymentSession(data: {
  studentId: string;
  capacity: number;
  amount: number;
  method: PaymentMethod;
  daysPerWeek: number;
  monthlyFee: number;
  note: string | null;
}): Promise<PaymentSession> {
  const row = await prisma.paymentSession.create({
    data: {
      studentId: data.studentId,
      capacity: data.capacity,
      amount: data.amount,
      method: data.method,
      daysPerWeek: data.daysPerWeek,
      monthlyFee: data.monthlyFee,
      note: data.note,
    },
  });
  return mapPaymentSession(row);
}

export async function updatePaymentSession(
  id: string,
  data: Partial<Pick<PaymentSession, "capacity" | "frozen" | "amount" | "method" | "note">>,
): Promise<PaymentSession | null> {
  try {
    const row = await prisma.paymentSession.update({
      where: { id },
      data: {
        ...(data.capacity !== undefined && { capacity: data.capacity }),
        ...(data.frozen !== undefined && { frozen: data.frozen }),
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.method !== undefined && { method: data.method }),
        ...(data.note !== undefined && { note: data.note }),
      },
    });
    return mapPaymentSession(row);
  } catch {
    return null;
  }
}

export async function deletePaymentSession(id: string): Promise<boolean> {
  try {
    await prisma.paymentSession.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

// ─── CRUD Functions: Attendance ──────────────────────────

export async function getAttendanceByStudentId(studentId: string): Promise<AttendanceRecord[]> {
  const rows = await prisma.attendance.findMany({
    where: { studentId },
    orderBy: { date: "asc" },
  });
  return rows.map(mapAttendance);
}

export async function getAttendanceByDate(dateStr: string): Promise<(AttendanceRecord & { studentName: string })[]> {
  const target = new Date(dateStr + "T00:00:00+09:00");
  const nextDay = new Date(target.getTime() + 24 * 60 * 60 * 1000);

  const rows = await prisma.attendance.findMany({
    where: { date: { gte: target, lt: nextDay } },
    include: { student: { select: { name: true } } },
    orderBy: { date: "asc" },
  });

  return rows.map((r) => ({
    ...mapAttendance(r),
    studentName: r.student.name,
  }));
}

export async function createAttendance(data: {
  studentId: string;
  date: Date;
  status: AttendanceStatus;
  checkInAt: Date | null;
  note: string | null;
}): Promise<AttendanceRecord> {
  const row = await prisma.attendance.create({
    data: {
      studentId: data.studentId,
      date: data.date,
      status: data.status as PrismaAttendanceStatus,
      checkInAt: data.checkInAt,
      note: data.note,
    },
  });
  return mapAttendance(row);
}

export async function updateAttendance(
  id: string,
  data: Partial<Pick<AttendanceRecord, "status" | "checkInAt" | "note">>,
): Promise<AttendanceRecord | null> {
  try {
    const row = await prisma.attendance.update({
      where: { id },
      data: {
        ...(data.status !== undefined && { status: data.status as PrismaAttendanceStatus }),
        ...(data.checkInAt !== undefined && { checkInAt: data.checkInAt }),
        ...(data.note !== undefined && { note: data.note }),
      },
    });
    return mapAttendance(row);
  } catch {
    return null;
  }
}

export async function deleteAttendance(id: string): Promise<boolean> {
  try {
    await prisma.attendance.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

// ─── Balance Info ────────────────────────────────────────

export async function getBalanceInfo(studentId: string): Promise<BalanceInfo> {
  const sub = await getSubscriptionByStudentId(studentId);
  const sessions = await getPaymentSessionsByStudentId(studentId);
  const records = await getAttendanceByStudentId(studentId);
  const filling = computeFilling(sessions, records);

  const hasPaymentHistory = sessions.length > 0;

  let paymentState: PaymentState;
  if (!sub) {
    paymentState = "NO_SUBSCRIPTION";
  } else if (!hasPaymentHistory) {
    paymentState = "NEW";
  } else if (filling.remaining <= 0) {
    paymentState = "NEEDS_PAYMENT";
  } else {
    paymentState = "OK";
  }

  const currentSession = [...sessions]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .find((s) => !s.frozen) ?? sessions[sessions.length - 1] ?? null;

  let currentSessionUsed = 0;
  let currentSessionTotal = 0;
  let currentSessionRemaining = 0;

  if (currentSession) {
    const fs = filling.filledSessions.find((f) => f.session.id === currentSession.id);
    currentSessionUsed = fs?.filledCount ?? 0;
    currentSessionTotal = currentSession.capacity;
    currentSessionRemaining = Math.max(0, currentSessionTotal - currentSessionUsed);
  }

  return {
    remaining: filling.remaining,
    totalCapacity: filling.totalCapacity,
    totalConsuming: filling.totalConsuming,
    currentSessionUsed,
    currentSessionTotal,
    currentSessionRemaining,
    paymentState,
    hasPaymentHistory,
  };
}

// ─── Freeze & Proration ─────────────────────────────────

export async function freezeCurrentSession(studentId: string): Promise<PaymentSession | null> {
  const sessions = await getPaymentSessionsByStudentId(studentId);
  const records = await getAttendanceByStudentId(studentId);

  const activeSession = [...sessions]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .find((s) => !s.frozen);

  if (!activeSession) return null;

  const filling = computeFilling(sessions, records);
  const fs = filling.filledSessions.find((f) => f.session.id === activeSession.id);
  const usedCount = fs?.filledCount ?? 0;

  return updatePaymentSession(activeSession.id, {
    capacity: usedCount,
    frozen: true,
  });
}

// ─── Unpaid helpers ──────────────────────────────────────

export async function getUnpaidStudents(): Promise<{
  studentId: string;
  studentName: string;
  remaining: number;
  monthlyFee: number;
  capacity: number;
}[]> {
  const students = await prisma.student.findMany({
    where: { status: "ACTIVE" },
    include: {
      subscription: true,
      paymentSessions: { orderBy: { createdAt: "asc" } },
      attendances: { orderBy: { date: "asc" } },
    },
  });

  const result: {
    studentId: string;
    studentName: string;
    remaining: number;
    monthlyFee: number;
    capacity: number;
  }[] = [];

  for (const s of students) {
    const sub = s.subscription && s.subscription.isActive
      ? mapSubscription(s.subscription)
      : null;
    const sessions = s.paymentSessions.map(mapPaymentSession);
    const records = s.attendances.map(mapAttendance);

    if (!sub) continue;
    if (sessions.length === 0) continue;

    const filling = computeFilling(sessions, records);
    if (filling.remaining <= 0) {
      result.push({
        studentId: s.id,
        studentName: s.name,
        remaining: filling.remaining,
        monthlyFee: sub.monthlyFee,
        capacity: sub.daysPerWeek * 4,
      });
    }
  }

  return result;
}

export async function getUnpaidCount(): Promise<number> {
  return (await getUnpaidStudents()).length;
}

// ─── CRUD Functions: PendingPlanChanges ──────────────────

export async function createPendingPlanChange(
  data: Omit<PendingPlanChange, "id" | "createdAt">,
): Promise<PendingPlanChange> {
  const row = await prisma.pendingPlanChange.create({
    data: {
      studentId: data.studentId,
      previousDaysPerWeek: data.previousDaysPerWeek,
      previousSchedule: data.previousSchedule as unknown as Prisma.JsonArray,
      previousMonthlyFee: data.previousMonthlyFee,
      frozenSessionId: data.frozenSessionId,
      recommendedAmount: data.recommendedAmount,
      isCredit: data.isCredit,
    },
  });
  return mapPendingPlanChange(row);
}

export async function getPendingPlanChangeByStudentId(studentId: string): Promise<PendingPlanChange | null> {
  const row = await prisma.pendingPlanChange.findUnique({
    where: { studentId },
  });
  return row ? mapPendingPlanChange(row) : null;
}

export async function deletePendingPlanChange(id: string): Promise<boolean> {
  try {
    await prisma.pendingPlanChange.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export async function cancelPlanChange(studentId: string): Promise<boolean> {
  const pending = await getPendingPlanChangeByStudentId(studentId);
  if (!pending) return false;

  await prisma.$transaction(async (tx) => {
    // Unfreeze session if it was frozen
    if (pending.frozenSessionId) {
      await tx.paymentSession.update({
        where: { id: pending.frozenSessionId },
        data: { capacity: pending.previousDaysPerWeek * 4, frozen: false },
      }).catch(() => { /* session may have been deleted */ });
    }

    // Restore subscription
    const sub = await tx.subscription.findFirst({
      where: { studentId, isActive: true },
    });
    if (sub) {
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          daysPerWeek: pending.previousDaysPerWeek,
          schedule: pending.previousSchedule as unknown as Prisma.JsonArray,
          monthlyFee: pending.previousMonthlyFee,
        },
      });
    }

    // Delete pending record
    await tx.pendingPlanChange.delete({ where: { id: pending.id } });
  });

  return true;
}

// ─── CRUD Functions: Memos ───────────────────────────────

export async function getMemosByStudentId(studentId: string): Promise<Memo[]> {
  const rows = await prisma.memo.findMany({
    where: { studentId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapMemo);
}

export async function createMemo(
  data: Omit<Memo, "id" | "createdAt" | "updatedAt">,
): Promise<Memo> {
  const row = await prisma.memo.create({
    data: {
      studentId: data.studentId,
      category: data.category,
      content: data.content,
    },
  });
  return mapMemo(row);
}

// ─── Class Day Settings ─────────────────────────────────

async function ensureAppSettings() {
  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}

export async function getClassDaySettings(): Promise<ClassDaySettings> {
  await ensureAppSettings();
  const row = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  return { enabledDays: parseEnabledDays(row?.enabledDays ?? null) };
}

export async function updateClassDaySettings(enabledDays: string[]): Promise<ClassDaySettings> {
  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", enabledDays: enabledDays as unknown as Prisma.JsonArray },
    update: { enabledDays: enabledDays as unknown as Prisma.JsonArray },
  });
  return { enabledDays: [...enabledDays] };
}

// ─── Public Holidays ────────────────────────────────────

export async function getPublicHolidays(): Promise<PublicHoliday[]> {
  const rows = await prisma.publicHoliday.findMany({ orderBy: { date: "asc" } });
  return rows.map((r) => ({ date: r.date, name: r.name }));
}

export async function setPublicHolidays(holidays: PublicHoliday[]): Promise<void> {
  // Deduplicate by date (keep last occurrence)
  const deduped = new Map<string, PublicHoliday>();
  for (const h of holidays) deduped.set(h.date, h);

  await prisma.$transaction([
    prisma.publicHoliday.deleteMany(),
    prisma.publicHoliday.createMany({
      data: [...deduped.values()].map((h) => ({ date: h.date, name: h.name })),
    }),
  ]);
}

// ─── Vacation Periods ───────────────────────────────────

export async function getVacationPeriods(): Promise<VacationPeriod[]> {
  const rows = await prisma.vacationPeriod.findMany({ orderBy: { startDate: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    startDate: r.startDate,
    endDate: r.endDate,
  }));
}

export async function createVacationPeriod(
  data: Omit<VacationPeriod, "id">,
): Promise<VacationPeriod> {
  const row = await prisma.vacationPeriod.create({
    data: { name: data.name, startDate: data.startDate, endDate: data.endDate },
  });
  return { id: row.id, name: row.name, startDate: row.startDate, endDate: row.endDate };
}

export async function updateVacationPeriod(
  id: string,
  data: Partial<Omit<VacationPeriod, "id">>,
): Promise<VacationPeriod | null> {
  try {
    const row = await prisma.vacationPeriod.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.startDate !== undefined && { startDate: data.startDate }),
        ...(data.endDate !== undefined && { endDate: data.endDate }),
      },
    });
    return { id: row.id, name: row.name, startDate: row.startDate, endDate: row.endDate };
  } catch {
    return null;
  }
}

export async function deleteVacationPeriod(id: string): Promise<boolean> {
  try {
    await prisma.vacationPeriod.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

// ─── Date Status Helper ─────────────────────────────────

export async function getDateStatus(dateStr: string): Promise<DateStatus> {
  const [holiday, vacations, settings] = await Promise.all([
    prisma.publicHoliday.findUnique({ where: { date: dateStr } }),
    prisma.vacationPeriod.findMany({
      where: { startDate: { lte: dateStr }, endDate: { gte: dateStr } },
    }),
    getClassDaySettings(),
  ]);

  if (holiday) return { status: "holiday", name: holiday.name };
  if (vacations.length > 0) return { status: "vacation", name: vacations[0].name };

  const dayOfWeek = new Date(dateStr + "T00:00:00+09:00").getDay();
  const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const dayName = dayNames[dayOfWeek];
  if (!settings.enabledDays.includes(dayName)) {
    return { status: "disabled_day" };
  }

  return { status: "normal" };
}

// ─── Plans ───────────────────────────────────────────────

export async function getPlans(): Promise<Plan[]> {
  const rows = await prisma.plan.findMany({ orderBy: { daysPerWeek: "asc" } });
  return rows.map((r) => ({
    daysPerWeek: r.daysPerWeek,
    label: r.label,
    monthlyFee: r.monthlyFee,
  }));
}

export async function updatePlan(daysPerWeek: number, monthlyFee: number): Promise<Plan | null> {
  try {
    const row = await prisma.plan.update({
      where: { daysPerWeek },
      data: { monthlyFee },
    });
    return { daysPerWeek: row.daysPerWeek, label: row.label, monthlyFee: row.monthlyFee };
  } catch {
    return null;
  }
}

// ─── Schedule ────────────────────────────────────────────

export async function getWeeklySchedule(): Promise<ScheduleEntry[]> {
  const rows = await prisma.student.findMany({
    where: { status: "ACTIVE" },
    include: { subscription: true },
  });

  const entries: ScheduleEntry[] = [];
  for (const row of rows) {
    const sub = row.subscription;
    if (!sub || !sub.isActive) continue;
    const schedule = parseSchedule(sub.schedule);

    const kst = new Date(sub.startDate.getTime() + 9 * 60 * 60 * 1000);
    const startDateStr = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;

    entries.push({
      studentId: row.id,
      studentName: row.name,
      schedule,
      daysPerWeek: sub.daysPerWeek,
      startDate: startDateStr,
    });
  }

  return entries.sort((a, b) => {
    const aMin = a.schedule.length > 0 ? a.schedule.reduce((m, s) => s.time < m ? s.time : m, a.schedule[0].time) : "";
    const bMin = b.schedule.length > 0 ? b.schedule.reduce((m, s) => s.time < m ? s.time : m, b.schedule[0].time) : "";
    return aMin.localeCompare(bMin);
  });
}

// ─── Schedule Overrides ──────────────────────────────────

export async function getScheduleOverrides(studentId?: string): Promise<ScheduleOverride[]> {
  const where: Prisma.ScheduleOverrideWhereInput = {};
  if (studentId) where.studentId = studentId;
  const rows = await prisma.scheduleOverride.findMany({ where });
  return rows.map(mapScheduleOverride);
}

export async function getScheduleOverridesByDate(dateStr: string): Promise<ScheduleOverride[]> {
  const rows = await prisma.scheduleOverride.findMany({
    where: { OR: [{ originalDate: dateStr }, { newDate: dateStr }] },
  });
  return rows.map(mapScheduleOverride);
}

export async function createScheduleOverride(
  data: Omit<ScheduleOverride, "id" | "createdAt">,
): Promise<ScheduleOverride> {
  const row = await prisma.scheduleOverride.create({
    data: {
      studentId: data.studentId,
      originalDate: data.originalDate,
      newDate: data.newDate,
      newTime: data.newTime,
    },
  });
  return mapScheduleOverride(row);
}

export async function deleteScheduleOverride(id: string): Promise<boolean> {
  try {
    await prisma.scheduleOverride.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

// ─── Dashboard / Analytics ───────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const todayStr = toKSTDateStr(now);
  const todayStart = new Date(todayStr + "T00:00:00+09:00");
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthStart = new Date(currentMonth + "-01T00:00:00+09:00");
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthEnd = new Date(toKSTDateStr(nextMonth) + "T00:00:00+09:00");

  // Parallel queries
  const [
    todayRecords,
    studentCounts,
    monthSessions,
    monthRecords,
    unpaidStudents,
  ] = await Promise.all([
    prisma.attendance.findMany({
      where: { date: { gte: todayStart, lt: todayEnd } },
    }),
    prisma.student.groupBy({
      by: ["status"],
      _count: true,
    }),
    prisma.paymentSession.findMany({
      where: { createdAt: { gte: monthStart, lt: monthEnd } },
    }),
    prisma.attendance.findMany({
      where: { date: { gte: monthStart, lt: monthEnd } },
    }),
    getUnpaidStudents(),
  ]);

  const presentCount = todayRecords.filter(
    (a) => a.status === "PRESENT" || a.status === "LATE"
  ).length;

  const statusMap: Record<string, number> = {};
  for (const c of studentCounts) statusMap[c.status] = c._count;

  const paidAmount = monthSessions.reduce((sum, p) => sum + p.amount, 0);

  const attended = monthRecords.filter(
    (a) => a.status !== "ABSENT"
  ).length;
  const attendanceRate = monthRecords.length > 0
    ? Math.round((attended / monthRecords.length) * 100)
    : 0;

  // Weekly attendance
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

    const count = await prisma.attendance.count({
      where: {
        date: { gte: dayStart, lt: dayEnd },
        status: { not: "ABSENT" },
      },
    });
    weeklyAttendance.push({ day: dayLabels[i], count });
  }

  return {
    todayAttendance: { present: presentCount, total: todayRecords.length },
    totalStudents: {
      active: statusMap["ACTIVE"] ?? 0,
      paused: statusMap["PAUSED"] ?? 0,
      withdrawn: statusMap["WITHDRAWN"] ?? 0,
    },
    monthlyPayment: { paidAmount, totalCredits: paidAmount },
    attendanceRate,
    unpaidStudents,
    weeklyAttendance,
  };
}

export async function getAnalyticsData(periodMonths: number = 3): Promise<AnalyticsData> {
  const now = new Date();

  // Monthly trend
  const monthlyTrend: { month: string; rate: number }[] = [];
  for (let i = periodMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const mStart = new Date(monthStr + "-01T00:00:00+09:00");
    const mNext = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const mEnd = new Date(toKSTDateStr(mNext) + "T00:00:00+09:00");

    const monthRecords = await prisma.attendance.findMany({
      where: { date: { gte: mStart, lt: mEnd } },
    });
    const att = monthRecords.filter((a) => a.status !== "ABSENT").length;
    const rate = monthRecords.length > 0 ? Math.round((att / monthRecords.length) * 100) : 0;
    monthlyTrend.push({ month: monthStr, rate });
  }

  // Daily distribution
  const allAttendance = await prisma.attendance.findMany({
    where: { status: { not: "ABSENT" } },
    select: { date: true },
  });

  const dayMap = ["일", "월", "화", "수", "목", "금", "토"];
  const dayCounts: Record<string, number> = { "월": 0, "화": 0, "수": 0, "목": 0, "금": 0, "토": 0, "일": 0 };
  for (const a of allAttendance) {
    const dayName = dayMap[a.date.getDay()];
    dayCounts[dayName]++;
  }
  const dailyDistribution = ["월", "화", "수", "목", "금", "토", "일"].map(
    (day) => ({ day, count: dayCounts[day] })
  );

  // Student ranking
  const activeStudents = await prisma.student.findMany({
    where: { status: "ACTIVE" },
    include: { attendances: true },
  });

  const studentRanking = activeStudents
    .map((s) => {
      const presentCount = s.attendances.filter((a) => a.status !== "ABSENT").length;
      const totalCount = s.attendances.length;
      const rate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
      return { studentId: s.id, name: s.name, rate, presentCount, totalCount };
    })
    .sort((a, b) => b.rate - a.rate);

  return { monthlyTrend, dailyDistribution, studentRanking };
}

// ─── PIN (AppSettings) ───────────────────────────────────

export async function getPin(): Promise<string> {
  await ensureAppSettings();
  const row = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  return row?.pin ?? "092200";
}

export async function updatePin(newPin: string): Promise<void> {
  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", pin: newPin },
    update: { pin: newPin },
  });
}
