# CompliScore

**Check your startup's compliance health in 60 seconds.**

Type a company name. Get a score out of 100, see what's overdue, estimate penalty exposure, and read a plain-English action plan — no CA jargon, no login.

Built for the [Hermes Agent Challenge](https://dev.to/challenges/hermes-agent-2026-05-15) — the AI layer uses **Hermes Agent** for planning, tool use, and multi-step reasoning, with a visible agent trace so you can see how the report was built.

| | |
|---|---|
| **Live demo** | https://hermes-scout.vercel.app *(update after you deploy)* |
| **Repo** | https://github.com/nehaprasad-dev/hermes-scout |

---

## Why this exists

Indian founders move fast. GST returns, MCA filings, random notices — most people don't know where they stand until a CA tells them they're behind. By then, penalties are already adding up.

CompliScore gives you a quick gut-check: **type a name, get a score, see what to fix first.** It's a demo product (fictional data), but the experience is real enough to know if you need help.

---

## What you get from a scan

| Output | What it means |
|--------|----------------|
| **Score (0–100)** | Green, amber, or red — how healthy the profile looks |
| **Risk level** | Low, Medium, or High |
| **Pending tasks** | Overdue GSTR-3B, MCA returns, notices — listed one by one |
| **Penalty estimate** | Rough INR range if things stay unresolved (not legal advice) |
| **AI action plan** | What to fix first, what's urgent, what can wait |
| **Agent investigation** | *(when Hermes is on)* Collapsible trace of the agent's plan and tool calls |

There's also a lead form for founders who want a paid, filings-backed scan (₹5,000, 2-hour delivery). See [PLAYBOOK.md](./PLAYBOOK.md) for how that works.

---

## How Hermes Agent fits in

CompliScore used to call Groq once and print a summary. Now it can run a real **agent loop**:

```
You scan a company
    → scoring engine computes the score (always deterministic)
    → Hermes plans what to investigate
    → Hermes calls tools (penalties, filing calendar, notices…)
    → Hermes writes the final report
    → UI shows the report + agent trace
```

If Hermes isn't available, the app falls back to **Groq**, then a **static summary**. The scan never breaks.

### The four tools Hermes can call

Scores and penalties come from code — the model doesn't make up numbers.

| Tool | What it does |
|------|----------------|
| `score_company` | Returns score, risk level, pending tasks |
| `estimate_penalty` | GST / MCA / notice penalty breakdown |
| `filing_calendar` | Upcoming GSTR-3B, GSTR-1, MCA deadlines |
| `classify_notices` | Labels each notice by category and severity |

Hermes talks to a **self-hosted OpenAI-compatible API** (vLLM, LM Studio, Ollama, etc.). See `lib/agent/` for the implementation.

---

## Quick start

**You need:** Node 20+ and npm.

```bash
git clone https://github.com/nehaprasad-dev/hermes-scout.git
cd hermes-scout
npm install
cp .env.local.example .env.local
```

Edit `.env.local` — for everyday dev, this is enough:

```bash
GROQ_API_KEY=your_key_here          # free at https://console.groq.com/keys
HERMES_ENABLED=false                # keep false unless Hermes is running locally
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and scan **Razorpay** or **Mumbai Chai**.

### Other commands

```bash
npm run build    # production build
npm run start    # serve production build
npm run test     # run Vitest (36 tests)
npm run lint     # ESLint
```

---

## Environment variables

Copy `.env.local.example` to `.env.local`. Never commit `.env.local`.

| Variable | Required? | What it does |
|----------|-----------|--------------|
| `GROQ_API_KEY` | Recommended | Powers AI summaries when Hermes is off or fails |
| `HERMES_ENABLED` | No | Set `true` only when a Hermes server is running |
| `HERMES_BASE_URL` | If Hermes on | e.g. `http://localhost:8000/v1` |
| `HERMES_MODEL` | If Hermes on | e.g. `NousResearch/Hermes-3-Llama-3.1-8B` |
| `HERMES_API_KEY` | No | Only if your Hermes server requires auth — often leave empty |
| `HERMES_TIMEOUT_MS` | No | Max time for an agent run (default `12000`) |
| `HERMES_MAX_STEPS` | No | Max tool-call rounds (default `4`) |
| `LEAD_WEBHOOK_URL` | No | Discord / Slack / Zapier webhook for lead form |

**Local tip:** Running Hermes on a laptop is slow and can freeze the browser. Use `HERMES_ENABLED=false` locally and deploy to Vercel for a smooth demo.

**Production tip:** On Vercel, set `HERMES_ENABLED=false` and `GROQ_API_KEY` — `localhost` Hermes cannot be reached from the cloud.

---

## Companies to try

**Homepage chips:** Razorpay, Zepto, Meesho, Khatabook

| Try this | What you'll see |
|----------|-----------------|
| **Mumbai Chai Co.** | High risk — overdue GST, MCA, multiple notices |
| **Razorpay** | Clean profile, score 100 |
| **Bengaluru Bytes** | Clean fictional company |
| **Any other name** | Synthetic profile, labelled "Sample data" |

All compliance details are **fictional** — for demo only. Real well-known names are used for recognition, not to claim their actual filing status.

---

## Project layout

```
app/
  page.tsx                 # Landing page + scanner
  api/scan/route.ts        # Scan API — scoring + Hermes/Groq
  api/lead/route.ts        # Lead form webhook

components/
  scanner.tsx              # Main UI
  agent-trace.tsx          # Collapsible Hermes trace panel
  lead-form.tsx            # Paid scan CTA

lib/
  scoring.ts               # Deterministic score (source of truth)
  mock-data.ts             # ~36 curated company profiles
  agent/                   # Hermes loop, tools, fallback, tests

scripts/
  record-demo.mjs          # Record a demo video (Playwright)
  encode-demo.sh           # Convert to MP4 + GIF
```

More detail: [DEPLOY.md](./DEPLOY.md) · [DEV_SUBMISSION.md](./DEV_SUBMISSION.md) · [PLAYBOOK.md](./PLAYBOOK.md)

---

## Deploy to production

The easiest path is **Vercel + Groq** (fast scans, no local GPU needed).

1. Push this repo to GitHub  
2. Import at [vercel.com/new](https://vercel.com/new)  
3. Set `GROQ_API_KEY` and `HERMES_ENABLED=false`  
4. Deploy  

Full steps: **[DEPLOY.md](./DEPLOY.md)**

---

## Record a demo video

With the dev server running:

```bash
node scripts/record-demo.mjs
bash scripts/encode-demo.sh
```

Produces a short reel (Razorpay + Khatabook scans) for your DEV post or socials.

---

## Important disclaimer

- All data in this app is **demo / fictional**. No government portals are connected.  
- PAN and GSTIN values are **format-only placeholders**, not real identifiers.  
- Penalty numbers are **directional estimates**, not legal advice.  
- For real compliance work, talk to a Chartered Accountant.

---

## Tech stack

Next.js 16 · TypeScript · Tailwind CSS v4 · Framer Motion · Hermes Agent (OpenAI-compatible) · Groq · Vitest · Vercel

No database. No auth. Ships on the free tier.

---

Built with Next.js, Hermes Agent, Groq, and a lot of chai.
