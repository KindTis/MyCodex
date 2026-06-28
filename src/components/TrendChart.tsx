import { useState } from "react";
import type { TrendPoint } from "../api";

type TrendChartProps = {
  points: TrendPoint[];
  unavailable?: boolean;
  rangeLabel: string;
};

type TrendSeries = "tokens" | "cost";

type ActivePoint = {
  index: number;
  series: TrendSeries;
};

const chartWidth = 1080;
const chartHeight = 320;
const padding = { top: 28, right: 76, bottom: 38, left: 76 };

const formatCost = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

const formatCompact = (value: number) =>
  new Intl.NumberFormat("en-US", {
    notation: value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0
  }).format(value);

const formatTokens = (value: number) => value.toLocaleString();

const seriesLabel = (series: TrendSeries) => (series === "tokens" ? "토큰" : "비용");

const pointButtonLabel = (point: TrendPoint, series: TrendSeries) =>
  `${point.date} ${seriesLabel(series)} 꼭지점 토큰 ${formatTokens(point.tokens)} 비용 ${formatCost(point.costUsd)}`;

export function TrendChart({ points, unavailable, rangeLabel }: TrendChartProps) {
  const [activePoint, setActivePoint] = useState<ActivePoint | null>(null);

  if (unavailable) {
    return <div className="empty-state">ccusage 실패로 추이를 표시할 수 없습니다.</div>;
  }

  if (!points.length) {
    return <div className="empty-state">선택한 구간의 추이 데이터가 없습니다.</div>;
  }

  const totalTokens = points.reduce((sum, point) => sum + point.tokens, 0);
  const totalCost = points.reduce((sum, point) => sum + point.costUsd, 0);
  const maxTokens = Math.max(1, ...points.map((point) => point.tokens));
  const maxCost = Math.max(0.01, ...points.map((point) => point.costUsd));
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const baseline = padding.top + plotHeight;
  const rightAxisX = chartWidth - padding.right;
  const xStep = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const yForValue = (value: number, maxValue: number) => baseline - (value / maxValue) * plotHeight;
  const coordinates = points.map((point, index) => {
    const x = padding.left + xStep * index;

    return {
      x,
      point,
      tokens: {
        value: point.tokens,
        y: yForValue(point.tokens, maxTokens)
      },
      cost: {
        value: point.costUsd,
        y: yForValue(point.costUsd, maxCost)
      }
    };
  });
  const pathForSeries = (series: TrendSeries) =>
    coordinates.map((coord, index) => `${index === 0 ? "M" : "L"} ${coord.x.toFixed(1)} ${coord[series].y.toFixed(1)}`).join(" ");
  const tokenLinePath = pathForSeries("tokens");
  const costLinePath = pathForSeries("cost");
  const tokenAreaPath = `${tokenLinePath} L ${coordinates[coordinates.length - 1].x.toFixed(1)} ${baseline} L ${coordinates[0].x.toFixed(1)} ${baseline} Z`;
  const activeCoord = activePoint ? coordinates[activePoint.index] ?? null : null;
  const activeX = activeCoord?.x ?? 0;
  const activeY = activeCoord && activePoint ? activeCoord[activePoint.series].y : 0;
  const tooltipXClass = activeCoord
    ? activeX < chartWidth * 0.16
      ? "is-left"
      : activeX > chartWidth * 0.84
        ? "is-right"
        : ""
    : "";
  const tooltipYClass = activeCoord && activeY < chartHeight * 0.24 ? "is-below" : "";
  const hideTooltip = () => setActivePoint(null);

  return (
    <div className="trend-line-chart">
      <div className="trend-summary-strip">
        <div>
          <span>주간 토큰</span>
          <strong>{formatTokens(totalTokens)}</strong>
        </div>
        <div>
          <span>주간 비용</span>
          <strong>{formatCost(totalCost)}</strong>
        </div>
        <div>
          <span>구간</span>
          <strong>
            {points[0].date.slice(5)} - {points[points.length - 1].date.slice(5)}
          </strong>
        </div>
      </div>

      <div className="trend-legend" aria-label="추이 그래프 범례">
        <span>
          <i className="trend-legend-dot tokens" />
          토큰
        </span>
        <span>
          <i className="trend-legend-dot cost" />
          비용
        </span>
      </div>

      <div className="trend-svg-frame">
        <svg
          role="img"
          aria-label={`${rangeLabel} 토큰 및 비용 추이 그래프`}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <line className="trend-axis" x1={padding.left} y1={padding.top} x2={padding.left} y2={baseline} />
          <line className="trend-axis cost" x1={rightAxisX} y1={padding.top} x2={rightAxisX} y2={baseline} />
          <line className="trend-axis" x1={padding.left} y1={baseline} x2={rightAxisX} y2={baseline} />
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = baseline - ratio * plotHeight;
            return <line className="trend-grid-line" key={ratio} x1={padding.left} y1={y} x2={rightAxisX} y2={y} />;
          })}
          <text className="trend-y-label tokens" x={padding.left - 10} y={padding.top + 4} textAnchor="end">
            {formatCompact(maxTokens)}
          </text>
          <text className="trend-y-label tokens" x={padding.left - 10} y={baseline + 4} textAnchor="end">
            0
          </text>
          <text className="trend-y-label cost" x={rightAxisX + 10} y={padding.top + 4} textAnchor="start">
            {formatCost(maxCost)}
          </text>
          <text className="trend-y-label cost" x={rightAxisX + 10} y={baseline + 4} textAnchor="start">
            $0
          </text>
          <path className="trend-area-path" d={tokenAreaPath} />
          <path className="trend-line-path trend-line-token" d={tokenLinePath} />
          <path className="trend-line-path trend-line-cost" d={costLinePath} />
          {coordinates.map((coord, index) => (
            <g key={coord.point.date} aria-hidden="true">
              <circle className="trend-point-hit-area" cx={coord.x} cy={coord.tokens.y} r="14" />
              <circle
                className={activePoint?.index === index && activePoint.series === "tokens" ? "trend-point tokens is-active" : "trend-point tokens"}
                cx={coord.x}
                cy={coord.tokens.y}
                r="5"
              />
              <circle className="trend-point-hit-area" cx={coord.x} cy={coord.cost.y} r="14" />
              <circle
                className={activePoint?.index === index && activePoint.series === "cost" ? "trend-point cost is-active" : "trend-point cost"}
                cx={coord.x}
                cy={coord.cost.y}
                r="5"
              />
            </g>
          ))}
        </svg>
        {coordinates.flatMap((coord, index) =>
          (["tokens", "cost"] as TrendSeries[]).map((series) => (
            <button
              key={`${coord.point.date}-${series}`}
              type="button"
              className="trend-point-button"
              aria-label={pointButtonLabel(coord.point, series)}
              style={{
                left: `${(coord.x / chartWidth) * 100}%`,
                top: `${(coord[series].y / chartHeight) * 100}%`
              }}
              onFocus={() => setActivePoint({ index, series })}
              onBlur={hideTooltip}
              onMouseEnter={() => setActivePoint({ index, series })}
              onMouseLeave={hideTooltip}
            />
          ))
        )}
        {activeCoord && activePoint ? (
          <div
            className={`trend-tooltip ${tooltipXClass} ${tooltipYClass}`.trim()}
            role="status"
            style={{
              left: `${(activeX / chartWidth) * 100}%`,
              top: `${(activeY / chartHeight) * 100}%`
            }}
          >
            <span>{activeCoord.point.date}</span>
            <strong>토큰: {formatTokens(activeCoord.point.tokens)}</strong>
            <strong>비용: {formatCost(activeCoord.point.costUsd)}</strong>
          </div>
        ) : null}
      </div>

      <div className="trend-date-axis">
        {points.map((point) => (
          <span key={point.date}>{point.date.slice(5)}</span>
        ))}
      </div>
    </div>
  );
}
