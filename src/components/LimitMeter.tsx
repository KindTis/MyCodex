import type { LimitWindow } from "../api";

type LimitMeterProps = {
  title: string;
  window: LimitWindow | null;
  unavailableText?: string;
};

const formatTime = (value: string | null) => (value ? new Date(value).toLocaleString() : "알 수 없음");

export function LimitMeter({ title, window, unavailableText = "-" }: LimitMeterProps) {
  if (!window) {
    return (
      <div className="limit-meter is-unavailable">
        <div className="meter-heading">
          <span>{title}</span>
          <strong>{unavailableText}</strong>
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
