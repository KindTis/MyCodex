import { useEffect, useState } from "react";
import { DebugResponse, fetchDebug } from "../api";

const sourceLabel = {
  ccusage: "ccusage",
  codexAppServer: "Codex App Server"
};

const formatTime = (value: string | null) => (value ? new Date(value).toLocaleString() : "없음");

export function DebugPage() {
  const [data, setData] = useState<DebugResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchDebug()
      .then((nextData) => {
        if (mounted) {
          setData(nextData);
        }
      })
      .catch((nextError) => {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : "디버그 데이터를 불러오지 못했습니다.");
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return <main className="panel loading-panel">{error}</main>;
  }

  if (!data) {
    return <main className="panel loading-panel">디버그 데이터를 불러오는 중입니다.</main>;
  }

  return (
    <main className="debug-board">
      <section className="panel debug-command">
        <div>
          <p className="eyebrow">Diagnostics</p>
          <h2>데이터 파이프라인 상태</h2>
          <p className="muted">생성: {new Date(data.generatedAt).toLocaleString()}</p>
        </div>
        <div className="debug-status-strip" aria-label="디버그 소스 상태">
          <span className={`pill ${data.ccusage.ok ? "ok" : "fail"}`}>ccusage {data.ccusage.ok ? "정상" : "실패"}</span>
          <span className={`pill ${data.codexAppServer.ok ? "ok" : "fail"}`}>
            Codex App Server {data.codexAppServer.ok ? "정상" : "실패"}
          </span>
        </div>
      </section>

      <section className="debug-summary-grid" aria-label="파싱 요약">
        <article className="panel debug-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Usage parser</p>
              <h2>ccusage 파싱 요약</h2>
            </div>
          </div>
          <dl className="debug-list">
            <dt>파싱 row 수</dt>
            <dd>{data.ccusage.summary.rows}</dd>
            <dt>오늘 row 존재</dt>
            <dd>{data.ccusage.summary.todayMatched ? "예" : "아니오"}</dd>
            <dt>비용 필드</dt>
            <dd>{data.ccusage.summary.costField}</dd>
            <dt>최근 7일 토큰</dt>
            <dd>{data.ccusage.summary.sevenDayTokens.toLocaleString()}</dd>
            <dt>최근 7일 비용</dt>
            <dd>${data.ccusage.summary.sevenDayCostUsd.toFixed(4)}</dd>
            <dt>마지막 성공</dt>
            <dd>{formatTime(data.ccusage.lastSuccessAt)}</dd>
            <dt>마지막 실패</dt>
            <dd>{formatTime(data.ccusage.lastFailureAt)}</dd>
          </dl>
        </article>

        <article className="panel debug-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Limit parser</p>
              <h2>Codex App Server 요약</h2>
            </div>
          </div>
          <dl className="debug-list">
            <dt>bucket id</dt>
            <dd>{data.codexAppServer.summary.bucketIds.join(", ") || "없음"}</dd>
            <dt>Codex bucket</dt>
            <dd>{data.codexAppServer.summary.hasCodexBucket ? "있음" : "없음"}</dd>
            <dt>5시간 window</dt>
            <dd>{data.codexAppServer.summary.primaryWindowDurationMins ?? "없음"}분</dd>
            <dt>1주 window</dt>
            <dd>{data.codexAppServer.summary.secondaryWindowDurationMins ?? "없음"}분</dd>
            <dt>5시간 사용률</dt>
            <dd>{data.codexAppServer.summary.primaryUsedPercent ?? "없음"}%</dd>
            <dt>1주 사용률</dt>
            <dd>{data.codexAppServer.summary.secondaryUsedPercent ?? "없음"}%</dd>
            <dt>마지막 성공</dt>
            <dd>{formatTime(data.codexAppServer.lastSuccessAt)}</dd>
            <dt>마지막 실패</dt>
            <dd>{formatTime(data.codexAppServer.lastFailureAt)}</dd>
          </dl>
        </article>
      </section>

      <section className="panel debug-log-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Recent failures</p>
            <h2>최근 에러 로그</h2>
          </div>
        </div>
        {data.errors.length ? (
          <div className="error-log">
            {data.errors.map((item, index) => (
              <article key={`${item.at}-${item.source}-${index}`}>
                <strong>{sourceLabel[item.source]}</strong>
                <span>{new Date(item.at).toLocaleString()}</span>
                <p>{item.message}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">최근 에러가 없습니다.</p>
        )}
      </section>
    </main>
  );
}
