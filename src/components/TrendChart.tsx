import type { TrendPoint } from "../api";

type TrendChartProps = {
  points: TrendPoint[];
  unavailable?: boolean;
  metric: "tokens" | "cost";
  rangeLabel: string;
};

const chartWidth = 700;
const chartHeight = 260;
const padding = { top: 24, right: 24, bottom: 32, left: 52 };

const formatCost = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

const formatCompact = (value: number) =>
  new Intl.NumberFormat("en-US", {
    notation: value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0
  }).format(value);

const formatValue = (value: number, metric: "tokens" | "cost") =>
  metric === "tokens" ? value.toLocaleString() : formatCost(value);

const valueForMetric = (point: TrendPoint, metric: "tokens" | "cost") =>
  metric === "tokens" ? point.tokens : point.costUsd;

export function TrendChart({ points, unavailable, metric, rangeLabel }: TrendChartProps) {
  if (unavailable) {
    return <div className="empty-state">ccusage 실패로 추이를 표시할 수 없습니다.</div>;
  }

  if (!points.length) {
    return <div className="empty-state">선택한 구간의 추이 데이터가 없습니다.</div>;
  }

  const metricLabel = metric === "tokens" ? "토큰" : "비용";
  const values = points.map((point) => valueForMetric(point, metric));
  const total = values.reduce((sum, value) => sum + value, 0);
  const maxValue = Math.max(1, ...values);
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const baseline = padding.top + plotHeight;
  const xStep = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const coordinates = values.map((value, index) => {
    const x = padding.left + xStep * index;
    const y = baseline - (value / maxValue) * plotHeight;
    return { x, y, value, point: points[index] };
  });
  const linePath = coordinates.map((coord, index) => `${index === 0 ? "M" : "L"} ${coord.x.toFixed(1)} ${coord.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${coordinates[coordinates.length - 1].x.toFixed(1)} ${baseline} L ${coordinates[0].x.toFixed(1)} ${baseline} Z`;

  return (
    <div className="trend-line-chart">
      <div className="trend-summary-strip">
        <div>
          <span>주간 {metricLabel}</span>
          <strong>{formatValue(total, metric)}</strong>
        </div>
        <div>
          <span>최고 일간 {metricLabel}</span>
          <strong>{formatValue(maxValue, metric)}</strong>
        </div>
        <div>
          <span>구간</span>
          <strong>{points[0].date.slice(5)} - {points[points.length - 1].date.slice(5)}</strong>
        </div>
      </div>

      <div className="trend-svg-frame">
        <svg
          role="img"
          aria-label={`${rangeLabel} ${metricLabel} 추이 그래프`}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="none"
        >
          <line className="trend-axis" x1={padding.left} y1={padding.top} x2={padding.left} y2={baseline} />
          <line className="trend-axis" x1={padding.left} y1={baseline} x2={chartWidth - padding.right} y2={baseline} />
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = baseline - ratio * plotHeight;
            return <line className="trend-grid-line" key={ratio} x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y} />;
          })}
          <text className="trend-y-label" x={padding.left - 10} y={padding.top + 4} textAnchor="end">
            {formatCompact(maxValue)}
          </text>
          <text className="trend-y-label" x={padding.left - 10} y={baseline + 4} textAnchor="end">
            0
          </text>
          <path className="trend-area-path" d={areaPath} />
          <path className="trend-line-path" d={linePath} />
          {coordinates.map((coord) => (
            <g key={coord.point.date}>
              <circle className="trend-point" cx={coord.x} cy={coord.y} r="5">
                <title>
                  {coord.point.date}: {formatValue(coord.value, metric)}
                </title>
              </circle>
            </g>
          ))}
        </svg>
      </div>

      <div className="trend-date-axis">
        {points.map((point) => (
          <span key={point.date}>{point.date.slice(5)}</span>
        ))}
      </div>
    </div>
  );
}
