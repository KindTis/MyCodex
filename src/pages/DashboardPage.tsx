import { useState } from "react";
import { LimitMeter } from "../components/LimitMeter";
import { MetricCard } from "../components/MetricCard";
import { TrendChart } from "../components/TrendChart";
import { useDashboardData } from "../useDashboardData";

const statusLabel = {
  ok: "정상",
  partial: "부분 실패",
  error: "실패"
};

const formatCost = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(value);

export function DashboardPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const { data, loading, refreshing, errorMessage, nextRefreshInSeconds, refresh } = useDashboardData(weekOffset);
  const ccusageUnavailable = Boolean(data && !data.sources.ccusage.ok);
  const limitsUnavailable = Boolean(data && !data.sources.codexAppServer.ok);
  const codexBucket = data?.limits.find((bucket) => bucket.id === "codex") ?? data?.limits[0] ?? null;
  const extraBuckets = data?.limits.filter((bucket) => bucket.id !== codexBucket?.id) ?? [];
  const rangeLabel = weekOffset === 0 ? "최근 7일" : `${weekOffset}주 전`;

  if (!data && loading) {
    return <main className="panel loading-panel">데이터를 불러오는 중입니다.</main>;
  }

  if (!data) {
    return (
      <main className="panel loading-panel">
        <p>{errorMessage ?? "대시보드 데이터를 불러오지 못했습니다."}</p>
        <button type="button" onClick={() => void refresh()}>
          다시 조회
        </button>
      </main>
    );
  }

  const sourceStatuses = [
    { title: "ccusage", status: data.sources.ccusage },
    { title: "Codex App Server", status: data.sources.codexAppServer }
  ];

  return (
    <main className="dashboard-board">
      <section className={`kpi-strip kpi-strip-${data.status}`} aria-label="대시보드 요약">
        <section className="status-metric">
          <div>
            <p className="eyebrow">시스템 상태</p>
            <div className="status-metric-title">
              <span className={`status-dot ${data.status === "ok" ? "ok" : "fail"}`} />
              <h2>{statusLabel[data.status]}</h2>
            </div>
            <span className="status-metric-note">{data.status === "ok" ? "전체 데이터 소스 정상" : "데이터 소스 확인 필요"}</span>
          </div>
          <div className="status-source-list" role="list" aria-label="데이터 소스 상태">
            {sourceStatuses.map(({ title, status }) => (
              <div className="status-source-item" role="listitem" key={title}>
                <div>
                  <span className={`status-dot ${status.ok ? "ok" : "fail"}`} />
                  <strong>{title}</strong>
                </div>
                <span>{status.ok ? "정상" : status.message ?? "실패"}</span>
              </div>
            ))}
          </div>
          <div className="status-refresh-row">
            <div>
              <span>마지막 갱신</span>
              <strong>{new Date(data.generatedAt).toLocaleString()}</strong>
            </div>
            <div>
              <span>다음 갱신</span>
              <strong>{refreshing ? "갱신 중" : `${nextRefreshInSeconds}초`}</strong>
            </div>
            <button type="button" onClick={() => void refresh()} disabled={refreshing}>
              새로고침
            </button>
          </div>
          {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        </section>
        <MetricCard
          title="오늘 토큰"
          value={(data.today?.tokens ?? 0).toLocaleString()}
          detail={data.today?.date}
          unavailable={ccusageUnavailable}
        />
        <MetricCard
          title="오늘 비용"
          value={data.today ? formatCost(data.today.costUsd) : "$0.00"}
          detail="ccusage 계산값"
          unavailable={ccusageUnavailable}
        />
      </section>

      <div className="dashboard-workspace">
        <section className="panel chart-panel">
          <div className="chart-panel-header">
            <div>
              <p className="eyebrow">Usage telemetry</p>
              <h2>사용량 추이</h2>
              <p className="muted">{rangeLabel} 기준 7일 단위</p>
            </div>
            <div className="trend-toolbar">
              <div className="week-navigation" aria-label="7일 구간 이동">
                <button type="button" aria-label="이전 7일" onClick={() => setWeekOffset((value) => value + 1)}>
                  이전 7일
                </button>
                <button type="button" aria-label="최근 7일" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>
                  최근 7일
                </button>
                <button
                  type="button"
                  aria-label="다음 7일"
                  onClick={() => setWeekOffset((value) => Math.max(0, value - 1))}
                  disabled={weekOffset === 0}
                >
                  다음 7일
                </button>
              </div>
            </div>
          </div>
          {ccusageUnavailable ? <p className="error-text">ccusage 값을 사용할 수 없습니다.</p> : null}
          <TrendChart points={data.trend} unavailable={ccusageUnavailable} rangeLabel={rangeLabel} />
        </section>

        <aside className="operations-rail" aria-label="운영 상태">
          <section className="panel limit-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Rate limits</p>
                <h2>Limit 사용률</h2>
              </div>
              {limitsUnavailable ? <p className="error-text">Codex App Server 값을 사용할 수 없습니다.</p> : null}
            </div>
            <div className="limit-grid">
              <LimitMeter title="5시간 limit" window={codexBucket?.primary ?? null} />
              <LimitMeter title="1주 limit" window={codexBucket?.secondary ?? null} />
            </div>
            {extraBuckets.length ? (
              <div className="extra-limits">
                {extraBuckets.map((bucket) => (
                  <p key={bucket.id}>
                    {bucket.name}: 5시간 {bucket.primary?.usedPercent ?? "?"}% / 1주 {bucket.secondary?.usedPercent ?? "?"}%
                  </p>
                ))}
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </main>
  );
}
