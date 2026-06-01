import type { Company } from "@/lib/types";
import {
  penaltyBreakdown,
  upcomingFilings,
} from "@/lib/scoring";
import type {
  ChatTool,
  HealthResult,
  ToolName,
  ToolResult,
} from "./types";

const REGISTERED_TOOLS: ReadonlySet<string> = new Set<ToolName>([
  "score_company",
  "estimate_penalty",
  "filing_calendar",
  "classify_notices",
]);

export const toolDefinitions: ChatTool[] = [
  {
    type: "function",
    function: {
      name: "score_company",
      description:
        "Return the canonical compliance score, risk level, months overdue, and pending tasks.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "estimate_penalty",
      description:
        "Return the penalty estimate with a structured GST, MCA, and notices breakdown.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "filing_calendar",
      description:
        "Return upcoming statutory filing deadlines within a horizon (default 90 days).",
      parameters: {
        type: "object",
        properties: {
          horizonDays: {
            type: "integer",
            description: "Look-ahead window in days (1–365, default 90).",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "classify_notices",
      description:
        "Classify each pending government notice by category and severity.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
];

type NoticeSeverity = "low" | "medium" | "high";

function classifyNotice(notice: string): {
  notice: string;
  category: string;
  severity: NoticeSeverity;
} {
  const lower = notice.toLowerCase();

  if (
    lower.includes("gst") &&
    (lower.includes("73") || lower.includes("demand") || lower.includes("show cause"))
  ) {
    return { notice, category: "GST demand", severity: "high" };
  }
  if (lower.includes("mca") || lower.includes("strike-off") || lower.includes("roc")) {
    return { notice, category: "Corporate filing", severity: "high" };
  }
  if (lower.includes("tds") || lower.includes("income tax")) {
    return { notice, category: "Tax reconciliation", severity: "medium" };
  }
  if (lower.includes("professional tax")) {
    return { notice, category: "State tax", severity: "medium" };
  }
  if (lower.includes("query") || lower.includes("reconciliation")) {
    return { notice, category: "Compliance query", severity: "medium" };
  }
  return { notice, category: "General notice", severity: "low" };
}

function parseHorizonDays(rawArgs: unknown): number | { error: string } {
  if (rawArgs === undefined || rawArgs === null) return 90;
  if (typeof rawArgs !== "object" || Array.isArray(rawArgs)) {
    return { error: "filing_calendar arguments must be an object." };
  }

  const args = rawArgs as Record<string, unknown>;
  if (args.horizonDays === undefined) return 90;

  if (typeof args.horizonDays !== "number" || !Number.isInteger(args.horizonDays)) {
    return { error: "horizonDays must be an integer between 1 and 365." };
  }
  if (args.horizonDays < 1 || args.horizonDays > 365) {
    return { error: "horizonDays must be between 1 and 365." };
  }
  return args.horizonDays;
}

function runTool(
  name: ToolName,
  rawArgs: unknown,
  ctx: { company: Company; health: HealthResult },
): ToolResult {
  switch (name) {
    case "score_company":
      return {
        ok: true,
        data: {
          score: ctx.health.score,
          riskLevel: ctx.health.riskLevel,
          monthsOverdue: ctx.health.monthsOverdue,
          pendingTasks: ctx.health.pendingTasks,
        },
      };
    case "estimate_penalty": {
      const breakdown = penaltyBreakdown(ctx.company);
      return {
        ok: true,
        data: {
          penaltyEstimate: ctx.health.penaltyEstimate,
          breakdown: {
            gst: breakdown.gst,
            mca: breakdown.mca,
            notices: breakdown.notices,
            total: breakdown.total,
          },
        },
      };
    }
    case "filing_calendar": {
      const horizon = parseHorizonDays(rawArgs);
      if (typeof horizon === "object") return { ok: false, error: horizon.error };
      return {
        ok: true,
        data: { horizonDays: horizon, filings: upcomingFilings(ctx.company, horizon) },
      };
    }
    case "classify_notices":
      return {
        ok: true,
        data: ctx.company.pendingNotices.map(classifyNotice),
      };
  }
}

export function createToolDispatcher(ctx: {
  company: Company;
  health: HealthResult;
}): (name: string, rawArgs: unknown) => ToolResult {
  return (name: string, rawArgs: unknown): ToolResult => {
    if (!REGISTERED_TOOLS.has(name)) {
      return { ok: false, error: `Unknown tool: ${name}` };
    }

    let parsedArgs: unknown = rawArgs;
    if (typeof rawArgs === "string") {
      try {
        parsedArgs = rawArgs.trim() === "" ? {} : JSON.parse(rawArgs);
      } catch {
        return { ok: false, error: "Tool arguments must be valid JSON." };
      }
    }

    try {
      return runTool(name as ToolName, parsedArgs, ctx);
    } catch {
      return { ok: false, error: `Tool ${name} failed unexpectedly.` };
    }
  };
}

/** Compact preview for the agent trace UI — no secrets. */
export function previewToolResult(name: ToolName, result: ToolResult): string {
  if (!result.ok) return result.error;
  switch (name) {
    case "score_company": {
      const d = result.data as { score: number; riskLevel: string };
      return `Score ${d.score}/100 (${d.riskLevel} risk)`;
    }
    case "estimate_penalty": {
      const d = result.data as { penaltyEstimate: string };
      return d.penaltyEstimate;
    }
    case "filing_calendar": {
      const d = result.data as { filings: { form: string }[] };
      return `${d.filings.length} deadline(s)`;
    }
    case "classify_notices": {
      const d = result.data as { severity: string }[];
      return d.length === 0 ? "No pending notices" : `${d.length} notice(s) classified`;
    }
  }
}
