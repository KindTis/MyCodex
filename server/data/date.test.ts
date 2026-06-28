import { getLocalDateKey, isValidLocalDateKey } from "./date.js";

describe("local date helpers", () => {
  it("정확한 YYYY-MM-DD 실제 날짜만 유효하게 처리한다", () => {
    expect(isValidLocalDateKey("2026-06-08")).toBe(true);
    expect(isValidLocalDateKey("2026-6-8")).toBe(false);
    expect(isValidLocalDateKey("2026-02-30")).toBe(false);
    expect(isValidLocalDateKey("")).toBe(false);
  });

  it("getLocalDateKey는 로컬 생성자 기준 날짜를 반환한다", () => {
    expect(getLocalDateKey(new Date(2026, 5, 28, 0, 30, 0))).toBe("2026-06-28");
  });
});
