type MetricCardProps = {
  title: string;
  value: string;
  detail?: string;
  unavailable?: boolean;
};

export function MetricCard({ title, value, detail, unavailable }: MetricCardProps) {
  return (
    <section className={`metric-card ${unavailable ? "is-unavailable" : ""}`}>
      <p>{title}</p>
      <strong>{unavailable ? "사용 불가" : value}</strong>
      {detail ? <span>{detail}</span> : null}
    </section>
  );
}
