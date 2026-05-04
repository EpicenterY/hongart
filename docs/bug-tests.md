# 버그 테스트 기록

## BUG-001: Google Sheets CSV API — 존재하지 않는 시트 요청 시 첫 번째 시트 반환 (2026-05-03)

### 증상
`import-sheets.ts`에 `5월(2026)` 시트를 추가했으나, 실제로는 해당 시트가 스프레드시트에 존재하지 않았음.
Google Sheets CSV API가 존재하지 않는 시트명을 요청하면 **에러 없이 HTTP 200 + 첫 번째 시트 데이터**를 반환.

### 영향
- 4월 2025 출석 데이터가 5월 2026 날짜로 중복 임포트됨
- 4175건 출석 (정상 3861건 + 유령 314건)
- 62명 불일치 발생

### 재현 방법
```bash
# 존재하지 않는 시트명으로 요청 → 첫 번째 시트(4월 2025) 반환
curl -s "https://docs.google.com/spreadsheets/d/SHEET_ID/gviz/tq?tqx=out:csv&sheet=NONEXISTENT" | head -3
```

### 수정
- `import-sheets.ts`에서 `5월(2026)` 항목 제거
- 결제회차 칼럼 스캔을 `MONTH_SHEETS.length`에서 `MAX_ROUND_COLS = 14`로 분리 (종합출석부 결제칼럼 수 ≠ 월별 출석시트 수)
- 재임포트 → 재시딩으로 데이터 복구

### 교훈
- Google Sheets CSV API는 존재하지 않는 시트에 대해 에러를 반환하지 않음
- 새 시트 추가 전 반드시 내용을 검증해야 함 (연도/월 헤더 확인)
- 결제회차(종합출석부 칼럼)와 출석시트(월별 탭)는 독립적으로 관리해야 함
