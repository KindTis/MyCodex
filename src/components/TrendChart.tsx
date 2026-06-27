import type { TrendPoint } from "../api";

type TrendChartProps = {
  points: TrendPoint[];
  unavailable?: boolean;
};

const formatCost = (value: number) => `$${value.toFixed(2)}`;

export function TrendChart({ points, unavailable }: TrendChartProps) {
  if (unavailable) {
    return <div className="empty-state">ccusage 실패로 추이를 표시할 수 없습니다.</div>;
  }

  const maxTokens = Math.max(1, ...points.map((point) => point.tokens));

  return (
    <div className="trend-chart">
      {points.map((point) => {
        const height = Math.max(4, Math.round((point.tokens / maxTokens) * 100));
        return (
          <div className="trend-day" key={point.date}>
            <div className="bar-wrap" aria-hidden="true">
              <div className="bar" style={{ height: `${height}%` }} />
            </div>
            <strong>{point.tokens.toLocaleString()}</strong>
            <span>{formatCost(point.costUsd)}</span>
            <small>{point.date.slice(5)}</small>
          </div>
        );
      })}
    </div>
  );
}
