# DEV Submission — Build With Hermes Agent

**Copy this into a new DEV post for the Hermes Agent Challenge.**

---

## Submission Template

**Challenge:** Build With Hermes Agent  
**Project:** CompliScore — AI compliance health checks for Indian startups  
**Repo:** [your-github-url]/compliscore  
**Live demo:** [your-vercel-url]

---

## What I built

CompliScore gives Indian startup founders a **compliance score out of 100** in under a minute — overdue GST filings, MCA returns, penalty exposure, and a plain-English action plan.

The upgrade for this challenge: I replaced the one-shot Groq summary with a **Hermes Agent reasoning loop** that plans an investigation, calls deterministic compliance tools, and writes a prioritized report — with a **collapsible agent trace** so judges can see the agentic work.

### Why an agent loop fits here

Compliance analysis is conditional. A company with overdue GST needs a filing-calendar deep-dive; one with active notices needs notice triage; a clean company needs a light touch. A single prompt guesses all of this at once. An agent that calls tools based on what it finds produces tighter, grounded reports.

### Hermes Agent integration

```
Scan → computeHealth (deterministic score)
     → Hermes Agent loop (plan → tool calls → report)
     → agent trace in UI
     ↓ on failure
     Groq one-shot → static fallback
```

**Four tools** exposed to Hermes (scores never hallucinated):

| Tool | Purpose |
|------|---------|
| `score_company` | Canonical score, risk level, pending tasks |
| `estimate_penalty` | GST / MCA / notice penalty breakdown |
| `filing_calendar` | GSTR-3B, GSTR-1, MCA deadlines (90-day horizon) |
| `classify_notices` | Severity labels for pending government notices |

The agent runs over Hermes's **OpenAI-compatible** `/chat/completions` API with function calling — self-hostable via vLLM, LM Studio, Ollama, etc.

**Transparency:** Every successful agent run returns an `agentTrace` — plan steps, tool names, compact result previews — rendered in a collapsible panel under the AI action plan.

**Reliability:** Three-tier fallback (Hermes → Groq → static). Scans never break.

### Tech stack

- Next.js 16 (App Router), TypeScript, Tailwind v4
- Hermes Agent (OpenAI-compatible tool-calling loop)
- Groq fallback (`llama-3.3-70b-versatile`)
- Vitest — 35 tests covering tools, orchestrator, and fallback paths

### Try it

1. Visit [live demo URL]
2. Scan **Mumbai Chai Co.** (high risk — overdue GST, MCA, notices)
3. Expand **Agent investigation** to see the tool-call trace (when Hermes is enabled)
4. Scan **Razorpay** for a clean profile

---

## How Hermes Agent is at the heart of this project

This is not a thin wrapper around a single prompt. The scan route calls `runComplianceAgent()`, which:

1. Sends the structured health profile + tool schemas to Hermes
2. Runs a bounded loop (plan → tool call → observe → reason)
3. Records each step in `AgentTrace`
4. Returns the final founder-facing report

The deterministic scoring engine (`lib/scoring.ts`) stays the source of truth — Hermes **reasons about** structured facts rather than inventing numbers.

Key files:

- `lib/agent/orchestrator.ts` — agent loop
- `lib/agent/tools.ts` — tool definitions + dispatcher
- `lib/agent/hermes-client.ts` — OpenAI-compatible client
- `components/agent-trace.tsx` — trace UI panel

---

## Production setup

On Vercel (recommended — avoids heavy local LLM inference):

```bash
GROQ_API_KEY=your_key          # fast, reliable summaries
HERMES_ENABLED=false             # or true + a public Hermes URL (not localhost)
LEAD_WEBHOOK_URL=your_webhook    # optional
```

Set `HERMES_ENABLED=true` only when you have a **publicly reachable** Hermes endpoint. `localhost:8000` works for local dev with a running Hermes server; it cannot work on Vercel.

See `DEPLOY.md` in the repo for full instructions.

---

## What I learned

- Tool design matters more than prompt length — keeping tools bound to pre-computed health data prevents score hallucination
- Agent transparency (the trace panel) makes agentic work legible to users and judges
- Graceful fallback is non-negotiable for production — Hermes → Groq → static means the product never feels broken

---

## Tags

`#hermesagent` `#ai` `#nextjs` `#opensource` `#startup` `#showdev`
