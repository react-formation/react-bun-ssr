export interface RunProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface RunProcessOptions {
  cmd: string[];
  cwd: string;
  env?: Record<string, string | undefined>;
}

export interface SpawnProcessOptions extends RunProcessOptions {
  stdout?: "pipe" | "inherit" | "ignore";
  stderr?: "pipe" | "inherit" | "ignore";
}

export function spawnProcess(options: SpawnProcessOptions): Bun.Subprocess {
  return Bun.spawn({
    cmd: options.cmd,
    cwd: options.cwd,
    env: {
      ...process.env,
      ...options.env,
    },
    stdout: options.stdout ?? "pipe",
    stderr: options.stderr ?? "pipe",
  });
}

function readProcessStream(stream: number | ReadableStream<Uint8Array> | null | undefined): Promise<string> {
  if (!stream || typeof stream === "number") {
    return Promise.resolve("");
  }

  return new Response(stream).text();
}

export async function runProcess(options: RunProcessOptions): Promise<RunProcessResult> {
  const subprocess = spawnProcess(options);
  const [stdout, stderr, exitCode] = await Promise.all([
    readProcessStream(subprocess.stdout),
    readProcessStream(subprocess.stderr),
    subprocess.exited,
  ]);

  return {
    exitCode,
    stdout,
    stderr,
  };
}

export async function waitForHttpReady(
  url: string,
  options: {
    timeoutMs?: number;
    intervalMs?: number;
  } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const intervalMs = options.intervalMs ?? 100;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // ignore until timeout
    }

    await Bun.sleep(intervalMs);
  }

  throw new Error(`Timed out waiting for ${url}`);
}
