import { describe, it, expect } from "vitest";
import type { Company } from "@/lib/types";
import {
  computeHealth,
  penaltyBreakdown,
  upcomingFilings,
} from "@/lib/scoring";

// Fixed "now" so monthsOverdue math is deterministic across runs.
const NOW = new Date(Date.UTC(2026, 0, 15)); // 2026-01

// A known curated-style profile: 4 months since last GST filing (2025-09),
// MCA overdue, and two pending notices — mirrors "Mumbai Chai Co.".
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

// A clean profile: filed last month, MCA filed, no notices.
const clean: Company = {
  name: "Bengaluru Bytes Pvt Ltd",
  pan: "AAACB7821K",
  gstin: "29AAACB7821K1ZP",
  industry: "SaaS",
  lastGstFilingMonth: "2025-12",
  mcaFilingStatus: "Filed",
  pendingNotices: [],
};

describe("penaltyBreakdown", () => {
  it("matches computeHealth's penaltyEstimate for a curated profile", () => {
    const breakdown = penaltyBreakdown(curated, NOW);
    const health = computeHealth(curated, NOW);
    expect(breakdown.formatted).toBe(health.penaltyEstimate);
  });

  it("returns per-area amounts that sum to the total for a curated profile", () => {
    const { gst, mca, notices, total } = penaltyBreakdown(curated, NOW);

    // 4 months elapsed - 1 grace = 3 overdue months.
    expect(gst).toEqual({ low: 3 * 1500, high: 3 * 5000 });
    expect(mca).toEqual({ low: 10000, high: 50000 });
    expect(notices).toEqual({ low: 2 * 5000, high: 2 * 25000 });

    expect(total.low).toBe(gst.low + mca.low + notices.low);
    expect(total.high).toBe(gst.high + mca.high + notices.high);
  });

  it("reports zero exposure for a clean profile and matches computeHealth", () => {
    const breakdown = penaltyBreakdown(clean, NOW);
    const health = computeHealth(clean, NOW);

    expect(breakdown.total).toEqual({ low: 0, high: 0 });
    expect(breakdown.formatted).toBe("No material penalty exposure right now.");
    expect(breakdown.formatted).toBe(health.penaltyEstimate);
  });
});

describe("upcomingFilings", () => {
  it("includes overdue GST and MCA forms for an overdue profile", () => {
    const filings = upcomingFilings(curated, 90, NOW);
    const forms = filings.map((f) => f.form);

    expect(forms).toContain("GSTR-3B");
    expect(forms).toContain("GSTR-1");
    expect(forms).toContain("MCA AOC-4 / MGT-7");
    expect(filings.some((f) => f.description.includes("overdue"))).toBe(true);
  });

  it("respects the horizon window", () => {
    const shortHorizon = upcomingFilings(curated, 30, NOW);
    const longHorizon = upcomingFilings(curated, 90, NOW);

    expect(longHorizon.length).toBeGreaterThan(shortHorizon.length);
  });

  it("returns mostly upcoming filings for a clean profile", () => {
    const filings = upcomingFilings(clean, 90, NOW);

    expect(filings.length).toBeGreaterThan(0);
    expect(filings.every((f) => /^\d{4}-\d{2}-\d{2}$/.test(f.dueDate))).toBe(
      true,
    );
    expect(filings.filter((f) => f.description.includes("overdue")).length).toBe(
      0,
    );
  });
});
