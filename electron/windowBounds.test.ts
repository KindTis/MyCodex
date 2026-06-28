import { defaultOverlayBounds, resolveOverlayBounds } from "./windowBounds.js";

const primaryDisplay = { workArea: { x: 0, y: 0, width: 1920, height: 1080 } };

describe("windowBounds", () => {
  it("저장된 bounds 전체가 target workArea 안에 있으면 그대로 복원한다", () => {
    expect(
      resolveOverlayBounds({ savedPosition: { x: 100, y: 100 }, targetDisplay: primaryDisplay, primaryDisplay })
    ).toEqual({ bounds: { x: 100, y: 100, width: 280, height: 188 }, adjusted: false, reason: "saved" });
  });

  it("좌, 상, 우, 하 중 하나라도 벗어나면 기본 위치로 보정한다", () => {
    for (const savedPosition of [
      { x: -1, y: 100 },
      { x: 100, y: -1 },
      { x: 1700, y: 100 },
      { x: 100, y: 1000 }
    ]) {
      expect(resolveOverlayBounds({ savedPosition, targetDisplay: primaryDisplay, primaryDisplay })).toEqual({
        bounds: defaultOverlayBounds(primaryDisplay),
        adjusted: true,
        reason: "outside-work-area"
      });
    }
  });

  it("기본 위치는 primary display 오른쪽 위 24px offset이다", () => {
    expect(defaultOverlayBounds(primaryDisplay)).toEqual({ x: 1616, y: 24, width: 280, height: 188 });
  });
});
