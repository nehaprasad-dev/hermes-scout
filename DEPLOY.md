# Deploy CompliScore to Production (Vercel)

Use this when local dev is too slow (Hermes on a laptop) or the browser hangs.

## Recommended production setup (fast & reliable)

This runs the **Groq fallback path** on every scan — typically 2–4 seconds. The Hermes agent code ships in the repo and activates when you point it at a remote Hermes server.

### 1. Push to GitHub

```bash
cd compliscore
git add .
git commit -m "Hermes Agent integration for CompliScore"
git push origin main
```

### 2. Import in Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo
3. Set **Root Directory** to `compliscore` if the repo is `hermes-scout` with compliscore inside it
4. Framework preset: **Next.js**

### 3. Environment variables (Vercel → Settings → Environment Variables)

| Variable | Value | Required |
|----------|-------|----------|
| `GROQ_API_KEY` | Your key from [console.groq.com/keys](https://console.groq.com/keys) | **Yes** for AI summaries |
| `HERMES_ENABLED` | `false` | Recommended for prod until you have a remote Hermes URL |
| `LEAD_WEBHOOK_URL` | Discord/Slack webhook URL | Optional |

**Do not** set `HERMES_BASE_URL=http://localhost:8000` on Vercel — localhost is not reachable from Vercel's servers. The app auto-skips it anyway.

### 4. Deploy

Click **Deploy**. Your live URL will look like `https://compliscore-xxx.vercel.app`.

### 5. Verify

- Scan **Razorpay** — should return in a few seconds with an AI action plan
- Scan **Mumbai Chai** — high-risk result with penalty estimate
- Submit the lead form if `LEAD_WEBHOOK_URL` is set

---

## Optional: enable Hermes Agent in production

Only when you have Hermes running on a **public URL** (RunPod, Fly.io, a VPS, etc.):

| Variable | Example |
|----------|---------|
| `HERMES_ENABLED` | `true` |
| `HERMES_BASE_URL` | `https://your-hermes-server.com/v1` |
| `HERMES_MODEL` | `NousResearch/Hermes-3-Llama-3.1-8B` |
| `HERMES_API_KEY` | (if your server requires auth) |
| `HERMES_TIMEOUT_MS` | `12000` |
| `HERMES_MAX_STEPS` | `4` |

Successful Hermes runs show the **Agent investigation** collapsible panel with tool-call trace.

If Hermes fails or times out, the app falls back to Groq automatically.

---

## Local vs production

| | Local laptop | Vercel production |
|--|--------------|-------------------|
| Hermes on localhost | Possible but heavy; set `HERMES_ENABLED=true` | **Does not work** — use Groq or remote Hermes |
| Fast scans | `HERMES_ENABLED=false` + `GROQ_API_KEY` | Same — recommended default |
| Agent trace UI | Visible when Hermes succeeds locally | Visible when remote Hermes succeeds |

---

## DEV challenge checklist

- [ ] Deploy to Vercel with `GROQ_API_KEY`
- [ ] Test live URL with Mumbai Chai + Razorpay scans
- [ ] Copy `DEV_SUBMISSION.md` into a DEV post; add your live URL and repo link
- [ ] (Optional) Record demo: `node scripts/record-demo.mjs` against production URL
- [ ] Submit to **Build With Hermes Agent** on DEV
