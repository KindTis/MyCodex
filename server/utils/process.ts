import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";

export type ProcessResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type RunProcessOptions = {
  cwd?: string;
  timeoutMs?: number;
  input?: string;
  onChild?: (child: ChildProcess) => void;
};

export type NodeCommandOptions = {
  isElectronRuntime?: boolean;
  npmNodeExecPath?: string;
};

export function resolveNodeCommand(nodePath = process.execPath, options: NodeCommandOptions = {}): string {
  const isElectronRuntime =
    options.isElectronRuntime ?? Boolean((process.versions as NodeJS.ProcessVersions & { electron?: string }).electron);

  if (!isElectronRuntime) {
    return nodePath;
  }

  return options.npmNodeExecPath || "node";
}

export function runProcess(
  command: string,
  args: string[],
  options: RunProcessOptions = {}
): Promise<ProcessResult> {
  const timeoutMs = options.timeoutMs ?? 20_000;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    options.onChild?.(child);

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill();
      reject(new Error(`명령 실행 시간이 ${timeoutMs}ms를 초과했습니다.`));
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (exitCode) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: exitCode ?? 0 });
    });

    if (options.input) {
      child.stdin.write(options.input);
    }
    child.stdin.end();
  });
}

export function parseJsonStdout(stdout: string): unknown {
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error("명령 출력 JSON을 파싱하지 못했습니다.");
  }
}
