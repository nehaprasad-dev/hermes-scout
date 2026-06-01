import type { AgentStep, AgentTrace, ScanResult } from "@/lib/types";

/** Health payload passed into the agent — deterministic fields only. */
export type HealthResult = Omit<
  ScanResult,
  "aiSummary" | "aiSummaryFallback" | "agentTrace"
>;

export type ToolName =
  | "score_company"
  | "estimate_penalty"
  | "filing_calendar"
  | "classify_notices";

export type { AgentStep, AgentTrace };

export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

export type ChatToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: ChatToolCall[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

export type ChatTool = {
  type: "function";
  function: {
    name: ToolName;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ChatAssistantMessage = {
  content: string | null;
  tool_calls?: ChatToolCall[];
};

export class AgentUnavailableError extends Error {
  constructor(message = "Hermes Agent is not configured") {
    super(message);
    this.name = "AgentUnavailableError";
  }
}

export class HermesRequestError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "HermesRequestError";
    this.status = status;
  }
}
