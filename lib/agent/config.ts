export type HermesConfig = {
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeoutMs: number;
  maxSteps: number;
};

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Returns null when Hermes is disabled or misconfigured — triggers fast Groq fallback. */
export function getHermesConfig(
  env: NodeJS.ProcessEnv = process.env,
): HermesConfig | null {
  // Opt-in only: avoids blocking local dev when URL is set but the server is not running.
  if (env.HERMES_ENABLED?.trim().toLowerCase() !== "true") return null;

  const baseUrl = env.HERMES_BASE_URL?.trim();
  const model = env.HERMES_MODEL?.trim();
  if (!baseUrl || !model) return null;

  // localhost Hermes cannot be reached from Vercel/serverless — use Groq fallback instead.
  if (env.VERCEL === "1" && /localhost|127\.0\.0\.1/i.test(baseUrl)) {
    return null;
  }

  const apiKey = env.HERMES_API_KEY?.trim() || undefined;

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    model,
    apiKey,
    timeoutMs: parsePositiveInt(env.HERMES_TIMEOUT_MS, 12_000),
    maxSteps: parsePositiveInt(env.HERMES_MAX_STEPS, 4),
  };
}
