import { type CSSProperties, type FormEvent, useEffect, useState } from "react";
import { DEFAULT_OVERLAY_SETTINGS, type SettingsUpdateResult } from "../../shared/overlaySettings";
import { getCodexOverlayApi } from "./windowApi";

function panelAlpha(panelAlphaPercent: number): number {
  return panelAlphaPercent / 100;
}

export function SettingsDialog() {
  const api = getCodexOverlayApi();
  const [panelAlphaPercent, setPanelAlphaPercent] = useState(DEFAULT_OVERLAY_SETTINGS.panelAlphaPercent);
  const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState(DEFAULT_OVERLAY_SETTINGS.refreshIntervalSeconds);
  const [showResetAsRemainingTime, setShowResetAsRemainingTime] = useState(
    DEFAULT_OVERLAY_SETTINGS.showResetAsRemainingTime
  );
  const [result, setResult] = useState<SettingsUpdateResult | null>(null);

  useEffect(() => {
    let mounted = true;
    api.settings.get().then((settings) => {
      if (!mounted) {
        return;
      }
      setPanelAlphaPercent(settings.panelAlphaPercent);
      setRefreshIntervalSeconds(settings.refreshIntervalSeconds);
      setShowResetAsRemainingTime(settings.showResetAsRemainingTime);
    });

    return () => {
      mounted = false;
    };
  }, [api]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!("update" in api.settings)) {
      setResult({ ok: false, fieldErrors: {}, formError: "설정을 저장할 수 없습니다." });
      return;
    }

    const nextResult = await api.settings.update({
      panelAlphaPercent,
      refreshIntervalSeconds,
      showResetAsRemainingTime
    });
    setResult(nextResult);
    if (nextResult.ok) {
      window.close();
    }
  }

  return (
    <main className="settings-panel" style={{ "--panel-alpha": String(panelAlpha(panelAlphaPercent)) } as CSSProperties}>
      <form onSubmit={(event) => void save(event)}>
        <header>
          <h1>Overlay settings</h1>
        </header>
        <label>
          <span>Panel opacity</span>
          <input
            aria-label="Panel opacity"
            type="range"
            min={20}
            max={100}
            value={panelAlphaPercent}
            onChange={(event) => setPanelAlphaPercent(Number(event.currentTarget.value))}
          />
          <output>{panelAlphaPercent}%</output>
        </label>
        {!result?.ok && result?.fieldErrors.panelAlphaPercent ? (
          <p className="field-error">{result.fieldErrors.panelAlphaPercent}</p>
        ) : null}
        <label>
          <span>Refresh interval</span>
          <input
            aria-label="Refresh interval"
            type="number"
            min={5}
            max={300}
            step={1}
            value={refreshIntervalSeconds}
            onChange={(event) => setRefreshIntervalSeconds(Number(event.currentTarget.value))}
          />
        </label>
        {!result?.ok && result?.fieldErrors.refreshIntervalSeconds ? (
          <p className="field-error">{result.fieldErrors.refreshIntervalSeconds}</p>
        ) : null}
        <label className="checkbox-field">
          <span>Display reset as remaining time</span>
          <input
            aria-label="Display reset as remaining time"
            type="checkbox"
            checked={showResetAsRemainingTime}
            onChange={(event) => setShowResetAsRemainingTime(event.currentTarget.checked)}
          />
        </label>
        {!result?.ok && result?.fieldErrors.showResetAsRemainingTime ? (
          <p className="field-error">{result.fieldErrors.showResetAsRemainingTime}</p>
        ) : null}
        {!result?.ok && result?.formError ? <p className="form-error">{result.formError}</p> : null}
        <footer>
          <button type="button" onClick={() => window.close()}>
            Cancel
          </button>
          <button type="submit">Save</button>
        </footer>
      </form>
    </main>
  );
}
