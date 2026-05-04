# 데이터 정합성 가이드

## 황금률: 데이터를 절대 추측하지 말 것
하드코딩된 기대값으로 DB를 수정하는 것은 **금지**. 반드시 원본 소스(구글 시트)에서 직접 검증한 후에만 수정.

---

## 사고 기록 (2026-04-09)

### 무슨 일이 있었나
`scripts/fix-remaining.ts`가 EXPECTED 맵에 **잘못 입력된 잔여값**으로 21명의 마지막 PaymentSession capacity를 오염시킴.

### 예시
| 학생 | EXPECTED (잘못) | 실제 (구글시트) | 보정 결과 |
|------|---------------|---------------|----------|
| 고해서 | -6 | **-7** | cap 8→9 (잘못 +1) |
| 강지윤 | -1 | **-2** | cap 8→9 (잘못 +1) |
| 이혜성 | -2 | 실제와 -7 차이 | cap 8→1 (파괴적) |
| 정예나 | -1 | 실제와 -4 차이 | cap 4→0 (파괴적) |

### 근본 원인
1. STUDENT_RAW의 `remaining` 필드를 수작업으로 입력 → 오타 발생
2. fix-remaining.ts의 EXPECTED 맵이 이 잘못된 값을 그대로 복사
3. 스크립트가 차이를 마지막 세션 capacity에 강제 반영 → 데이터 오염

### 해결
- 21건 보정 전부 되돌림 (capacity 원복, "보정" note 제거)
- `scripts/compare-sheets-vs-seed.ts`로 구글 시트 원본과 대조 → **54명 전원 일치 확인**

---

## 사고 기록 (2026-05-03)

### 무슨 일이 있었나
`import-sheets.ts`에 존재하지 않는 `5월(2026)` 월별 시트를 추가하여 4월 2025 출석 데이터가 5월 2026 날짜로 중복 임포트됨.

### 근본 원인
1. Google Sheets CSV API는 존재하지 않는 시트명 요청 시 **에러 없이 첫 번째 시트를 반환**
2. HTTP 200 응답만 보고 시트 존재를 확인 → 실제 내용(연도/월 헤더)을 검증하지 않음
3. 유령 314건의 5월 출석이 생성되어 62명 불일치 발생

### 해결
- `5월(2026)` 항목 제거
- 결제회차 칼럼 스캔을 월별 시트 수(`MONTH_SHEETS.length`)에서 고정값(`MAX_ROUND_COLS = 14`)으로 분리
- 재임포트 → 재시딩으로 데이터 복구 (56명 불일치 → 7명)

### 교훈: 새 월별 시트 추가 체크리스트
- [ ] 시트 내용의 연도/월 헤더가 기대값과 일치하는지 확인 (HTTP 200만으로 판단 금지)
- [ ] 종합출석부의 결제회차 칼럼 수와 월별 출석 시트 수는 다를 수 있음 (결제 선반영)
- [ ] 새 시트 추가 후 반드시 `compare-sheets-vs-seed.ts`로 불일치가 감소했는지 확인

---

## 데이터 정합성 규칙

### 1. 진실의 원천 (Single Source of Truth)
```
구글 시트 (원본) → sheets-data.ts (임포트) → seed.ts (DB 투입) → DB (운영)
```
- **구글 시트**가 유일한 원본. 다른 곳의 값이 다르면 구글 시트가 맞음
- DB를 직접 수정하는 스크립트 실행 전 반드시 구글 시트와 대조

### 2. capacity 수정 금지
- PaymentSession.capacity는 시드 또는 결제 API(`daysPerWeek * 4`)로만 생성
- 보정 목적으로 capacity를 임의 변경하면 데이터 전체가 오염됨
- 잔여가 안 맞으면 **원인을 추적**(누락 출석? 누락 결제?)해야지, capacity를 조작하면 안 됨

### 3. 정합성 검증 방법
```bash
# 구글 시트 vs 시드 소스 비교
npx tsx scripts/compare-sheets-vs-seed.ts

# 시드 소스 vs DB 비교
npx tsx scripts/verify-integrity.ts
```
두 스크립트 모두 "0명 불일치"여야 정상.

### 4. 잔여 회차 계산 공식
```
remaining = totalCapacity - consumingAttendance

totalCapacity = carryOver(양수만) + Σ paymentRoundCapacity - debt차감(첫 회차)
consumingAttendance = count(status IN ['PRESENT', 'LATE', 'MAKEUP'])
```
- `ABSENT`는 consuming이 아님 → 세션 용량 미소모
- `computeFilling()` (src/lib/types.ts)이 출석→세션 동적 매핑

### 5. 데이터 수정이 필요할 때 체크리스트
- [ ] 구글 시트 원본 확인 (`compare-sheets-vs-seed.ts`)
- [ ] 수정 전/후 diff를 로그로 출력
- [ ] 수정 후 `verify-integrity.ts`로 전원 검증
- [ ] 하드코딩된 기대값 사용 금지 — 반드시 구글 시트에서 동적으로 가져올 것

---

## 관련 파일
| 파일 | 용도 |
|------|------|
| `src/lib/sheets-data.ts` | 시드 원본 (CARRY_OVER, PAYMENT_ROUNDS, ATTENDANCE) |
| `prisma/seed.ts` | DB 시딩 로직 |
| `scripts/compare-sheets-vs-seed.ts` | 구글시트 ↔ 시드 비교 검증 |
| `scripts/verify-integrity.ts` | 시드 ↔ DB 비교 검증 |
| `scripts/fix-remaining.ts` | ⚠️ 위험 — 잘못된 EXPECTED 맵 포함, 실행 금지 |
| `scripts/import-sheets.ts` | 구글시트 → imported-data.ts 임포트 |

## 구글 시트 정보
- **Spreadsheet ID**: `1f68PgFP5t4wZkrTg3cgB3HojNQKlHxKf8FlKSYwQFRc`
- **종합출석부 시트**: col 0=번호, col 1=이름, col 3=이월, col 4~17=결제회차(최대 14개월), col 18=소모, col 19=용량, col 20=잔여
- **주의**: 결제회차 칼럼 수(종합출석부)와 월별 출석 시트 수는 다를 수 있음 — 결제가 선반영될 수 있기 때문
- **주의**: Google Sheets CSV API는 존재하지 않는 시트 요청 시 에러 없이 첫 번째 시트를 반환함 — 반드시 내용 검증 필요
