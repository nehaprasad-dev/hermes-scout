import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getHermesConfig } from "@/lib/agent/config";

describe("getHermesConfig", () => {
  const original = { ...process.env };

  beforeEach(() => {
    delete process.env.HERMES_ENABLED;
    delete process.env.HERMES_BASE_URL;
    delete process.env.HERMES_MODEL;
    delete process.env.HERMES_API_KEY;
    delete process.env.HERMES_TIMEOUT_MS;
    delete process.env.HERMES_MAX_STEPS;
    delete process.env.VERCEL;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("returns null when HERMES_ENABLED is not true", () => {
    process.env.HERMES_BASE_URL = "http://localhost:8000/v1";
    process.env.HERMES_MODEL = "hermes-model";
    expect(getHermesConfig()).toBeNull();
  });

  it("returns null when required vars are missing", () => {
    process.env.HERMES_ENABLED = "true";
    expect(getHermesConfig()).toBeNull();
  });

  it("returns config when explicitly enabled with base URL and model", () => {
    process.env.HERMES_ENABLED = "true";
    process.env.HERMES_BASE_URL = "http://localhost:8000/v1/";
    process.env.HERMES_MODEL = "NousResearch/Hermes-3-Llama-3.1-8B";
    process.env.HERMES_API_KEY = "test-key";
    process.env.HERMES_TIMEOUT_MS = "15000";
    process.env.HERMES_MAX_STEPS = "4";

    expect(getHermesConfig()).toEqual({
      baseUrl: "http://localhost:8000/v1",
      model: "NousResearch/Hermes-3-Llama-3.1-8B",
      apiKey: "test-key",
      timeoutMs: 15000,
      maxSteps: 4,
    });
  });

  it("uses defaults for timeout and maxSteps", () => {
    process.env.HERMES_ENABLED = "true";
    process.env.HERMES_BASE_URL = "http://localhost:8000/v1";
    process.env.HERMES_MODEL = "hermes-model";

    const cfg = getHermesConfig();
    expect(cfg?.timeoutMs).toBe(12_000);
    expect(cfg?.maxSteps).toBe(4);
    expect(cfg?.apiKey).toBeUndefined();
  });

  it("skips localhost Hermes on Vercel", () => {
    process.env.HERMES_ENABLED = "true";
    process.env.HERMES_BASE_URL = "http://localhost:8000/v1";
    process.env.HERMES_MODEL = "hermes-model";
    process.env.VERCEL = "1";

    expect(getHermesConfig()).toBeNull();
  });
});
