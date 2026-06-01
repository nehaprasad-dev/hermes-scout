import type { Company, RiskLevel, ScanResult } from "./types";

const MONTH_PENALTY = 15;
const MCA_OVERDUE_PENALTY = 20;
const NOTICE_PENALTY = 10;

/** Number of full months between a YYYY-MM string and "now". Never negative. */
function monthsOverdue(lastFiledYYYYMM: string, now: Date = new Date()): number {
  const [yStr, mStr] = lastFiledYYYYMM.split("-");
  const filedYear = Number(yStr);
  const filedMonth = Number(mStr);
  if (!filedYear || !filedMonth) return 0;

  const nowYear = now.getUTCFullYear();
  const nowMonth = now.getUTCMonth() + 1;

  const diff = (nowYear - filedYear) * 12 + (nowMonth - filedMonth);
  // GSTR-3B is filed for the *previous* month, so we treat 1 month gap as
  // on-time, anything beyond that is overdue.
  return Math.max(0, diff - 1);
}

function riskFromScore(score: number): RiskLevel {
  if (score >= 70) return "Low";
  if (score >= 40) return "Medium";
  return "High";
}

function buildPendingTasks(company: Company, gstMonths: number): string[] {
  const tasks: string[] = [];

  if (gstMonths > 0) {
    tasks.push(
      `GSTR-3B overdue for ${gstMonths} ${
        gstMonths === 1 ? "month" : "months"
      } (last filed ${company.lastGstFilingMonth}).`,
    );
    tasks.push("File pending GSTR-1 returns to match outward supplies.");
  }

  if (company.mcaFilingStatus === "Overdue") {
    tasks.push("MCA annual return (AOC-4 / MGT-7) is overdue.");
  }

  for (const notice of company.pendingNotices) {
    tasks.push(`Respond to: ${notice}.`);
  }

  if (tasks.length === 0) {
    tasks.push("No critical filings pending — keep monthly cadence going.");
  }

  return tasks;
}

/** A directional penalty range in INR for a single compliance area. */
export type PenaltyRange = { low: number; high: number };

/**
 * Structured, per-area penalty exposure plus the founder-facing formatted
 * string. Pure and additive — `estimatePenalty` is derived from this so the
 * totals always match what the UI already shows.
 */
export type PenaltyBreakdown = {
  gst: PenaltyRange;
  mca: PenaltyRange;
  notices: PenaltyRange;
  total: PenaltyRange;
  /** Same string returned by the existing penalty estimate. */
  formatted: string;
};

