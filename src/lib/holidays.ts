import { getPublicHolidays, setPublicHolidays } from "./db";
import type { PublicHoliday } from "./types";

const API_BASE =
  "http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo";

const MAX_YEAR = 2027;

let lastUpdatedAt: string | null = null;

interface HolidayItem {
  dateName: string;
  locdate: number;
  isHoliday: string;
}

async function fetchFromAPI(year: number): Promise<PublicHoliday[] | null> {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) return null;

  try {
    const url = new URL(API_BASE);
    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("solYear", String(year));
    url.searchParams.set("numOfRows", "50");
    url.searchParams.set("_type", "json");

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;

    const json = await res.json();
    const items = json?.response?.body?.items?.item;
    if (!items) return null;

    const list: HolidayItem[] = Array.isArray(items) ? items : [items];

    return list
      .filter((item) => item.isHoliday === "Y")
      .map((item) => {
        const s = String(item.locdate);
        const date = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
        return { date, name: item.dateName };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return null;
  }
}

async function fetchAllYears(): Promise<PublicHoliday[]> {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear - 1; y <= MAX_YEAR; y++) {
    years.push(y);
  }

  const results = await Promise.all(years.map((y) => fetchFromAPI(y)));
  const all: PublicHoliday[] = [];
  for (const result of results) {
    if (result) all.push(...result);
  }
  return all.sort((a, b) => a.date.localeCompare(b.date));
}

// 초기화 여부 추적
let initialized = false;

/**
 * 데이터가 비어있으면 자동으로 API에서 가져와 저장합니다.
 */
export async function ensureHolidaysLoaded(): Promise<void> {
  if (initialized) return;

  const existing = await getPublicHolidays();
  if (existing.length > 0) {
    initialized = true;
    return;
  }

  const data = await fetchAllYears();
  if (data.length > 0) {
    await setPublicHolidays(data);
    lastUpdatedAt = new Date().toISOString();
  }
  initialized = true;
}

/**
 * 저장된 공휴일 데이터를 반환합니다.
 */
export async function getHolidays(year?: number): Promise<PublicHoliday[]> {
  await ensureHolidaysLoaded();
  const all = await getPublicHolidays();
  if (year) return all.filter((h) => h.date.startsWith(String(year)));
  return all;
}

/**
 * 마지막 업데이트 일시를 반환합니다.
 */
export function getLastUpdatedAt(): string | null {
  return lastUpdatedAt;
}

/**
 * 사용자가 수동으로 업데이트를 요청할 때 호출합니다.
 * 현재 연도 ~ 2027년 데이터를 새로 가져와 전체 교체합니다.
 */
export async function refreshHolidays(): Promise<PublicHoliday[] | null> {
  const data = await fetchAllYears();
  if (data.length === 0) return null;

  await setPublicHolidays(data);
  lastUpdatedAt = new Date().toISOString();
  initialized = true;

  return data;
}
