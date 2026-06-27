export type SourceName = "ccusage" | "codexAppServer";
export type DashboardStatus = "ok" | "partial" | "error";

export type SourceStatus = {
  ok: boolean;
  message: string | null;
  checkedAt: string;
};

export type TrendPoint = {
  date: string;
  tokens: number;
  costUsd: number;
};

export type LimitWindow = {
  label: "5h" | "1w";
  usedPercent: number;
  resetsAt: string | null;
  windowDurationMins: number | null;
};

export type LimitBucket = {
  id: string;
  name: string;
  planType: string | null;
  primary: LimitWindow | null;
  secondary: LimitWindow | null;
};

export type DashboardResponse = {
  generatedAt: string;
  status: DashboardStatus;
  today: TrendPoint | null;
  trend: TrendPoint[];
  limits: LimitBucket[];
  sources: Record<SourceName, SourceStatus>;
};

export type DebugResponse = {
  generatedAt: string;
  ccusage: {
    ok: boolean;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    summary: {
      rows: number;
      todayMatched: boolean;
      costField: "totalCost" | "costUSD" | "none" | "other";
      sevenDayTokens: number;
      sevenDayCostUsd: number;
    };
  };
  codexAppServer: {
    ok: boolean;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    summary: {
      bucketIds: string[];
      hasCodexBucket: boolean;
      primaryWindowDurationMins: number | null;
      secondaryWindowDurationMins: number | null;
      primaryUsedPercent: number | null;
      secondaryUsedPercent: number | null;
    };
  };
  errors: Array<{
    at: string;
    source: SourceName;
    message: string;
  }>;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`요청 실패: ${response.status}`);
  }

  return (await response.json()) as T;
}

export function fetchDashboard(weekOffset = 0): Promise<DashboardResponse> {
  const url = weekOffset > 0 ? `/api/dashboard?weekOffset=${encodeURIComponent(String(weekOffset))}` : "/api/dashboard";
  return fetchJson<DashboardResponse>(url);
}

export function fetchDebug(): Promise<DebugResponse> {
  return fetchJson<DebugResponse>("/api/debug");
}
