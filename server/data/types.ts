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

export type CcusageCostField = "totalCost" | "costUSD" | "none" | "other";

export type CcusageSummary = {
  rows: number;
  todayMatched: boolean;
  costField: CcusageCostField;
  sevenDayTokens: number;
  sevenDayCostUsd: number;
};

export type CodexAppServerSummary = {
  bucketIds: string[];
  hasCodexBucket: boolean;
  primaryWindowDurationMins: number | null;
  secondaryWindowDurationMins: number | null;
  primaryUsedPercent: number | null;
  secondaryUsedPercent: number | null;
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
    summary: CcusageSummary;
  };
  codexAppServer: {
    ok: boolean;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    summary: CodexAppServerSummary;
  };
  errors: DebugError[];
};

export type CcusageReport = {
  today: TodayUsage;
  trend: TrendPoint[];
  summary: CcusageSummary;
};

export type CodexRateLimitReport = {
  limits: LimitBucket[];
  summary: CodexAppServerSummary;
};

export const emptyCcusageSummary = (): CcusageSummary => ({
  rows: 0,
  todayMatched: false,
  costField: "none",
  sevenDayTokens: 0,
  sevenDayCostUsd: 0
});

export const emptyCodexAppServerSummary = (): CodexAppServerSummary => ({
  bucketIds: [],
  hasCodexBucket: false,
  primaryWindowDurationMins: null,
  secondaryWindowDurationMins: null,
  primaryUsedPercent: null,
  secondaryUsedPercent: null
});
