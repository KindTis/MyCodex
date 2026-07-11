export type WindowPosition = {
  x: number;
  y: number;
};

export type OverlaySettings = {
  panelAlphaPercent: number;
  refreshIntervalSeconds: number;
  showResetAsRemainingTime: boolean;
  windowPosition?: WindowPosition;
};

export type SettingsUpdateInput = {
  panelAlphaPercent: number;
  refreshIntervalSeconds: number;
  showResetAsRemainingTime: boolean;
};

export type SettingsUpdateResult =
  | { ok: true; settings: OverlaySettings }
  | {
      ok: false;
      formError?: string;
      fieldErrors: {
        panelAlphaPercent?: string;
        refreshIntervalSeconds?: string;
        showResetAsRemainingTime?: string;
      };
    };

export const DEFAULT_OVERLAY_SETTINGS: OverlaySettings = {
  panelAlphaPercent: 50,
  refreshIntervalSeconds: 30,
  showResetAsRemainingTime: false
};

export const OVERLAY_SETTINGS_LIMITS = {
  panelAlphaPercent: { min: 20, max: 100 },
  refreshIntervalSeconds: { min: 5, max: 300 }
} as const;

export type SettingsUpdateValidation =
  | { ok: true; input: SettingsUpdateInput }
  | {
      ok: false;
      formError?: string;
      fieldErrors: {
        panelAlphaPercent?: string;
        refreshIntervalSeconds?: string;
        showResetAsRemainingTime?: string;
      };
    };

export type NormalizedSettings = {
  settings: OverlaySettings;
  changed: boolean;
  reasons: string[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= min && value <= max;
}

function isWindowPosition(value: unknown): value is WindowPosition {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    Number.isInteger(value.x) &&
    typeof value.y === "number" &&
    Number.isFinite(value.y) &&
    Number.isInteger(value.y)
  );
}

export function validateSettingsUpdateInput(value: unknown): SettingsUpdateValidation {
  if (!isPlainObject(value)) {
    return { ok: false, fieldErrors: {}, formError: "설정 값이 올바르지 않습니다." };
  }

  const allowedKeys = new Set(["panelAlphaPercent", "refreshIntervalSeconds", "showResetAsRemainingTime"]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
    return { ok: false, fieldErrors: {}, formError: "알 수 없는 설정 값이 있습니다." };
  }

  const fieldErrors: SettingsUpdateValidation extends infer T
    ? T extends { ok: false; fieldErrors: infer TErrors }
      ? TErrors
      : never
    : never = {};

  if (
    !isIntegerInRange(
      value.panelAlphaPercent,
      OVERLAY_SETTINGS_LIMITS.panelAlphaPercent.min,
      OVERLAY_SETTINGS_LIMITS.panelAlphaPercent.max
    )
  ) {
    fieldErrors.panelAlphaPercent = "20-100 사이 정수여야 합니다.";
  }

  if (
    !isIntegerInRange(
      value.refreshIntervalSeconds,
      OVERLAY_SETTINGS_LIMITS.refreshIntervalSeconds.min,
      OVERLAY_SETTINGS_LIMITS.refreshIntervalSeconds.max
    )
  ) {
    fieldErrors.refreshIntervalSeconds = "5-300 사이 정수여야 합니다.";
  }

  if (typeof value.showResetAsRemainingTime !== "boolean") {
    fieldErrors.showResetAsRemainingTime = "true 또는 false여야 합니다.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    input: {
      panelAlphaPercent: value.panelAlphaPercent as number,
      refreshIntervalSeconds: value.refreshIntervalSeconds as number,
      showResetAsRemainingTime: value.showResetAsRemainingTime as boolean
    }
  };
}

export function normalizeStoredSettings(value: unknown): NormalizedSettings {
  if (!isPlainObject(value)) {
    return { settings: { ...DEFAULT_OVERLAY_SETTINGS }, changed: true, reasons: ["malformed settings"] };
  }

  const reasons: string[] = [];
  const settings: OverlaySettings = { ...DEFAULT_OVERLAY_SETTINGS };

  if (
    isIntegerInRange(
      value.panelAlphaPercent,
      OVERLAY_SETTINGS_LIMITS.panelAlphaPercent.min,
      OVERLAY_SETTINGS_LIMITS.panelAlphaPercent.max
    )
  ) {
    settings.panelAlphaPercent = value.panelAlphaPercent;
  } else if (Object.prototype.hasOwnProperty.call(value, "panelAlphaPercent")) {
    reasons.push("panelAlphaPercent normalized");
  }

  if (
    isIntegerInRange(
      value.refreshIntervalSeconds,
      OVERLAY_SETTINGS_LIMITS.refreshIntervalSeconds.min,
      OVERLAY_SETTINGS_LIMITS.refreshIntervalSeconds.max
    )
  ) {
    settings.refreshIntervalSeconds = value.refreshIntervalSeconds;
  } else if (Object.prototype.hasOwnProperty.call(value, "refreshIntervalSeconds")) {
    reasons.push("refreshIntervalSeconds normalized");
  }

  if (typeof value.showResetAsRemainingTime === "boolean") {
    settings.showResetAsRemainingTime = value.showResetAsRemainingTime;
  } else if (Object.prototype.hasOwnProperty.call(value, "showResetAsRemainingTime")) {
    reasons.push("showResetAsRemainingTime normalized");
  }

  if (Object.prototype.hasOwnProperty.call(value, "windowPosition")) {
    if (isWindowPosition(value.windowPosition)) {
      settings.windowPosition = { x: value.windowPosition.x, y: value.windowPosition.y };
    } else {
      reasons.push("windowPosition removed");
    }
  }

  return { settings, changed: reasons.length > 0, reasons };
}

export function settingsUpdateFailure(formError: string): SettingsUpdateResult {
  return { ok: false, fieldErrors: {}, formError };
}
