import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Company } from "@/lib/types";
import { computeHealth } from "@/lib/scoring";
import { runComplianceAgent } from "@/lib/agent/orchestrator";
import { AgentUnavailableError, HermesRequestError } from "@/lib/agent/types";

const company: Company = {
  name: "Mumbai Chai Co.",
  pan: "AABCM1234E",
  gstin: "27AABCM1234E1Z5",
  industry: "Food & Beverage",
  lastGstFilingMonth: "2025-09",
  mcaFilingStatus: "Overdue",
  pendingNotices: ["GST notice u/s 73 for last fiscal year"],
};

describe("runComplianceAgent", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.HERMES_ENABLED = "true";
    process.env.HERMES_BASE_URL = "http://localhost:8000/v1";
    process.env.HERMES_MODEL = "hermes-test";
    process.env.HERMES_MAX_STEPS = "4";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("throws AgentUnavailableError when Hermes is not configured", async () => {
    delete process.env.HERMES_ENABLED;
    delete process.env.HERMES_BASE_URL;
    delete process.env.HERMES_MODEL;

    const health = computeHealth(company);
    await expect(runComplianceAgent(health, company)).rejects.toBeInstanceOf(
      AgentUnavailableError,
    );
  });

  it("returns report and trace on a successful tool-call loop", async () => {
    const health = computeHealth(company);
    let call = 0;

    const { report, trace } = await runComplianceAgent(health, company, {
      hermesChat: async () => {
        call += 1;
        if (call === 1) {
          return {
            content: "I'll inspect the score and penalty exposure first.",
            tool_calls: [
              {
                id: "call_1",
                type: "function",
                function: {
                  name: "score_company",
                  arguments: "{}",
                },
              },
            ],
          };
        }
        return { content: "Final founder report from Hermes." };
      },
    });

    expect(report).toBe("Final founder report from Hermes.");
    expect(trace.toolCallCount).toBe(1);
    expect(trace.steps.some((s) => s.kind === "plan")).toBe(true);
    expect(trace.steps.some((s) => s.kind === "tool_call")).toBe(true);
    expect(trace.steps.some((s) => s.kind === "final")).toBe(true);
    expect(trace.model).toBe("hermes-test");
  });

  it("synthesizes a report when the step budget is exhausted but tools ran", async () => {
    const health = computeHealth(company);
    process.env.HERMES_MAX_STEPS = "1";

    const { report, trace } = await runComplianceAgent(health, company, {
      hermesChat: async () => ({
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: {
              name: "estimate_penalty",
              arguments: "{}",
            },
          },
        ],
      }),
    });

    expect(report).toContain("compliance score");
    expect(trace.steps.at(-1)?.label).toBe("Synthesized report");
  });

  it("throws when the step budget is exhausted with no tool results", async () => {
    const health = computeHealth(company);
    process.env.HERMES_MAX_STEPS = "1";

    await expect(
      runComplianceAgent(health, company, {
        hermesChat: async () => ({
          content: null,
          tool_calls: undefined,
        }),
      }),
    ).rejects.toThrow("Agent produced no final report");
  });

  it("propagates Hermes request errors for the route fallback chain", async () => {
    const health = computeHealth(company);

    await expect(
      runComplianceAgent(health, company, {
        hermesChat: async () => {
          throw new HermesRequestError("service unavailable", 503);
        },
      }),
    ).rejects.toBeInstanceOf(HermesRequestError);
  });

  it("propagates abort errors when the time budget is exceeded", async () => {
    const health = computeHealth(company);
    process.env.HERMES_TIMEOUT_MS = "50";

    await expect(
      runComplianceAgent(health, company, {
        hermesChat: async (_messages, signal) => {
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, 200);
            signal.addEventListener("abort", () => {
              clearTimeout(timer);
              reject(new DOMException("Aborted", "AbortError"));
            });
          });
          return { content: "too late" };
        },
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
