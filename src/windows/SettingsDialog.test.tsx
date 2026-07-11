import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SettingsDialog } from "./SettingsDialog";

function installSettingsApi(
  updateResult: unknown = {
    ok: true,
    settings: { panelAlphaPercent: 70, refreshIntervalSeconds: 20, showResetAsRemainingTime: true }
  }
) {
  const get = vi.fn(() =>
    Promise.resolve({ panelAlphaPercent: 70, refreshIntervalSeconds: 20, showResetAsRemainingTime: true })
  );
  const update = vi.fn(() => Promise.resolve(updateResult));
  window.codexOverlay = { settings: { get, update } };
  return { get, update };
}

describe("SettingsDialog", () => {
  const close = vi.fn();
  let closeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    closeSpy = vi.spyOn(window, "close").mockImplementation(close);
  });

  afterEach(() => {
    closeSpy.mockRestore();
    delete window.codexOverlay;
    close.mockReset();
  });

  it("mount 시 settings.get으로 초기값을 채운다", async () => {
    const api = installSettingsApi();

    render(<SettingsDialog />);

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    expect((screen.getByLabelText("Panel opacity") as HTMLInputElement).value).toBe("70");
    expect((screen.getByLabelText("Refresh interval") as HTMLInputElement).value).toBe("20");
  });

  it("slider와 number 표시가 panelAlphaPercent 값을 공유한다", async () => {
    installSettingsApi();
    render(<SettingsDialog />);
    await waitFor(() => expect((screen.getByLabelText("Panel opacity") as HTMLInputElement).value).toBe("70"));

    fireEvent.change(screen.getByLabelText("Panel opacity"), { target: { value: "55" } });

    expect(screen.getByText("55%")).toBeTruthy();
  });

  it("설정창 배경 투명도가 panelAlphaPercent 값을 따라간다", async () => {
    installSettingsApi();
    render(<SettingsDialog />);
    const panel = screen.getByRole("main");

    await waitFor(() => expect(panel.style.getPropertyValue("--panel-alpha")).toBe("0.7"));

    fireEvent.change(screen.getByLabelText("Panel opacity"), { target: { value: "55" } });

    expect(panel.style.getPropertyValue("--panel-alpha")).toBe("0.55");
  });

  it("저장된 상대 시간 표시 옵션으로 checkbox를 초기화한다", async () => {
    installSettingsApi();
    render(<SettingsDialog />);

    await waitFor(() =>
      expect((screen.getByLabelText("Display reset as remaining time") as HTMLInputElement).checked).toBe(true)
    );
  });

  it("상대 시간 표시 옵션을 기존 설정과 함께 저장한다", async () => {
    const api = installSettingsApi();
    render(<SettingsDialog />);
    const checkbox = await screen.findByLabelText("Display reset as remaining time");

    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith({
        panelAlphaPercent: 70,
        refreshIntervalSeconds: 20,
        showResetAsRemainingTime: false
      })
    );
  });

  it("저장 성공 시 초 단위 정수를 보내고 window.close를 호출한다", async () => {
    const api = installSettingsApi();
    render(<SettingsDialog />);
    await waitFor(() => expect((screen.getByLabelText("Refresh interval") as HTMLInputElement).value).toBe("20"));

    fireEvent.change(screen.getByLabelText("Refresh interval"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith({
        panelAlphaPercent: 70,
        refreshIntervalSeconds: 30,
        showResetAsRemainingTime: true
      })
    );
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("field error가 있으면 표시하고 창을 닫지 않는다", async () => {
    installSettingsApi({ ok: false, fieldErrors: { refreshIntervalSeconds: "5-300 사이 정수여야 합니다." } });
    render(<SettingsDialog />);
    await waitFor(() => expect((screen.getByLabelText("Refresh interval") as HTMLInputElement).value).toBe("20"));

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByText("5-300 사이 정수여야 합니다.")).toBeTruthy());
    expect(close).not.toHaveBeenCalled();
  });

  it("form error가 있으면 표시하고 창을 닫지 않는다", async () => {
    installSettingsApi({ ok: false, fieldErrors: {}, formError: "저장 실패" });
    render(<SettingsDialog />);
    await waitFor(() => expect((screen.getByLabelText("Refresh interval") as HTMLInputElement).value).toBe("20"));

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByText("저장 실패")).toBeTruthy());
    expect(close).not.toHaveBeenCalled();
  });

  it("Cancel은 settings.update 없이 window.close를 호출한다", async () => {
    const api = installSettingsApi();
    render(<SettingsDialog />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.update).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
