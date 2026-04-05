const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const randomBetween = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const randomDelay = (minMs?: number, maxMs?: number): Promise<void> => {
  const min = minMs ?? Number(process.env.ANTI_BAN_DELAY_MIN_MS ?? 1000);
  const max = maxMs ?? Number(process.env.ANTI_BAN_DELAY_MAX_MS ?? 3000);
  return sleep(randomBetween(min, max));
};

export const simulateTyping = async (
  wbot: any,
  jid: string,
  durationMs?: number
): Promise<void> => {
  const duration = durationMs ?? randomBetween(
    Number(process.env.ANTI_BAN_TYPING_MIN_MS ?? 1000),
    Number(process.env.ANTI_BAN_TYPING_MAX_MS ?? 3000)
  );
  try {
    await wbot.sendPresenceUpdate("composing", jid);
    await sleep(duration);
    await wbot.sendPresenceUpdate("paused", jid);
  } catch {
    // ignore presence errors
  }
};

const sendTimestamps: number[] = [];

export const checkRateLimit = (): boolean => {
  const maxPerMinute = Number(process.env.ANTI_BAN_MAX_PER_MINUTE ?? 30);
  const now = Date.now();
  const oneMinuteAgo = now - 60_000;
  while (sendTimestamps.length && sendTimestamps[0] < oneMinuteAgo) {
    sendTimestamps.shift();
  }
  return sendTimestamps.length >= maxPerMinute;
};

export const recordSend = (): void => {
  sendTimestamps.push(Date.now());
};

export const waitForRateLimitSlot = async (): Promise<void> => {
  while (checkRateLimit()) {
    await sleep(5000);
  }
};

export const getRandomBrowserFingerprint = (): [string, string, string] => {
  const osOptions = ["Ubuntu", "Windows", "Macintosh"];
  const chromeVersions = [
    "120.0.6099.109",
    "121.0.6167.85",
    "122.0.6261.94",
    "123.0.6312.58",
    "124.0.6367.60",
    "125.0.6422.141",
    "126.0.6478.55",
    "127.0.6533.72",
    "128.0.6613.84",
    "129.0.6668.70",
  ];
  const os = osOptions[randomBetween(0, osOptions.length - 1)];
  const chrome = chromeVersions[randomBetween(0, chromeVersions.length - 1)];
  return [os, "Chrome", chrome];
};

export const getReconnectDelay = (attempt: number): number => {
  const base = Number(process.env.ANTI_BAN_RECONNECT_BASE_MS ?? 5000);
  const maxDelay = Number(process.env.ANTI_BAN_RECONNECT_MAX_MS ?? 120000);
  const jitter = randomBetween(0, 3000);
  const delay = Math.min(base * Math.pow(2, attempt) + jitter, maxDelay);
  return delay;
};
