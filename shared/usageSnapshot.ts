import type { DashboardResponse, LimitBucket, LimitWindow } from "./dashboardTypes.js";

export type UsageSnapshotInput =
  | { kind: "pending" }
  | { kind: "response"; response: DashboardResponse }
  | { kind: "exception"; caughtAt: Date };

export type UsageSnapshotViewModel = {
  statusTone: "pending" | "ok" | "fail";
  todayTokensText: string;
  todayCostText: string;
  fiveHourLimitText: string;
  fiveHourLimitFillPercent: number;
  fiveHourResetText: string;
  oneWeekLimitText: string;
  oneWeekLimitFillPercent: number;
  oneWeekResetText: string;
  updatedAtText: string;
};

const unavailable = "--";
const pendingTime = "--:--:--";
const resetTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

const unavailableModel = (statusTone: UsageSnapshotViewModel["statusTone"], updatedAtText: string) => ({
  statusTone,
  todayTokensText: unavailable,
  todayCostText: unavailable,
  fiveHourLimitText: unavailable,
  fiveHourLimitFillPercent: 0,
  fiveHourResetText: unavailable,
  oneWeekLimitText: unavailable,
  oneWeekLimitFillPercent: 0,
  oneWeekResetText: unavailable,
  updatedAtText
});

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(
    date.getSeconds()
  ).padStart(2, "0")}`;
}

function formatTokens(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function formatCost(value: number): string {
  return `$${value.toFixed(4)}`;
}

function limitText(window: LimitWindow | null | undefined): string {
  if (!window || typeof window.usedPercent !== "number" || !Number.isFinite(window.usedPercent)) {
    return unavailable;
  }

  return `${Math.round(window.usedPercent)}%`;
}

function limitFill(window: LimitWindow | null | undefined): number {
  if (!window || typeof window.usedPercent !== "number" || !Number.isFinite(window.usedPercent)) {
    return 0;
  }

  return Math.max(0, Math.min(100, window.usedPercent));
}

function resetText(window: LimitWindow | null | undefined): string {
  if (!window?.resetsAt) {
    return unavailable;
  }

  return resetTimeFormatter.format(new Date(window.resetsAt)).replace(",", "");
}

function codexBucket(response: DashboardResponse): LimitBucket | null {
  return response.sources.codexAppServer.ok ? response.limits.find((bucket) => bucket.id === "codex") ?? null : null;
}

export function toUsageSnapshotViewModel(input: UsageSnapshotInput): UsageSnapshotViewModel {
  if (input.kind === "pending") {
    return unavailableModel("pending", pendingTime);
  }

  if (input.kind === "exception") {
    return unavailableModel("fail", formatTime(input.caughtAt));
  }

  const { response } = input;
  const statusTone = response.sources.ccusage.ok && response.sources.codexAppServer.ok ? "ok" : "fail";
  const todayTokensText =
    response.sources.ccusage.ok && response.today ? formatTokens(response.today.tokens) : unavailable;
  const todayCostText = response.sources.ccusage.ok && response.today ? formatCost(response.today.costUsd) : unavailable;
  const bucket = codexBucket(response);

  return {
    statusTone,
    todayTokensText,
    todayCostText,
    fiveHourLimitText: limitText(bucket?.primary),
    fiveHourLimitFillPercent: limitFill(bucket?.primary),
    fiveHourResetText: resetText(bucket?.primary),
    oneWeekLimitText: limitText(bucket?.secondary),
    oneWeekLimitFillPercent: limitFill(bucket?.secondary),
    oneWeekResetText: resetText(bucket?.secondary),
    updatedAtText: formatTime(new Date(response.generatedAt))
  };
}
