import { describe, it, expect, vi } from "vitest";
import { hermesChat } from "@/lib/agent/hermes-client";
import { HermesRequestError } from "@/lib/agent/types";

describe("hermesChat", () => {
  it("posts an OpenAI-compatible request and parses the assistant message", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "Final report text",
              tool_calls: undefined,
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await hermesChat(
      {
        baseUrl: "http://localhost:8000/v1",
        model: "hermes-test",
        apiKey: "secret",
        timeoutMs: 5000,
        maxSteps: 6,
      },
      [{ role: "user", content: "hello" }],
      new AbortController().signal,
      {
        tools: [
          {
            type: "function",
            function: {
              name: "score_company",
              description: "score",
              parameters: { type: "object", properties: {} },
            },
          },
        ],
      },
    );

    expect(result.content).toBe("Final report text");
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer secret",
    );

    const body = JSON.parse(String(init.body));
    expect(body.tool_choice).toBe("auto");
    expect(body.tools).toHaveLength(1);

    vi.unstubAllGlobals();
  });

  it("throws HermesRequestError on non-2xx responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "service unavailable",
      }),
    );

    await expect(
      hermesChat(
        {
          baseUrl: "http://localhost:8000/v1",
          model: "hermes-test",
          timeoutMs: 5000,
          maxSteps: 6,
        },
        [{ role: "user", content: "hello" }],
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(HermesRequestError);

    vi.unstubAllGlobals();
  });
});
