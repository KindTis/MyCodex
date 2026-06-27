import { useState } from "react";
import { LimitMeter } from "../components/LimitMeter";
import { MetricCard } from "../components/MetricCard";
import { SourceStatusPanel } from "../components/SourceStatusPanel";
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
  const [trendMetric, setTrendMetric] = useState<"tokens" | "cost">("tokens");
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

  return (
    <main className="dashboard-grid">
      <section className="panel summary-panel">
        <div>
          <p className="eyebrow">상태</p>
          <h2>{statusLabel[data.status]}</h2>
          <p>마지막 갱신: {new Date(data.generatedAt).toLocaleString()}</p>
          {refreshing ? <p className="muted">갱신 중입니다.</p> : <p className="muted">다음 자동 갱신까지 {nextRefreshInSeconds}초</p>}
          {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        </div>
        <button type="button" onClick={() => void refresh()} disabled={refreshing}>
          새로고침
        </button>
      </section>

      <div className="metric-row">
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
      </div>

      <section className="panel">
        <div className="section-heading">
          <h2>Limit 사용률</h2>
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

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>사용량 추이</h2>
            <p className="muted">{rangeLabel} 기준 7일 단위</p>
          </div>
          {ccusageUnavailable ? <p className="error-text">ccusage 값을 사용할 수 없습니다.</p> : null}
        </div>
        <div className="trend-toolbar">
          <div className="segmented-control" aria-label="추이 지표 선택">
            <button
              type="button"
              className={trendMetric === "tokens" ? "is-active" : ""}
              onClick={() => setTrendMetric("tokens")}
            >
              토큰
            </button>
            <button
              type="button"
              className={trendMetric === "cost" ? "is-active" : ""}
              onClick={() => setTrendMetric("cost")}
            >
              비용
            </button>
          </div>
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
        <TrendChart points={data.trend} unavailable={ccusageUnavailable} metric={trendMetric} rangeLabel={rangeLabel} />
      </section>

      <div className="source-grid">
        <SourceStatusPanel title="ccusage" status={data.sources.ccusage} />
        <SourceStatusPanel title="Codex App Server" status={data.sources.codexAppServer} />
      </div>
    </main>
  );
}
