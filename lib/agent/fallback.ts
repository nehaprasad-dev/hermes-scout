import Groq from "groq-sdk";
import type { HealthResult } from "./types";

export const FALLBACK_SUMMARY =
  "AI summary is currently unavailable. Please review the score, pending tasks, and penalty estimate above to decide what to fix first.";

function buildPrompt(
  health: HealthResult,
): string {
  const lines: string[] = [
    `You are a friendly Indian compliance consultant writing a quick health report for a startup founder.`,
    ``,
    `Company: ${health.companyName}`,
    `Industry: ${health.industry}`,
    `Compliance score: ${health.score}/100`,
    `Risk level: ${health.riskLevel}`,
    `GST months overdue: ${health.monthsOverdue}`,
    `Penalty estimate: ${health.penaltyEstimate}`,
    `Pending items:`,
    ...health.pendingTasks.map((t) => `- ${t}`),
    ``,
    `Write a report under 150 words with three short sections separated by blank lines:`,
    `1. A one-sentence overall summary in plain English.`,
    `2. The single biggest risk and what it could cost them.`,
    `3. A numbered 3-step action plan ordered by urgency.`,
    ``,
    `Rules: Use plain English. Briefly explain any acronym (e.g. "GSTR-3B (monthly GST return)"). No legal disclaimers. No headings in markdown — just plain paragraphs and a numbered list.`,
  ];

  if (health.isSample) {
    lines.push(
      ``,
      `IMPORTANT: This profile was NOT pulled from this company's actual government filings (that data is not publicly available). It is an illustrative sample generated from a typical profile. Phrase findings as illustrative — use language like "based on a typical profile for a company of this type" or "if this scenario matched your real filings" rather than asserting specific facts about ${health.companyName}. End by encouraging the founder to confirm with a real scan.`,
    );
  }

  return lines.join("\n");
}

export type FallbackDeps = {
  apiKey?: string;
  createCompletion?: (prompt: string) => Promise<string | null>;
};

export async function fallbackSummary(
  health: HealthResult,
  deps: FallbackDeps = {},
): Promise<{ summary: string; fallback: true }> {
  const apiKey = deps.apiKey ?? process.env.GROQ_API_KEY;

  if (!apiKey) {
    return { summary: FALLBACK_SUMMARY, fallback: true };
  }

  try {
    const createCompletion =
      deps.createCompletion ??
      (async (prompt: string) => {
        const groq = new Groq({ apiKey });
        const completion = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          temperature: 0.3,
          max_tokens: 250,
          messages: [{ role: "user", content: prompt }],
        });
        return completion.choices[0]?.message?.content?.trim() ?? null;
      });

    const text = await createCompletion(buildPrompt(health));
    if (!text) return { summary: FALLBACK_SUMMARY, fallback: true };
    return { summary: text, fallback: true };
  } catch (err) {
    console.error("[scan] Groq fallback failed:", err);
    return { summary: FALLBACK_SUMMARY, fallback: true };
  }
}
