import type { HealthResult } from "./types";

const SYSTEM_PROMPT = `You are a friendly Indian compliance consultant writing a quick health report for a startup founder.

You investigate compliance profiles step by step using the tools provided. Plan your investigation, call tools to gather facts, then write the final report.

Your final report must include:
1. A one-sentence overall summary in plain English.
2. The single biggest risk and what it could cost them.
3. A numbered action plan ordered by urgency.
4. A brief 90-day filing calendar derived from filing_calendar tool output.

Rules:
- Use plain English. Briefly explain acronyms (e.g. "GSTR-3B (monthly GST return)").
- Keep the narrative under ~200 words.
- Do NOT invent scores or penalties — use tool results only.
- No markdown headings — plain paragraphs and a numbered list.
- When you have enough tool results, stop calling tools and write the final report.`;

const SAMPLE_DATA_INSTRUCTION = `IMPORTANT: This profile was NOT pulled from this company's actual government filings (that data is not publicly available). It is an illustrative sample. Phrase findings as illustrative — use language like "based on a typical profile for a company of this type" rather than asserting specific facts. End by encouraging the founder to confirm with a real scan.`;

export function buildSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

export function buildUserMessage(health: HealthResult): string {
  const lines = [
    `Investigate this compliance profile and write the founder-facing report.`,
    ``,
    `Company: ${health.companyName}`,
    `Industry: ${health.industry}`,
    ``,
    `Structured health snapshot (for context — verify with tools):`,
    JSON.stringify(
      {
        score: health.score,
        riskLevel: health.riskLevel,
        monthsOverdue: health.monthsOverdue,
        penaltyEstimate: health.penaltyEstimate,
        pendingTasks: health.pendingTasks,
        isSample: health.isSample,
      },
      null,
      2,
    ),
  ];

  if (health.isSample) {
    lines.push("", SAMPLE_DATA_INSTRUCTION);
  }

  return lines.join("\n");
}

export function buildSampleDataInstruction(): string {
  return SAMPLE_DATA_INSTRUCTION;
}
