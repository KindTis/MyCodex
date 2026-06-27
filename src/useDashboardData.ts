import { useCallback, useEffect, useRef, useState } from "react";
import { DashboardResponse, fetchDashboard } from "./api";

const REFRESH_INTERVAL_MS = 60_000;

export function useDashboardData(weekOffset = 0) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nextRefreshInSeconds, setNextRefreshInSeconds] = useState(60);
  const dataRef = useRef<DashboardResponse | null>(null);
  const inFlight = useRef(false);
  const nextRefreshAt = useRef(Date.now() + REFRESH_INTERVAL_MS);

  const refresh = useCallback(async () => {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setErrorMessage(null);
    if (dataRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const nextData = await fetchDashboard(weekOffset);
      dataRef.current = nextData;
      setData(nextData);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "대시보드 데이터를 불러오지 못했습니다.");
    } finally {
      nextRefreshAt.current = Date.now() + REFRESH_INTERVAL_MS;
      setNextRefreshInSeconds(60);
      setLoading(false);
      setRefreshing(false);
      inFlight.current = false;
    }
  }, [weekOffset]);

  useEffect(() => {
    void refresh();
    const pollingId = window.setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);
    const countdownId = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((nextRefreshAt.current - Date.now()) / 1000));
      setNextRefreshInSeconds(remaining);
    }, 1000);

    return () => {
      window.clearInterval(pollingId);
      window.clearInterval(countdownId);
    };
  }, [refresh]);

  return {
    data,
    loading,
    refreshing,
    errorMessage,
    nextRefreshInSeconds,
    refresh
  };
}
