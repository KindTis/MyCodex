import { render, screen, waitFor } from "@testing-library/react";
import { DashboardPage } from "./DashboardPage";
import type { DashboardResponse } from "../api";

const partialDashboard: DashboardResponse = {
  generatedAt: "2026-06-26T00:00:00.000Z",
  status: "partial",
  today: null,
  trend: [],
  limits: [
    {
      id: "codex",
      name: "Codex",
      planType: "pro",
      primary: { label: "5h", usedPercent: 12, resetsAt: null, windowDurationMins: 300 },
      secondary: { label: "1w", usedPercent: 3, resetsAt: null, windowDurationMins: 10080 }
    }
  ],
  sources: {
    ccusage: {
      ok: false,
      message: "ccusage fixture 실패",
      checkedAt: "2026-06-26T00:00:00.000Z"
    },
    codexAppServer: {
      ok: true,
      message: null,
      checkedAt: "2026-06-26T00:00:00.000Z"
    }
  }
};

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(partialDashboard)
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("부분 실패 상태와 성공한 limit 영역을 함께 표시한다", async () => {
    render(<DashboardPage />);

    await waitFor(() => expect(screen.getByText("부분 실패")).toBeTruthy());

    expect(screen.getByText("오늘 토큰")).toBeTruthy();
    expect(screen.getAllByText("사용 불가").length).toBeGreaterThan(0);
    expect(screen.getByText("5시간 limit")).toBeTruthy();
    expect(screen.getByText("12.0%")).toBeTruthy();
    expect(screen.getByText("ccusage fixture 실패")).toBeTruthy();
  });
});
