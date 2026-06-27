import type { SourceStatus } from "../api";

type SourceStatusPanelProps = {
  title: string;
  status: SourceStatus;
};

export function SourceStatusPanel({ title, status }: SourceStatusPanelProps) {
  return (
    <section className="source-panel">
      <div>
        <span className={`status-dot ${status.ok ? "ok" : "fail"}`} />
        <strong>{title}</strong>
      </div>
      <p>{status.ok ? "정상" : status.message ?? "실패"}</p>
      <small>확인: {new Date(status.checkedAt).toLocaleString()}</small>
    </section>
  );
}
