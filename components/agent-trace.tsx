"use client";

import { Bot, ChevronDown, Wrench } from "lucide-react";
import type { AgentTrace as AgentTraceType } from "@/lib/types";
import { cn } from "@/lib/utils";

function stepIcon(kind: AgentTraceType["steps"][number]["kind"]) {
  if (kind === "tool_call") return Wrench;
  return Bot;
}

export function AgentTrace({ trace }: { trace?: AgentTraceType }) {
  if (!trace || trace.steps.length === 0) return null;

  return (
    <details className="group rounded-2xl bg-zinc-50 p-5 ring-1 ring-zinc-200/70">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-1.5">
          <Bot className="h-3 w-3 text-violet-500" />
          Agent investigation
          <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-violet-800">
            {trace.toolCallCount} tool{trace.toolCallCount === 1 ? "" : "s"}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-180" />
      </summary>

      <div className="mt-4 space-y-3 border-t border-zinc-200/70 pt-4">
        <p className="text-[11px] text-zinc-400">
          Model: {trace.model} · {(trace.durationMs / 1000).toFixed(1)}s
        </p>

        <ol className="space-y-2.5">
          {trace.steps.map((step, idx) => {
            const Icon = stepIcon(step.kind);
            return (
              <li
                key={`${step.kind}-${step.label}-${idx}`}
                className="flex gap-2.5 text-[13px] leading-snug text-zinc-700"
              >
                <Icon
                  className={cn(
                    "mt-0.5 h-3.5 w-3.5 shrink-0",
                    step.kind === "tool_call" ? "text-amber-500" : "text-violet-500",
                  )}
                />
                <div>
                  <span className="font-medium text-zinc-900">{step.label}</span>
                  {step.detail && (
                    <p className="mt-0.5 text-[12px] text-zinc-500">{step.detail}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </details>
  );
}

/** @deprecated Use `AgentTrace` — kept for backward compatibility. */
export const AgentTracePanel = AgentTrace;
