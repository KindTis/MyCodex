import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

const okDashboard: DashboardResponse = {
  generatedAt: "2026-06-26T00:00:00.000Z",
  status: "ok",
  today: { date: "2026-06-26", tokens: 10, costUsd: 0.01 },
  trend: [
    { date: "2026-06-20", tokens: 100, costUsd: 0.01 },
    { date: "2026-06-21", tokens: 200, costUsd: 0.02 },
    { date: "2026-06-22", tokens: 300, costUsd: 0.03 },
    { date: "2026-06-23", tokens: 400, costUsd: 0.04 },
    { date: "2026-06-24", tokens: 500, costUsd: 0.05 },
    { date: "2026-06-25", tokens: 600, costUsd: 0.06 },
    { date: "2026-06-26", tokens: 700, costUsd: 0.07 }
  ],
  limits: [],
  sources: {
    ccusage: {
      ok: true,
      message: null,
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
    const sourceStatusList = screen.getByRole("list", { name: "데이터 소스 상태" });
    expect(within(sourceStatusList).getByText("ccusage")).toBeTruthy();
    expect(within(sourceStatusList).getByText("ccusage fixture 실패")).toBeTruthy();
    expect(within(sourceStatusList).getByText("Codex App Server")).toBeTruthy();
    expect(within(sourceStatusList).getByText("정상")).toBeTruthy();
    const dashboardSummary = screen.getByLabelText("대시보드 요약");
    expect(within(dashboardSummary).getByText("마지막 갱신")).toBeTruthy();
    expect(within(dashboardSummary).getByText("다음 갱신")).toBeTruthy();
    expect(within(dashboardSummary).getByRole("button", { name: "새로고침" })).toBeTruthy();
  });

  it("Line/Area 추이에서 토큰과 비용을 함께 표시하고 이전 7일을 조회한다", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(okDashboard)
    } as Response);

    render(<DashboardPage />);

    await waitFor(() => expect(screen.getByLabelText("최근 7일 토큰 및 비용 추이 그래프")).toBeTruthy());
    expect(screen.getByLabelText("최근 7일 토큰 및 비용 추이 그래프")).toBeTruthy();
    expect(screen.getByText("주간 토큰")).toBeTruthy();
    expect(screen.getByText("2,800")).toBeTruthy();
    expect(screen.getByText("주간 비용")).toBeTruthy();
    expect(screen.getByText("$0.28")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "비용" })).toBeNull();

    fireEvent.mouseEnter(screen.getByLabelText("2026-06-26 비용 꼭지점 토큰 700 비용 $0.07"));
    expect(screen.getByRole("status").textContent).toContain("2026-06-26");
    expect(screen.getByRole("status").textContent).toContain("토큰: 700");
    expect(screen.getByRole("status").textContent).toContain("비용: $0.07");
    fireEvent.mouseLeave(screen.getByLabelText("2026-06-26 비용 꼭지점 토큰 700 비용 $0.07"));
    expect(screen.queryByRole("status")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "이전 7일" }));
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith("/api/dashboard?weekOffset=1"));
    expect((screen.getByRole("button", { name: "다음 7일" }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "최근 7일" }));
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith("/api/dashboard"));
    expect((screen.getByRole("button", { name: "다음 7일" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
