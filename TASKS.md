# Compass · Remaining Work Plan

> Use this as the standup board. Tasks are grouped by role with effort + dependencies.
> **P0 = must ship for the demo. P1 = strong nice-to-have. P2 = polish.**

---

## 🎨 Frontend tasks

| # | Task | Priority | Effort | Depends on |
|---|---|---|---|---|
| F1 | **Traffic-light meeting coach** card on `/clients/[id]/brief` (🟢 safe / 🔴 avoid / 🟡 explore) | **P0** | 30 min | B1 |
| F2 | **Successor mode** UI on handover pack — render a 30-day timeline of actions | P1 | 1 hr | B2 |
| F3 | **Churn risk** badge on client card + admin row (`Low / Watch / At-risk`) | P1 | 30 min | B3 |
| F4 | **"Fake resign" button** on admin → animated handover generation modal | P1 | 45 min | none |
| F5 | Mobile polish pass — bigger tap targets, safe-area padding, hide desktop chrome | P1 | 1 hr | none |
| F6 | Empty states + loading skeletons on every list page | P1 | 45 min | none |
| F7 | **Brand pass** — logo, accent colour tune, font upgrade (Inter / Geist) | P2 | 45 min | none |
| F8 | Dark mode toggle | P2 | 1 hr | none |
| F9 | PWA install prompt + manifest + icons | P2 | 30 min | none |
| F10 | Confetti when handover pack is generated (memorable demo moment) | P2 | 15 min | none |

---

## 🔧 Backend tasks

| # | Task | Priority | Effort | Depends on |
|---|---|---|---|---|
| B1 | **`getMeetingCoach(clientId)`** — return `{safe[], avoid[], explore[]}` from extracted relational + sensitivities + topics | **P0** | 30 min | extraction (done) |
| B2 | **`getSuccessorPlan(clientId)`** — LLM-generates a 30-day action plan from handover data | P1 | 45 min | none |
| B3 | **`getChurnRisk(clientId)`** — score from note sentiment + interaction frequency + sensitivity count | P1 | 1 hr | none |
| B4 | **Real Supabase wiring** end-to-end test (currently dual-mode) | **P0** | 1 hr | env vars |
| B5 | **RLS verification** — confirm advisors can't read other advisors' clients | **P0** | 30 min | B4 |
| B6 | **Compliance flagger** — extract risky phrases ("guaranteed returns", etc) → surface on admin | P1 | 45 min | extraction |
| B7 | **Knowledge-check quiz** generator after each lesson (3 questions, LLM) | P2 | 1 hr | none |
| B8 | **Bahasa + Mandarin** extraction — add language hint to system prompt | P1 | 30 min | none |
| B9 | WhatsApp webhook mock route (`/api/whatsapp/inbound`) | P2 | 30 min | none |
| B10 | Embeddings backfill script — verify it runs cleanly against real Supabase | **P0** | 15 min | B4 |

---

## 🌀 Full-stack tasks (touch both)

| # | Task | Priority | Effort | Depends on |
|---|---|---|---|---|
| FS1 | **End-to-end demo flow test** — login → note → brief → learning → CPD → handover → admin → reset, with zero breaks | **P0** | 1 hr | F1, B1 |
| FS2 | **Seed quality pass** — make the Wong family notes vivid + emotionally resonant (the demo lives or dies on these) | **P0** | 30 min | none |
| FS3 | **Trust thermometer** per client (B: score endpoint, F: gauge chart) | P1 | 1.5 hr | B3 |
| FS4 | **Family/network graph** view (B: aggregate from partner_mentions + profile, F: render with simple SVG or react-flow) | P2 | 2 hr | none |
| FS5 | **Slack/email notification stub** when commitment overdue | P2 | 45 min | none |
| FS6 | **Onboarding tour** — 4-step Shepherd.js-style intro on first login | P2 | 1 hr | none |

---

## 📣 Pitch & demo (non-code)

| # | Task | Priority | Effort | Owner |
|---|---|---|---|---|
| D1 | **Refine `/pitch` slide copy** — sharper hooks, add metrics, add screenshots | **P0** | 30 min | anyone |
| D2 | **Record backup demo video** (in case wifi dies) | **P0** | 30 min | anyone |
| D3 | **3× live rehearsal** of full demo flow with timer | **P0** | 1 hr | team |
| D4 | **Success-metrics slide** with real numbers (admin time saved, churn delta, etc.) | **P0** | 20 min | anyone |
| D5 | One-page PDF leave-behind from `/pitch` | P2 | 15 min | anyone |

---

## 🚦 What ships depending on time left

### If we have **< 1 hour**
→ F1 + B1 (traffic-light coach) + FS1 (end-to-end test) + FS2 (seed quality) + D3 (rehearsal)

That's the minimum striking demo.

### If we have **2–3 hours**
→ Above + F2 + B2 (successor mode) + F3 + B3 (churn risk) + F4 (fake resign button) + F5 (mobile polish)

This is the **dream demo flow**: log a note → traffic-light coach updates → fake resign → successor sees a 30-day plan → admin shows churn risk dropping.

### If we have **a full day**
→ Above + B6 (compliance flagger) + B8 (Bahasa) + F7 (brand pass) + FS3 (trust thermometer) + B7 (knowledge quizzes)

Now it's a real product, not a hackathon demo.

---

## 🔗 The dependency graph (read top to bottom)

```
[B1 meeting coach API] ──► [F1 traffic-light UI] ──┐
                                                   │
[B2 successor plan API] ─► [F2 timeline UI] ───────┤
                                                   ├──► [FS1 end-to-end test] ──► [D3 rehearsal]
[B3 churn risk API]    ─► [F3 risk badges]   ─────┤
                                                   │
[B4 Supabase wiring]   ─► [B5 RLS check]          │
                          [B10 embeddings backfill] ┘
```

Bottom line: **B1 unblocks the most. Start there.**

---

## ✋ Who picks up what (suggested split)

- **Frontend dev:** F1 → F3 → F4 → F5 (UI polish + the striking visuals)
- **Backend dev:** B1 → B2 → B3 → B6 (the new AI features), then B4 + B5 (productionise Supabase)
- **Full-stack / lead:** FS1 (own the demo flow) + FS2 (seed quality) + D1 + D3 (pitch)

If solo: do **B1 → F1 → FS2 → FS1 → D3** in that exact order. That's the critical path.
