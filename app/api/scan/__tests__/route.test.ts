import { describe, it, expect } from "vitest";
import { handleScan } from "@/app/api/scan/route";
import { AgentUnavailableError, HermesRequestError } from "@/lib/agent/types";

describe("handleScan", () => {
  it("maps a successful agent run to aiSummary and agentTrace", async () => {
    const result = await handleScan("Mumbai Chai", {
      runAgent: async () => ({
        report: "Agent-written report",
        trace: {
          model: "hermes-test",
          steps: [{ kind: "final", label: "Final report" }],
          toolCallCount: 0,
          durationMs: 12,
        },
      }),
    });

    expect(result.aiSummary).toBe("Agent-written report");
    expect(result.aiSummaryFallback).toBe(false);
    expect(result.agentTrace?.model).toBe("hermes-test");
    expect(result.score).toBeGreaterThan(0);
  });

  it("falls back when the agent is unavailable", async () => {
    const result = await handleScan("Mumbai Chai", {
      runAgent: async () => {
        throw new AgentUnavailableError();
      },
      fallback: async () => ({
        summary: "Fallback summary",
        fallback: true,
      }),
    });

    expect(result.aiSummary).toBe("Fallback summary");
    expect(result.aiSummaryFallback).toBe(true);
    expect(result.agentTrace).toBeUndefined();
  });

  it("falls back when Hermes is unconfigured", async () => {
    const savedBaseUrl = process.env.HERMES_BASE_URL;
    const savedModel = process.env.HERMES_MODEL;
    delete process.env.HERMES_BASE_URL;
    delete process.env.HERMES_MODEL;

    try {
      const result = await handleScan("Mumbai Chai", {
        fallback: async () => ({
          summary: "Static fallback",
          fallback: true,
        }),
      });

      expect(result.aiSummaryFallback).toBe(true);
      expect(result.agentTrace).toBeUndefined();
    } finally {
      if (savedBaseUrl) process.env.HERMES_BASE_URL = savedBaseUrl;
      if (savedModel) process.env.HERMES_MODEL = savedModel;
    }
  });

  it("falls back when Hermes times out or errors", async () => {
    const result = await handleScan("Mumbai Chai", {
      runAgent: async () => {
        throw new HermesRequestError("timeout", 504);
      },
      fallback: async () => ({
        summary: "Groq or static fallback",
        fallback: true,
      }),
    });

    expect(result.aiSummary).toBe("Groq or static fallback");
    expect(result.aiSummaryFallback).toBe(true);
    expect(result.agentTrace).toBeUndefined();
    expect(result.score).toBeGreaterThan(0);
  });
});
