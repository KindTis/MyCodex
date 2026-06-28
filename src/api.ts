import type { DashboardResponse, DebugResponse } from "../shared/dashboardTypes";

export type { DashboardResponse, DebugResponse } from "../shared/dashboardTypes";

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
