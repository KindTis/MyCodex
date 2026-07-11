import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_OVERLAY_SETTINGS, type OverlaySettings } from "../../shared/overlaySettings";
import { toUsageSnapshotViewModel, type UsageSnapshotViewModel } from "../../shared/usageSnapshot";
import { getCodexOverlayApi } from "./windowApi";

const pendingViewModel = toUsageSnapshotViewModel({ kind: "pending" });

function panelAlpha(settings: OverlaySettings): number {
  return settings.panelAlphaPercent / 100;
}

export function OverlayApp() {
  const [settings, setSettings] = useState<OverlaySettings>(DEFAULT_OVERLAY_SETTINGS);
  const [snapshot, setSnapshot] = useState<UsageSnapshotViewModel>(pendingViewModel);
  const intervalRef = useRef<number | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const api = getCodexOverlayApi();

  const clearPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const fetchSnapshot = useCallback(async () => {
    if (!("usage" in api) || inFlight.current) {
      return;
    }

    inFlight.current = true;
    try {
      const response = await api.usage.getSnapshot();
      if (mounted.current) {
        setSnapshot(toUsageSnapshotViewModel({ kind: "response", response }));
      }
    } catch {
      if (mounted.current) {
        setSnapshot(toUsageSnapshotViewModel({ kind: "exception", caughtAt: new Date() }));
      }
    } finally {
      inFlight.current = false;
    }
  }, [api]);

  const startPolling = useCallback(
    (refreshIntervalSeconds: number) => {
      clearPolling();
      intervalRef.current = window.setInterval(() => {
        void fetchSnapshot();
      }, refreshIntervalSeconds * 1000);
    },
    [clearPolling, fetchSnapshot]
  );

  useEffect(() => {
    mounted.current = true;
    void fetchSnapshot();

    api.settings
      .get()
      .then((nextSettings) => {
        if (!mounted.current) {
          return;
        }
        setSettings(nextSettings);
        startPolling(nextSettings.refreshIntervalSeconds);
      })
      .catch(() => {
        if (!mounted.current) {
          return;
        }
        setSettings(DEFAULT_OVERLAY_SETTINGS);
        startPolling(DEFAULT_OVERLAY_SETTINGS.refreshIntervalSeconds);
      });

    const unsubscribe =
      "onChanged" in api.settings
        ? api.settings.onChanged((nextSettings) => {
            if (!mounted.current) {
              return;
            }
            setSettings(nextSettings);
            startPolling(nextSettings.refreshIntervalSeconds);
          })
        : undefined;

    return () => {
      mounted.current = false;
      clearPolling();
      unsubscribe?.();
    };
  }, [api, clearPolling, fetchSnapshot, startPolling]);

  return (
    <main
      className={`overlay-panel tone-${snapshot.statusTone}`}
      style={{ "--panel-alpha": String(panelAlpha(settings)) } as React.CSSProperties}
    >
      <div className="status-spine" aria-hidden="true" />
      <header className="overlay-header">
        <span className={`status-dot tone-${snapshot.statusTone}`} />
        <strong>CODEX USAGE</strong>
        <time>{snapshot.updatedAtText}</time>
      </header>
      <section className="metric-row">
        <span>TODAY TOKENS</span>
        <strong>{snapshot.todayTokensText}</strong>
      </section>
      <section className="metric-row">
        <span>TODAY COST</span>
        <strong>{snapshot.todayCostText}</strong>
      </section>
      <section className="limit-row">
        <div>
          <span className="limit-label">
            5H LIMIT <span className="reset-time">(RESET {snapshot.fiveHourResetText})</span>
          </span>
          <strong>{snapshot.fiveHourLimitText}</strong>
        </div>
        <progress max={100} value={snapshot.fiveHourLimitFillPercent} aria-label="5H LIMIT" />
      </section>
      <section className="limit-row">
        <div>
          <span className="limit-label">
            1W LIMIT <span className="reset-time">(RESET {snapshot.oneWeekResetText})</span>
          </span>
          <strong>{snapshot.oneWeekLimitText}</strong>
        </div>
        <progress max={100} value={snapshot.oneWeekLimitFillPercent} aria-label="1W LIMIT" />
      </section>
    </main>
  );
}
