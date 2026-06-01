import type { Company } from "@/lib/types";
import { getHermesConfig } from "./config";
import { hermesChat, probeHermesEndpoint } from "./hermes-client";
import { buildSystemPrompt, buildUserMessage } from "./prompts";
import {
  createToolDispatcher,
  previewToolResult,
  toolDefinitions,
} from "./tools";
import type {
  AgentTrace,
  ChatMessage,
  ChatAssistantMessage,
  HealthResult,
  ToolName,
} from "./types";
import { AgentUnavailableError } from "./types";

export type HermesChatFn = (
  messages: ChatMessage[],
  signal: AbortSignal,
) => Promise<ChatAssistantMessage>;

function synthesizeReport(health: HealthResult, toolSummaries: string[]): string {
  const tasks = health.pendingTasks.slice(0, 3);
  const lines = [
    `${health.companyName} has a compliance score of ${health.score}/100 (${health.riskLevel} risk).`,
    ``,
    `The biggest exposure is ${health.penaltyEstimate.toLowerCase()}.`,
    ``,
    `Priority actions:`,
    ...tasks.map((t, i) => `${i + 1}. ${t.replace(/\.$/, "")}.`),
  ];

  if (toolSummaries.length > 0) {
    lines.push("", `Investigation notes: ${toolSummaries.join("; ")}.`);
  }

  if (health.isSample) {
    lines.push(
      "",
      "This analysis is based on an illustrative sample profile — confirm your real filings with a paid scan.",
    );
  }

  return lines.join("\n");
}

function extractPlanText(content: string | null): string | undefined {
  if (!content?.trim()) return undefined;
  return content.trim().slice(0, 280);
}

export async function runComplianceAgent(
  health: HealthResult,
  company: Company,
  deps?: { hermesChat?: HermesChatFn },
): Promise<{ report: string; trace: AgentTrace }> {
  const cfg = getHermesConfig();
  if (!cfg) throw new AgentUnavailableError();

  const chat =
    deps?.hermesChat ??
    ((messages, signal) =>
      hermesChat(cfg, messages, signal, { tools: toolDefinitions }));

  if (!deps?.hermesChat) {
    const reachable = await probeHermesEndpoint(cfg);
    if (!reachable) {
      throw new AgentUnavailableError("Hermes endpoint unreachable");
    }
  }

  const dispatcher = createToolDispatcher({ company, health });
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: buildUserMessage(health) },
  ];

  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);

  const steps: AgentTrace["steps"] = [];
  let toolCallCount = 0;
  const toolSummaries: string[] = [];

  try {
    for (let step = 0; step < cfg.maxSteps; step++) {
      const assistant = await chat(messages, controller.signal);

      if (assistant.content?.trim() && !assistant.tool_calls?.length) {
        steps.push({
          kind: "final",
          label: "Final report",
          detail: extractPlanText(assistant.content),
        });
        return {
          report: assistant.content.trim(),
          trace: {
            model: cfg.model,
            steps,
            toolCallCount,
            durationMs: Date.now() - started,
          },
        };
      }

      if (assistant.content?.trim()) {
        steps.push({
          kind: "plan",
          label: "Planned investigation",
          detail: extractPlanText(assistant.content),
        });
      }

      if (!assistant.tool_calls?.length) {
        break;
      }

      messages.push({
        role: "assistant",
        content: assistant.content,
        tool_calls: assistant.tool_calls,
      });

      for (const call of assistant.tool_calls) {
        const toolName = call.function.name as ToolName;
        let parsedArgs: unknown = call.function.arguments;
        try {
          parsedArgs =
            call.function.arguments.trim() === ""
              ? {}
              : JSON.parse(call.function.arguments);
        } catch {
          parsedArgs = call.function.arguments;
        }

        const result = dispatcher(toolName, parsedArgs);
        toolCallCount += 1;

        steps.push({
          kind: "tool_call",
          tool: REGISTERED_TOOL(toolName) ? toolName : undefined,
          label: `Called ${toolName}`,
          detail: result.ok
            ? REGISTERED_TOOL(toolName)
              ? previewToolResult(toolName, result)
              : JSON.stringify(result.data).slice(0, 120)
            : result.error,
        });

        if (result.ok && REGISTERED_TOOL(toolName)) {
          toolSummaries.push(previewToolResult(toolName, result));
        }

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    if (toolSummaries.length === 0) {
      throw new Error("Agent produced no final report within the step budget");
    }

    const report = synthesizeReport(health, toolSummaries);
    steps.push({
      kind: "final",
      label: "Synthesized report",
      detail: "Generated from tool results after step budget",
    });

    return {
      report,
      trace: {
        model: cfg.model,
        steps,
        toolCallCount,
        durationMs: Date.now() - started,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function REGISTERED_TOOL(name: string): name is ToolName {
  return (
    name === "score_company" ||
    name === "estimate_penalty" ||
    name === "filing_calendar" ||
    name === "classify_notices"
  );
}
