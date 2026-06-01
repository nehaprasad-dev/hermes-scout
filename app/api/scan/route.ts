import { NextResponse } from "next/server";
import { findOrBuildCompany } from "@/lib/mock-data";
import { fallbackSummary } from "@/lib/agent/fallback";
import { runComplianceAgent } from "@/lib/agent/orchestrator";
import { computeHealth } from "@/lib/scoring";
import type { ScanResult } from "@/lib/types";

export const runtime = "nodejs";

export type ScanRouteDeps = {
  runAgent?: typeof runComplianceAgent;
  fallback?: typeof fallbackSummary;
};

export async function handleScan(
  companyName: string,
  deps: ScanRouteDeps = {},
): Promise<ScanResult> {
  const company = findOrBuildCompany(companyName);
  if (!company) {
    throw new Error("INVALID_COMPANY");
  }

  const health = computeHealth(company);
  const runAgent = deps.runAgent ?? runComplianceAgent;
  const fallback = deps.fallback ?? fallbackSummary;

  try {
    const { report, trace } = await runAgent(health, company);
    return {
      ...health,
      aiSummary: report,
      aiSummaryFallback: false,
      agentTrace: trace,
    };
  } catch (err) {
    console.error("[scan] Hermes agent failed:", err);
    const { summary } = await fallback(health);
    return {
      ...health,
      aiSummary: summary,
      aiSummaryFallback: true,
    };
  }
}

export async function POST(req: Request) {
  let body: { companyName?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const companyName =
    typeof body.companyName === "string" ? body.companyName.trim() : "";

  if (!companyName) {
    return NextResponse.json(
      { error: "Please enter a company name." },
      { status: 400 },
    );
  }

  try {
    const result = await handleScan(companyName);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_COMPANY") {
      return NextResponse.json(
        { error: "Please enter a company name." },
        { status: 400 },
      );
    }
    console.error("[scan] Unexpected error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