function formatPenalty(total: PenaltyRange): string {
  if (total.low === 0 && total.high === 0) {
    return "No material penalty exposure right now.";
  }

  const fmt = (n: number) =>
    `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  if (total.low === total.high) return `Estimated exposure: up to ${fmt(total.high)}.`;
  return `Estimated exposure: ${fmt(total.low)}–${fmt(total.high)}.`;
}

/**
 * Pure, additive export: the per-area penalty amounts (GST, MCA, notices) that
 * sum to the same total the existing estimate uses, plus the formatted string.
 * Directional ranges only — not legal advice.
 */
export function penaltyBreakdown(
  company: Company,
  now: Date = new Date(),
): PenaltyBreakdown {
  const gstMonths = monthsOverdue(company.lastGstFilingMonth, now);

  // GST late fees (CGST + SGST) ~ ₹50/day capped, plus interest.
  const gst: PenaltyRange =
    gstMonths > 0
      ? { low: gstMonths * 1500, high: gstMonths * 5000 }
      : { low: 0, high: 0 };

  const mca: PenaltyRange =
    company.mcaFilingStatus === "Overdue"
      ? { low: 10000, high: 50000 }
      : { low: 0, high: 0 };

  const noticeCount = company.pendingNotices.length;
  const notices: PenaltyRange = {
    low: noticeCount * 5000,
    high: noticeCount * 25000,
  };

  const total: PenaltyRange = {
    low: gst.low + mca.low + notices.low,
    high: gst.high + mca.high + notices.high,
  };

  return { gst, mca, notices, total, formatted: formatPenalty(total) };
}

function estimatePenalty(company: Company, now: Date = new Date()): string {
  return penaltyBreakdown(company, now).formatted;
}

/** A statutory filing deadline derived from the company profile. */
export type UpcomingFiling = {
  dueDate: string;
  form: string;
  description: string;
};

function addMonths(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

function formatISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** GSTR returns for tax period YYYY-MM are due in the following calendar month. */
function gstDueDate(periodYear: number, periodMonth: number, day: number): Date {
  const next = addMonths(periodYear, periodMonth, 1);
  return new Date(Date.UTC(next.year, next.month - 1, day));
}

/**
 * Pure, additive export: statutory filing deadlines (GSTR-3B, GSTR-1, MCA
 * annual return) within `horizonDays` of `now`, including overdue items.
 */
export function upcomingFilings(
  company: Company,
  horizonDays: number,
  now: Date = new Date(),
): UpcomingFiling[] {
  const horizonEnd = new Date(now);
  horizonEnd.setUTCDate(horizonEnd.getUTCDate() + horizonDays);

  const [lastYearStr, lastMonthStr] = company.lastGstFilingMonth.split("-");
  const lastYear = Number(lastYearStr);
  const lastMonth = Number(lastMonthStr);
  if (!lastYear || !lastMonth) return [];

  const filings: UpcomingFiling[] = [];
  const seen = new Set<string>();

  // Walk tax periods starting with the first month not yet filed.
  let period = addMonths(lastYear, lastMonth, 1);

  for (let i = 0; i < 24; i++) {
    const periodLabel = `${period.year}-${String(period.month).padStart(2, "0")}`;
    const gstr3bDue = gstDueDate(period.year, period.month, 20);
    const gstr1Due = gstDueDate(period.year, period.month, 11);

    if (gstr3bDue > horizonEnd && gstr1Due > horizonEnd) break;

    if (gstr3bDue <= horizonEnd) {
      const key = `GSTR-3B-${periodLabel}`;
      if (!seen.has(key)) {
        seen.add(key);
        const overdue = gstr3bDue < now;
        filings.push({
          dueDate: formatISODate(gstr3bDue),
          form: "GSTR-3B",
          description: overdue
            ? `Monthly GST return for ${periodLabel} — overdue`
            : `Monthly GST return for ${periodLabel}`,
        });
      }
    }

    if (gstr1Due <= horizonEnd) {
      const key = `GSTR-1-${periodLabel}`;
      if (!seen.has(key)) {
        seen.add(key);
        const overdue = gstr1Due < now;
        filings.push({
          dueDate: formatISODate(gstr1Due),
          form: "GSTR-1",
          description: overdue
            ? `Outward supplies return for ${periodLabel} — overdue`
            : `Outward supplies return for ${periodLabel}`,
        });
      }
    }

    period = addMonths(period.year, period.month, 1);
  }

  if (company.mcaFilingStatus === "Overdue") {
    const mcaDue = new Date(now);
    mcaDue.setUTCDate(mcaDue.getUTCDate() - 30);
    filings.push({
      dueDate: formatISODate(mcaDue),
      form: "MCA AOC-4 / MGT-7",
      description: "Annual return and financial statements — overdue",
    });
  } else {
    let mcaYear = now.getUTCFullYear();
    let mcaDue = new Date(Date.UTC(mcaYear, 8, 30));
    if (mcaDue < now) {
      mcaYear += 1;
      mcaDue = new Date(Date.UTC(mcaYear, 8, 30));
    }
    if (mcaDue <= horizonEnd) {
      filings.push({
        dueDate: formatISODate(mcaDue),
        form: "MCA AOC-4 / MGT-7",
        description: "Annual return and financial statements",
      });
    }
  }

  filings.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return filings;
}

export function computeHealth(
  company: Company,
  now: Date = new Date(),
): Omit<ScanResult, "aiSummary" | "aiSummaryFallback" | "agentTrace"> {
  const gstMonths = monthsOverdue(company.lastGstFilingMonth, now);

  let score = 100;
  score -= gstMonths * MONTH_PENALTY;
  if (company.mcaFilingStatus === "Overdue") score -= MCA_OVERDUE_PENALTY;
  score -= company.pendingNotices.length * NOTICE_PENALTY;
  score = Math.max(0, Math.min(100, score));

  return {
    companyName: company.name,
    industry: company.industry,
    score,
    riskLevel: riskFromScore(score),
    pendingTasks: buildPendingTasks(company, gstMonths),
    penaltyEstimate: estimatePenalty(company, now),
    monthsOverdue: gstMonths,
    isSample: company.isSample === true,
  };
}
