import type { LimitWindow } from "../api";

type LimitMeterProps = {
  title: string;
  window: LimitWindow | null;
};

const formatTime = (value: string | null) => (value ? new Date(value).toLocaleString() : "알 수 없음");

export function LimitMeter({ title, window }: LimitMeterProps) {
  if (!window) {
    return (
      <div className="limit-meter is-unavailable">
        <div className="meter-heading">
          <span>{title}</span>
          <strong>사용 불가</strong>
        </div>
        <div className="meter-track" />
      </div>
    );
  }

  const width = Math.max(0, Math.min(100, window.usedPercent));

  return (
    <div className="limit-meter">
      <div className="meter-heading">
        <span>{title}</span>
        <strong>{window.usedPercent.toFixed(1)}%</strong>
      </div>
      <div className="meter-track" aria-hidden="true">
        <div className="meter-fill" style={{ width: `${width}%` }} />
      </div>
      <p>Reset: {formatTime(window.resetsAt)}</p>
    </div>
  );
}
