const POLL_INTERVAL_MS = 20;
const DEFAULT_TIMEOUT_MS = 10000;

function sleep(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(() => resolve(), milliseconds);
  });
}

export async function waitFor(
  description: string,
  condition: () => boolean,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${description}`);
    await sleep(POLL_INTERVAL_MS);
  }
}
