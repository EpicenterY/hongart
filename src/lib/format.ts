/** 날짜를 한국어 형식으로 포맷 (예: 2024년 3월 15일) */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** 날짜를 짧은 형식으로 포맷 (예: 3/15) */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 날짜를 YYYY-MM-DD 형식으로 포맷 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

/** 금액을 한국 원화 형식으로 포맷 (예: ₩150,000) */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
  }).format(amount);
}

/** 요일 한국어 매핑 */
export const DAY_LABELS: Record<string, string> = {
  MON: "월",
  TUE: "화",
  WED: "수",
  THU: "목",
  FRI: "금",
  SAT: "토",
  SUN: "일",
};

/** 시간을 HH:MM 형식으로 포맷 */
export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
