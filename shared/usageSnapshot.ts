import type { DashboardResponse, LimitBucket, LimitWindow } from "./dashboardTypes.js";

export type UsageSnapshotInput =
  | { kind: "pending" }
  | { kind: "response"; response: DashboardResponse }
  | { kind: "exception"; caughtAt: Date };

export type UsageSnapshotOptions = {
  showResetAsRemainingTime?: boolean;
  now?: Date;
};

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

function resetPrefix(showResetAsRemainingTime: boolean): "RESET" | "NEXT" {
  return showResetAsRemainingTime ? "NEXT" : "RESET";
}

const unavailableModel = (
  statusTone: UsageSnapshotViewModel["statusTone"],
  updatedAtText: string,
  showResetAsRemainingTime = false
) => ({
  statusTone,
  todayTokensText: unavailable,
  todayCostText: unavailable,
  fiveHourLimitText: unavailable,
  fiveHourLimitFillPercent: 0,
  fiveHourResetText: `${resetPrefix(showResetAsRemainingTime)} ${unavailable}`,
  oneWeekLimitText: unavailable,
  oneWeekLimitFillPercent: 0,
  oneWeekResetText: `${resetPrefix(showResetAsRemainingTime)} ${unavailable}`,
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

function padTwo(value: number): string {
  return String(value).padStart(2, "0");
}

function remainingResetText(totalMinutes: number, label: LimitWindow["label"]): string {
  if (label === "5h") {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${padTwo(hours)}:${padTwo(minutes)}`;
  }

  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  return `${days}:${padTwo(hours)}:${padTwo(minutes)}`;
}

function resetText(
  window: LimitWindow | null | undefined,
  label: LimitWindow["label"],
  showResetAsRemainingTime: boolean,
  now: Date
): string {
  const prefix = resetPrefix(showResetAsRemainingTime);
  if (!window?.resetsAt) {
    return `${prefix} ${unavailable}`;
  }

  const resetsAt = new Date(window.resetsAt);
  if (!Number.isFinite(resetsAt.getTime())) {
    return `${prefix} ${unavailable}`;
  }

  if (!showResetAsRemainingTime) {
    return `${prefix} ${resetTimeFormatter.format(resetsAt).replace(",", "")}`;
  }

  const totalMinutes = Math.max(0, Math.floor((resetsAt.getTime() - now.getTime()) / 60_000));
  return `${prefix} ${remainingResetText(totalMinutes, label)}`;
}

function codexBucket(response: DashboardResponse): LimitBucket | null {
  return response.sources.codexAppServer.ok ? response.limits.find((bucket) => bucket.id === "codex") ?? null : null;
}

export function toUsageSnapshotViewModel(
  input: UsageSnapshotInput,
  options: UsageSnapshotOptions = {}
): UsageSnapshotViewModel {
  const showResetAsRemainingTime = options.showResetAsRemainingTime ?? false;
  const now = options.now ?? new Date();

  if (input.kind === "pending") {
    return unavailableModel("pending", pendingTime, showResetAsRemainingTime);
  }

  if (input.kind === "exception") {
    return unavailableModel("fail", formatTime(input.caughtAt), showResetAsRemainingTime);
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
    fiveHourResetText: resetText(bucket?.primary, "5h", showResetAsRemainingTime, now),
    oneWeekLimitText: limitText(bucket?.secondary),
    oneWeekLimitFillPercent: limitFill(bucket?.secondary),
    oneWeekResetText: resetText(bucket?.secondary, "1w", showResetAsRemainingTime, now),
    updatedAtText: formatTime(new Date(response.generatedAt))
  };
}
