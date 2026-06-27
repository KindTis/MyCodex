import path from "node:path";
import { getLocalDateKey, getLocalDateKeysForWeekOffset } from "./date.js";
import type { CcusageCostField, CcusageReport, DashboardRequest, TrendPoint } from "./types.js";
import { parseJsonStdout, runProcess } from "../utils/process.js";

type RawCcusageRow = Record<string, unknown>;

function getRows(payload: unknown): RawCcusageRow[] {
  if (Array.isArray(payload)) {
    return payload as RawCcusageRow[];
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("ccusage daily JSON이 객체가 아닙니다.");
  }

  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.daily)) {
    return record.daily as RawCcusageRow[];
  }

  if (record.daily && typeof record.daily === "object" && Array.isArray((record.daily as Record<string, unknown>).data)) {
    return (record.daily as Record<string, unknown>).data as RawCcusageRow[];
  }

  if (Array.isArray(record.data)) {
    return record.data as RawCcusageRow[];
  }

  throw new Error("ccusage daily row 배열을 찾지 못했습니다.");
}

function readNumber(row: RawCcusageRow, field: string): number | null {
  const value = row[field];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function detectCostField(rows: RawCcusageRow[]): CcusageCostField {
  if (rows.some((row) => typeof row.totalCost === "number")) {
    return "totalCost";
  }

  if (rows.some((row) => typeof row.costUSD === "number")) {
    return "costUSD";
  }

  return rows.length === 0 ? "none" : "other";
}

function normalizeRow(row: RawCcusageRow, costField: CcusageCostField): TrendPoint {
  if (typeof row.date !== "string") {
    throw new Error("ccusage row의 date 필드가 올바르지 않습니다.");
  }

  const tokens = readNumber(row, "totalTokens");
  if (tokens === null) {
    throw new Error("ccusage row의 totalTokens 필드가 올바르지 않습니다.");
  }

  const cost =
    costField === "totalCost"
      ? readNumber(row, "totalCost")
      : costField === "costUSD"
        ? readNumber(row, "costUSD")
        : null;

  if (cost === null) {
    throw new Error("ccusage row의 비용 필드를 찾지 못했습니다.");
  }

  return {
    date: row.date,
    tokens,
    costUsd: cost
  };
}

export function parseCcusageDaily(payload: unknown, now = new Date(), options: DashboardRequest = {}): CcusageReport {
  const rows = getRows(payload);
  const costField = detectCostField(rows);
  const normalized = new Map<string, TrendPoint>();

  if (costField === "other") {
    throw new Error("지원하지 않는 ccusage 비용 필드입니다.");
  }

  for (const row of rows) {
    const point = normalizeRow(row, costField);
    normalized.set(point.date, point);
  }

  const dateKeys = getLocalDateKeysForWeekOffset(now, options.weekOffset ?? 0, 7);
  const trend = dateKeys.map((date) => normalized.get(date) ?? { date, tokens: 0, costUsd: 0 });
  const todayKey = getLocalDateKey(now);
  const today = normalized.get(todayKey) ?? { date: todayKey, tokens: 0, costUsd: 0 };

  return {
    today,
    trend,
    summary: {
      rows: rows.length,
      todayMatched: normalized.has(todayKey),
      costField,
      sevenDayTokens: trend.reduce((total, point) => total + point.tokens, 0),
      sevenDayCostUsd: trend.reduce((total, point) => total + point.costUsd, 0)
    }
  };
}

export function getCcusageProcessSpec(cwd = process.cwd(), nodePath = process.execPath): { command: string; args: string[] } {
  return {
    command: nodePath,
    args: [path.resolve(cwd, "node_modules", "ccusage", "src", "cli.js"), "codex", "daily", "--json"]
  };
}

export async function readCcusageDaily(options: DashboardRequest = {}): Promise<CcusageReport> {
  const spec = getCcusageProcessSpec();
  const result = await runProcess(spec.command, spec.args, { timeoutMs: 20_000 });

  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `ccusage가 종료 코드 ${result.exitCode}로 실패했습니다.`);
  }

  return parseCcusageDaily(parseJsonStdout(result.stdout), new Date(), options);
}
