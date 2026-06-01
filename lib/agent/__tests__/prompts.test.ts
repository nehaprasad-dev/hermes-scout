import { describe, it, expect } from "vitest";
import { computeHealth } from "@/lib/scoring";
import {
  buildSampleDataInstruction,
  buildSystemPrompt,
  buildUserMessage,
} from "@/lib/agent/prompts";

describe("prompt builders", () => {
  const sampleHealth = computeHealth({
    name: "Acme Labs",
    pan: "AAAAA0000A",
    gstin: "29AAAAA0000A1Z5",
    industry: "SaaS",
    lastGstFilingMonth: "2025-11",
    mcaFilingStatus: "Filed",
    pendingNotices: [],
    isSample: true,
  });

  const curatedHealth = computeHealth({
    name: "Razorpay Software Private Limited",
    pan: "AAACR1001P",
    gstin: "29AAACR1001P1ZA",
    industry: "Fintech",
    lastGstFilingMonth: "2025-12",
    mcaFilingStatus: "Filed",
    pendingNotices: [],
  });

  it("builds a system prompt with compliance instructions", () => {
    expect(buildSystemPrompt()).toContain("90-day filing calendar");
    expect(buildSystemPrompt()).toContain("tools");
  });

  it("includes sample-data instruction only for synthetic profiles", () => {
    expect(buildUserMessage(sampleHealth)).toContain(buildSampleDataInstruction());
    expect(buildUserMessage(curatedHealth)).not.toContain(
      "illustrative sample",
    );
  });
});
