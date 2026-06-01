import { describe, it, expect } from "vitest";
import type { Company } from "@/lib/types";
import { computeHealth } from "@/lib/scoring";
import { createToolDispatcher } from "@/lib/agent/tools";

const NOW = new Date(Date.UTC(2026, 0, 15));

const curated: Company = {
  name: "Mumbai Chai Co.",
  pan: "AABCM1234E",
  gstin: "27AABCM1234E1Z5",
  industry: "Food & Beverage",
  lastGstFilingMonth: "2025-09",
  mcaFilingStatus: "Overdue",
  pendingNotices: [
    "GST notice u/s 73 for last fiscal year",
    "MCA notice for delayed annual return",
  ],
};

const clean: Company = {
  name: "Bengaluru Bytes Pvt Ltd",
  pan: "AAACB7821K",
  gstin: "29AAACB7821K1ZP",
  industry: "SaaS",
  lastGstFilingMonth: "2025-12",
  mcaFilingStatus: "Filed",
  pendingNotices: [],
};

function dispatcherFor(company: Company) {
  const health = computeHealth(company, NOW);
  return createToolDispatcher({ company, health });
}

describe("createToolDispatcher", () => {
  it("returns score_company output matching computeHealth", () => {
    const dispatch = dispatcherFor(curated);
    const health = computeHealth(curated, NOW);
    const result = dispatch("score_company", {});

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        score: health.score,
        riskLevel: health.riskLevel,
        monthsOverdue: health.monthsOverdue,
        pendingTasks: health.pendingTasks,
      });
    }
  });

  it("returns penalty breakdown aligned with scoring", () => {
    const dispatch = dispatcherFor(curated);
    const health = computeHealth(curated, NOW);
    const result = dispatch("estimate_penalty", {});

    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { penaltyEstimate: string };
      expect(data.penaltyEstimate).toBe(health.penaltyEstimate);
    }
  });

  it("returns filing calendar entries for an overdue profile", () => {
    const dispatch = dispatcherFor(curated);
    const result = dispatch("filing_calendar", { horizonDays: 90 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { filings: { form: string }[] };
      expect(data.filings.some((f) => f.form === "GSTR-3B")).toBe(true);
    }
  });

  it("classifies pending notices with severity", () => {
    const dispatch = dispatcherFor(curated);
    const result = dispatch("classify_notices", {});

    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { severity: string }[];
      expect(data).toHaveLength(2);
      expect(data.some((n) => n.severity === "high")).toBe(true);
    }
  });

  it("returns low-risk calendar output for a clean profile", () => {
    const dispatch = dispatcherFor(clean);
    const result = dispatch("filing_calendar", {});

    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { filings: unknown[] };
      expect(data.filings.length).toBeGreaterThan(0);
    }
  });

  it("rejects unknown tool names without throwing", () => {
    const dispatch = dispatcherFor(curated);
    const result = dispatch("summon_ca", {});

    expect(result).toEqual({ ok: false, error: "Unknown tool: summon_ca" });
  });

  it("rejects malformed horizonDays", () => {
    const dispatch = dispatcherFor(curated);

    expect(dispatch("filing_calendar", { horizonDays: "soon" })).toEqual({
      ok: false,
      error: "horizonDays must be an integer between 1 and 365.",
    });
    expect(dispatch("filing_calendar", { horizonDays: 0 })).toEqual({
      ok: false,
      error: "horizonDays must be between 1 and 365.",
    });
    expect(dispatch("filing_calendar", { horizonDays: 500 })).toEqual({
      ok: false,
      error: "horizonDays must be between 1 and 365.",
    });
  });
});
