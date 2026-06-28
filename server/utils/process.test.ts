import { runProcess } from "./process.js";

describe("runProcess", () => {
  it("child가 spawn된 직후 onChild를 한 번 호출한다", async () => {
    const onChild = vi.fn();

    const result = await runProcess(process.execPath, ["-e", "process.stdout.write('ok')"], { onChild });

    expect(result.stdout).toBe("ok");
    expect(onChild).toHaveBeenCalledTimes(1);
    expect(onChild.mock.calls[0][0].pid).toEqual(expect.any(Number));
  });
});
