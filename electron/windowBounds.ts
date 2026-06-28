import type { WindowPosition } from "../shared/overlaySettings.js";

export const OVERLAY_WIDTH = 280;
export const OVERLAY_HEIGHT = 188;
export const DEFAULT_WINDOW_OFFSET = 24;

export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DisplayLike = {
  workArea: Bounds;
};

export type ResolvedOverlayBounds = {
  bounds: Bounds;
  adjusted: boolean;
  reason: "saved" | "default" | "outside-work-area";
};

export function defaultOverlayBounds(primaryDisplay: DisplayLike): Bounds {
  const { workArea } = primaryDisplay;
  return {
    x: workArea.x + workArea.width - OVERLAY_WIDTH - DEFAULT_WINDOW_OFFSET,
    y: workArea.y + DEFAULT_WINDOW_OFFSET,
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT
  };
}

export function boundsWithinWorkArea(bounds: Bounds, display: DisplayLike): boolean {
  const { workArea } = display;
  return (
    bounds.x >= workArea.x &&
    bounds.y >= workArea.y &&
    bounds.x + bounds.width <= workArea.x + workArea.width &&
    bounds.y + bounds.height <= workArea.y + workArea.height
  );
}

export function resolveOverlayBounds(options: {
  savedPosition?: WindowPosition;
  targetDisplay: DisplayLike;
  primaryDisplay: DisplayLike;
}): ResolvedOverlayBounds {
  if (!options.savedPosition) {
    return { bounds: defaultOverlayBounds(options.primaryDisplay), adjusted: false, reason: "default" };
  }

  const savedBounds = {
    x: options.savedPosition.x,
    y: options.savedPosition.y,
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT
  };

  if (boundsWithinWorkArea(savedBounds, options.targetDisplay)) {
    return { bounds: savedBounds, adjusted: false, reason: "saved" };
  }

  return { bounds: defaultOverlayBounds(options.primaryDisplay), adjusted: true, reason: "outside-work-area" };
}
