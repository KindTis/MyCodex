import { registerOverlayContextMenu } from "./contextMenu.js";

describe("contextMenu", () => {
  it("overlay context-menu 이벤트에서 native Menu를 만들고 popup한다", () => {
    let handler: (() => void) | null = null;
    const openDashboard = vi.fn();
    const openSettings = vi.fn();
    const quit = vi.fn();
    const popup = vi.fn();
    const buildFromTemplate = vi.fn((items) => {
      items[0].click();
      items[1].click();
      items[2].click();
      return { popup };
    });

    registerOverlayContextMenu({
      webContents: { on: vi.fn((_event, nextHandler) => (handler = nextHandler)) },
      menu: { buildFromTemplate },
      openDashboard,
      openSettings,
      quit
    });
    handler?.();

    expect(buildFromTemplate).toHaveBeenCalledWith([
      { label: "대시 보드", click: openDashboard },
      { label: "설정", click: openSettings },
      { label: "나가기", click: quit }
    ]);
    expect(popup).toHaveBeenCalledTimes(1);
    expect(openDashboard).toHaveBeenCalledTimes(1);
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(quit).toHaveBeenCalledTimes(1);
  });
});
