import { describe, it, expect } from "vitest";
import { computeHealth } from "@/lib/scoring";
import { FALLBACK_SUMMARY, fallbackSummary } from "@/lib/agent/fallback";

describe("fallbackSummary", () => {
  const health = computeHealth({
    name: "Mumbai Chai Co.",
    pan: "AABCM1234E",
    gstin: "27AABCM1234E1Z5",
    industry: "Food & Beverage",
    lastGstFilingMonth: "2025-09",
    mcaFilingStatus: "Overdue",
    pendingNotices: [],
  });

  it("returns the static summary when no Groq key is configured", async () => {
    const result = await fallbackSummary(health, { apiKey: "" });
    expect(result).toEqual({ summary: FALLBACK_SUMMARY, fallback: true });
  });

  it("uses an injected Groq completion when provided", async () => {
    const result = await fallbackSummary(health, {
      apiKey: "test",
      createCompletion: async () => "Groq fallback summary",
    });

    expect(result).toEqual({
      summary: "Groq fallback summary",
      fallback: true,
    });
  });
});
