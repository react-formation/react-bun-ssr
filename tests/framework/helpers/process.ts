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
    process?: Bun.Subprocess | null;
  } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const intervalMs = options.intervalMs ?? 100;
  const processRef = options.process ?? null;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (processRef && typeof processRef.exitCode === "number") {
      const [stdout, stderr] = await Promise.all([
        readProcessStream(processRef.stdout),
        readProcessStream(processRef.stderr),
      ]);
      const diagnostics = [
        `Process exited before ${url} became ready (exit code ${processRef.exitCode}).`,
        stdout ? `stdout:\n${stdout}` : "",
        stderr ? `stderr:\n${stderr}` : "",
      ].filter(Boolean).join("\n\n");
      throw new Error(diagnostics);
    }

    try {
      const response = await fetch(url);
      if (response.status > 0) {
        return;
      }
    } catch {
      // ignore until timeout
    }

    await Bun.sleep(intervalMs);
  }

  if (processRef && typeof processRef.exitCode === "number") {
    const [stdout, stderr] = await Promise.all([
      readProcessStream(processRef.stdout),
      readProcessStream(processRef.stderr),
    ]);
    const diagnostics = [
      `Timed out waiting for ${url}; process exited with code ${processRef.exitCode}.`,
      stdout ? `stdout:\n${stdout}` : "",
      stderr ? `stderr:\n${stderr}` : "",
    ].filter(Boolean).join("\n\n");
    throw new Error(diagnostics);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

let loopbackListenCapability: Promise<boolean> | null = null;

export function canListenOnLoopback(): Promise<boolean> {
  if (!loopbackListenCapability) {
    loopbackListenCapability = Promise.resolve().then(() => {
      try {
        const server = Bun.serve({
          port: 0,
          fetch() {
            return new Response("ok");
          },
        });
        server.stop(true);
        return true;
      } catch {
        return false;
      }
    });
  }

  return loopbackListenCapability;
}

export async function getAvailablePort(): Promise<number> {
  const server = Bun.serve({
    port: 0,
    fetch() {
      return new Response("ok");
    },
  });

  const port = server.port;
  server.stop(true);

  if (typeof port !== "number") {
    throw new Error("Failed to allocate a loopback port");
  }

  return port;
}
