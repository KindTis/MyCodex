import { getCodexOverlayApi } from "./windowApi";

describe("windowApi", () => {
  afterEach(() => {
    delete window.codexOverlay;
  });

  it("window.codexOverlay가 없으면 명확한 Error를 throw한다", () => {
    expect(() => getCodexOverlayApi()).toThrow("window.codexOverlay");
  });

  it("window.codexOverlay를 반환한다", () => {
    const api = { settings: { get: vi.fn() } };
    window.codexOverlay = api as never;

    expect(getCodexOverlayApi()).toBe(api);
  });
});
