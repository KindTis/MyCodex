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

export type TodayUsage = TrendPoint;

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
  today: TodayUsage | null;
  trend: TrendPoint[];
  limits: LimitBucket[];
  sources: Record<SourceName, SourceStatus>;
};

export type DashboardRequest = {
  weekOffset?: number;
};

export type DebugError = {
  at: string;
  source: SourceName;
  message: string;
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
  errors: DebugError[];
};
