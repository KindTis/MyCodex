import { render, screen, waitFor } from "@testing-library/react";
import { DebugPage } from "./DebugPage";
import type { DebugResponse } from "../api";

const debug: DebugResponse = {
  generatedAt: "2026-06-26T00:00:00.000Z",
  ccusage: {
    ok: true,
    lastSuccessAt: "2026-06-26T00:00:00.000Z",
    lastFailureAt: null,
    summary: {
      rows: 1,
      todayMatched: true,
      costField: "totalCost",
      sevenDayTokens: 100,
      sevenDayCostUsd: 0.1
    }
  },
  codexAppServer: {
    ok: false,
    lastSuccessAt: null,
    lastFailureAt: "2026-06-26T00:00:00.000Z",
    summary: {
      bucketIds: [],
      hasCodexBucket: false,
      primaryWindowDurationMins: null,
      secondaryWindowDurationMins: null,
      primaryUsedPercent: null,
      secondaryUsedPercent: null
    }
  },
  errors: [{ at: "2026-06-26T00:00:00.000Z", source: "codexAppServer", message: "마스킹된 오류" }]
};

describe("DebugPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(debug)
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("파싱 요약과 최근 에러 로그만 표시한다", async () => {
    render(<DebugPage />);

    await waitFor(() => expect(screen.getByText("ccusage 파싱 요약")).toBeTruthy());

    expect(screen.getByText("Codex App Server 요약")).toBeTruthy();
    expect(screen.getByText("최근 에러 로그")).toBeTruthy();
    expect(screen.getByText("마스킹된 오류")).toBeTruthy();
    expect(screen.queryByText("secret")).toBeNull();
  });
});
