import type { HermesConfig } from "./config";
import type { ChatAssistantMessage, ChatMessage, ChatTool } from "./types";
import { HermesRequestError } from "./types";

type HermesChatOptions = {
  tools?: ChatTool[];
  temperature?: number;
  maxTokens?: number;
};

const PROBE_TIMEOUT_MS = 2_500;

/** Quick reachability check — fail fast instead of waiting for the full agent budget. */
export async function probeHermesEndpoint(cfg: HermesConfig): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {};
    if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;

    const res = await fetch(`${cfg.baseUrl}/models`, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function hermesChat(
  cfg: HermesConfig,
  messages: ChatMessage[],
  signal: AbortSignal,
  options: HermesChatOptions = {},
): Promise<ChatAssistantMessage> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cfg.apiKey) {
    headers.Authorization = `Bearer ${cfg.apiKey}`;
  }

  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 350,
  };

  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    body.tool_choice = "auto";
  }

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new HermesRequestError(
      detail ? `Hermes request failed: ${detail.slice(0, 200)}` : "Hermes request failed",
      res.status,
    );
  }

  const json = (await res.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: ChatAssistantMessage["tool_calls"];
      };
    }>;
  };

  const message = json.choices?.[0]?.message;
  if (!message) {
    throw new HermesRequestError("Hermes returned an empty response");
  }

  return {
    content: message.content ?? null,
    tool_calls: message.tool_calls,
  };
}
