export type {
  DashboardRequest,
  DashboardResponse,
  DashboardStatus,
  DebugError,
  DebugResponse,
  LimitBucket,
  LimitWindow,
  SourceName,
  SourceStatus,
  TodayUsage,
  TrendPoint
} from "../../shared/dashboardTypes.js";

import type { LimitBucket, SourceName, TodayUsage, TrendPoint } from "../../shared/dashboardTypes.js";

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
