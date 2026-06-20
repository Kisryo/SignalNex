# Compass — Project Master Document

> **Tagline:** *Transfer the relationship, not just the records.*
>
> Compass turns a firm's scattered, in-the-head client knowledge into secure
> organisational memory that survives staff turnover — and upskills advisors
> from their real work.

This document is the single source of truth for the idea, the problem, the
workflows, the features, and the architecture. Read this before writing code
or pitching.

---

## Table of contents

1. [The big idea (in plain English)](#1-the-big-idea-in-plain-english)
2. [The problem we are solving](#2-the-problem-we-are-solving)
3. [Why now / why no one else does this](#3-why-now--why-no-one-else-does-this)
4. [The solution — three modules, one memory](#4-the-solution--three-modules-one-memory)
5. [How it actually works (the data flow)](#5-how-it-actually-works-the-data-flow)
6. [User workflows (step-by-step)](#6-user-workflows-step-by-step)
7. [The full feature list (shipped + planned)](#7-the-full-feature-list-shipped--planned)
8. [Architecture & tech stack](#8-architecture--tech-stack)
9. [Demo script (the 5-minute story)](#9-demo-script-the-5-minute-story)
10. [Success metrics](#10-success-metrics)
11. [Glossary](#11-glossary)

---

## 1. The big idea (in plain English)

When a financial advisor resigns or retires, the firm assigns a **successor**
to their clients. The hard data — accounts, policies, IC numbers, transaction
history — already transfers cleanly because a CRM holds it.

But the **relationship** does not transfer. Things like:

- *"Mr Wong lights up when you talk about his daughter."*
- *"Never bring up the 2022 trust recommendation — he's still sore about it."*
- *"He defers to his wife on lifestyle decisions."*
- *"He texts in short bursts late evening."*
- *"He responds to concrete numbers, not abstract concepts."*

That knowledge lives **only in the departing advisor's head**. The successor
inherits the file but starts cold on the person. The client feels the reset,
and often churns.

**Compass captures that relational layer as firm-owned data, so it can be
handed over like any other asset.**

The same memory graph then powers two more wins:

- **Detect the advisor's own knowledge gaps** from their real work and serve
  matching micro-lessons (auto-logging CPD compliance hours).
- **Surface the right partner** (accountant, lawyer, mortgage broker) at the
  right moment based on what the client actually needs.

One product. One database. Three pain-killers.

---

## 2. The problem we are solving

Advisory firms run on two forms of knowledge they don't actually own:

1. What each advisor knows about each client.
2. What each advisor still needs to learn.

Both live in individual heads and disconnected tools. This creates **three real
problems** (we call them the three gaps):

### Gap 1 — The learning blind spot
- CPD (Continuing Professional Development) hours are usually **mandatory** by
  regulators in SEA.
- Existing learning platforms ask the advisor to **manually self-assess**
  their gaps — which is exactly the thing the advisor is bad at.
- Result: wasted hours, compliance scramble at year-end, knowledge gaps surface
  in front of clients.

### Gap 3 — Memory walks out the door  *(HEADLINE)*
- When an advisor leaves, the relational knowledge never transfers.
- The hard data is in the CRM; the soft context (how to actually talk to this
  person) was only in the advisor's head.
- The successor starts cold. The client feels it. Churn risk spikes.

### Gap 4 — Built for giants, not the rest
- The closest tools target **enterprise wealth firms** in Western markets, with
  enterprise budgets and integration teams.
- Small/mid-size firms in **Southeast Asia** (the AAG / ASG profile) are left
  with spreadsheets, WhatsApp groups, and memory.

> **Note on Gap 2:** the original framing had four gaps. We dropped Gap 2
> (operations) because it diluted the pitch. The current message is: *one
> problem (Gap 3), one underserved market (Gap 4), one compounding bonus
> (Gap 1).*

---

## 3. Why now / why no one else does this

- **CRMs store records, not relationships.** That's literally what they were
  designed for — accounts, deals, pipeline stages.
- **LLMs make extraction cheap.** Five years ago, turning a free-text note
  into structured relational signals was research. Today it's an API call.
- **SEA advisory firms are unloved.** Salesforce Financial Services Cloud
  starts at thousands per seat per month with a 6-month implementation.
  Compass is mobile-first, deployable in a day, priced for SMEs.
- **Privacy-aware by design.** Compass deliberately **avoids** regulated
  identity data (IC numbers, account numbers). It only captures the
  behavioural layer the CRM ignores. Differentiator *and* a defensible
  privacy posture.

---

## 4. The solution — three modules, one memory

```
            ┌─────────────────────────────────────────────────┐
            │             Advisor app (mobile + web)          │
            └─────────────────────────────────────────────────┘
                                  │
       ┌──────────────┬───────────┴───────────┬──────────────┐
       │              │                       │              │
 [Client memory] [Learning loop]      [Partner ecosystem]
       │              │                       │
       └──────────────┴───────────────────────┘
                       │
              ┌────────▼─────────┐
              │     AI layer     │   (summarise, extract, query, gap-detect)
              └────────┬─────────┘
                       │
        ┌──────────────▼────────────────┐
        │  Institutional memory graph    │
        │  (clients, notes, learning,    │
        │   partners, audit)             │
        └──────────────┬─────────────────┘
                       │
              ┌────────▼─────────┐
              │ Postgres + pgvector │
              └─────────────────────┘
```

### Module A — Client memory *(the spine)*
- Captures every interaction as firm-owned, structured data.
- Extracts the **behavioural / relational signals** a CRM never holds.
- Powers Q&A, briefings, and the handover pack.

### Module B — Learning loop *(Gap 1)*
- Scans recent notes → detects recurring or struggle topics.
- Vector-matches a micro-lesson from the content library.
- On completion, auto-logs the CPD compliance hours.

### Module C — Partner ecosystem *(Gap 3 stretch)*
- Surfaces the right partner at the right moment.
- Tracks referrals: introduced → engaged → closed.

All three modules **read from and write to the same memory graph**. That's the
architectural unlock — every feature compounds the value of every other.

---

## 5. How it actually works (the data flow)

### 5.1 Ingestion (a note comes in)

```
Advisor types or voice-captures a raw note
      │
      ▼
┌─────────────────────────────┐
│  LLM extraction (Anthropic) │   System prompt asks for STRICT JSON:
│                             │   - summary
│                             │   - commitments[]
│                             │   - sensitivities[]
│                             │   - relational[]  ⭐
│                             │   - topics[]
│                             │   - partner_mentions[]
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Embedding (OpenAI)         │   embed(summary + relational)
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Postgres insert            │   interactions row with vector(1536)
│  + audit_log entry          │
└─────────────────────────────┘
```

### 5.2 Retrieval (advisor asks a question)

```
Question
   │
   ▼
embed(question)
   │
   ▼
pgvector cosine search → top-5 relevant notes for THIS client
   │
   ▼
LLM answers using ONLY those notes, with citations
```

### 5.3 Gap detection (learning loop)

```
Recent notes for this advisor
   │
   ▼
embed(summary + relational + topics, concatenated)
   │
   ▼
pgvector match against learning_content
   │
   ▼
Top lessons surface with a similarity %  ("78% match · estate planning")
   │
   ▼
Advisor completes lesson → cpd_log row written
   │
   ▼
CPD dashboard auto-updates
```

### 5.4 Handover (the headline moment)

```
"Generate handover pack" button
   │
   ▼
Aggregate ALL of the client's interactions
   │
   ▼
Flatten + dedupe: relational[], sensitivities[], commitments[]
   │
   ▼
LLM composes a relationship one-pager:
   - Who they are
   - How to work with them   ⭐
   - What to avoid
   - Past advice + reasoning
   - Open commitments
   - Partner contacts
   │
   ▼
One-click PDF export
```

### 5.5 Briefing (calendar-driven)

```
Dashboard reads today's meetings (calendar)
   │
   ▼
For each: GET /api/brief/:clientId
   │
   ▼
Same RAG as 5.2, prompted for: "5 bullets — who, how they think, what to avoid today, open commitments, opening line"
```

---

## 6. User workflows (step-by-step)

### 👤 Workflow 1 — Aisyah captures a client interaction

1. After a coffee with Mr Wong, she opens Compass on her phone.
2. Taps **+ Log a client interaction**.
3. Picks the client (or it's pre-filled from the calendar).
4. Taps 🎙 **Voice capture** and dictates: *"Met Mr Wong over coffee. Lit up
   on daughter's education insurance. Shut down again when I brought up
   estate — still sore about 2022. Wants to look at ESG funds."*
5. Taps **Save & extract**.
6. Within 2 seconds, the client timeline shows:
   - Summary in neutral past tense.
   - Relational chips: *Lights up on family topics · Shuts down on estate
     planning.*
   - A new entry in **Commitments inbox**: *Share ESG fund factsheets.*

### 👤 Workflow 2 — Aisyah preps for tomorrow's meeting

1. Opens Compass at 9am. Dashboard shows **Today's briefings**.
2. Mr Wong is on at 10:30. She taps **Brief me**.
3. A 5-bullet briefing appears, citing past notes:
   - *"Lights up on family / insurance. Avoid estate planning today —
     still sore about 2022 trust. Open commitment: send ESG factsheets.
     Opening line: ask about his daughter's exam results."*
4. She walks in prepared. After the meeting, taps **+ Log post-meeting note**
   from the briefing page — loop closes.

### 👤 Workflow 3 — Compass detects a knowledge gap

1. Across her last 8 notes, Compass notices recurring ESG mentions and
   estate-planning resistance.
2. Tonight, her **Learning** tab surfaces two lessons with similarity scores:
   - *"Estate planning conversations with reluctant clients" · 84% match*
   - *"ESG fund basics for SEA portfolios" · 76% match*
3. She does the 15-minute lesson. Taps **Mark complete**.
4. Her **CPD** dashboard ticks up automatically: *15.5h / 30h.*
   No spreadsheet. No portal. No year-end scramble.

### 👤 Workflow 4 — Aisyah resigns. Daniel inherits Mr Wong.

1. Aisyah's last day: she clicks **Generate handover pack** on the Wong
   Family record.
2. Compass produces a one-page relationship briefing — *not* a data dump.
3. Daniel opens it on Monday morning. He sees:
   - **Who they are:** multi-gen household, family-first decisions.
   - **How to work with them:** afternoon meetings, family/insurance topics
     open the room, defer to wife on lifestyle.
   - **Avoid:** estate planning, anything 2022.
   - **Past advice + reasoning:** the trust recommendation context.
   - **Open commitments:** ESG factsheets, education plan options.
4. He taps **Export PDF**, prints it for his prep folder.
5. He walks into his first meeting with Mr Wong knowing exactly how to talk
   to him. **Mr Wong doesn't feel the reset. He stays.**

### 👤 Workflow 5 — Daniel (team lead) checks the firm

1. Opens **Admin** view.
2. Sees in one screen:
   - Total clients on platform · CPD compliance % · Continuity risk · Admin
     hours saved per advisor per week.
   - Clients-by-advisor list.
   - Live audit feed (who viewed what, when).
3. Confirms no advisor is sitting on undocumented relationships. Compliance
   posture is provable, not assumed.

---

## 7. The full feature list (shipped + planned)

### ✅ Shipped (working in the repo)

**Core memory**
- AI extraction with relational signals (Anthropic Claude)
- Embeddings + pgvector retrieval (OpenAI)
- Client timeline with relational chips
- Natural-language Q&A grounded in client's notes (RAG)
- One-click handover pack
- PDF export of handover pack

**Learning loop**
- Vector-similarity lesson matching (not manual self-assessment)
- Mark-complete server action
- Auto-CPD log + dashboard with progress bar

**Daily-use hooks**
- Calendar-driven dashboard briefings
- Pre-meeting briefing page with one-click "log post-meeting note"
- Commitments inbox — every promise auto-extracted
- 🎙 Voice capture (Web Speech API)

**Security / governance**
- Login (Supabase auth + demo bypass)
- Auth middleware gating every page
- Role-based access (advisor sees only own clients via RLS)
- Audit log on every client view + admin audit page

**Firm operations**
- Partner directory + referral pipeline (introduced → engaged → closed)
- Team-lead admin overview with live metrics
- Pitch deck route at `/pitch` (print-friendly)
- ↺ Demo reset button in header

**Infra**
- Next.js 14 app router + Tailwind
- Supabase schema + seed + pgvector RPC functions
- Embeddings backfill script
- Vercel deploy config (Singapore region)
- Dual-mode data layer (Supabase when configured, in-memory otherwise)

### 🔜 Planned (in TASKS.md)

**P0 — Striking features to ship next**
- 🚦 **Traffic-light meeting coach** — 🟢 safe / 🔴 avoid / 🟡 explore
- **Successor mode** — 30-day inheritance plan, not a static doc
- **Churn risk score** — behavioural drift detection per client

**P1 — Strong nice-to-haves**
- Bahasa + Mandarin extraction
- Compliance flagger (catches "guaranteed returns" type slips)
- Trust thermometer (gauge over time)
- "Fake resign" demo button

**P2 — Polish**
- Knowledge-check quiz after each lesson
- Family/network graph
- WhatsApp inbound webhook
- Dark mode, PWA install, brand pass

See [TASKS.md](TASKS.md) for the full breakdown with effort estimates and
dependencies.

---

## 8. Architecture & tech stack

### Stack

- **Frontend + API:** Next.js 14 (app router), Tailwind, TypeScript
- **DB + auth + vectors:** Supabase (Postgres + pgvector + auth)
- **AI:**
  - Anthropic Claude (`claude-opus-4-7`) — extraction + Q&A
  - OpenAI (`text-embedding-3-small`) — embeddings
- **Hosting:** Vercel (region pinned to `sin1`)

### Repo layout

```
app/
  page.tsx                 dashboard (live metrics + today's briefings)
  login/                   Supabase auth or demo bypass
  clients/
    page.tsx               client list
    [id]/page.tsx          profile + timeline + ask box
    [id]/ask/page.tsx      RAG Q&A
    [id]/brief/page.tsx    pre-meeting briefing
    [id]/handover/page.tsx handover pack + Export PDF
  notes/new/page.tsx       note capture (with voice)
  learning/page.tsx        vector-matched lessons
  cpd/page.tsx             CPD compliance dashboard
  commitments/page.tsx     auto-extracted commitments inbox
  partners/page.tsx        directory + referral pipeline
  admin/page.tsx           team-lead firm overview
  audit/page.tsx           audit trail
  pitch/page.tsx           speaker-deck slides
  api/
    extract/               POST raw_note → JSON extraction
    brief/[id]/            GET → 5-bullet briefing
    reset/                 POST → reseed demo state
    logout/                POST → clear demo cookie

components/
  VoiceNoteInput.tsx       Web Speech API capture
  PrintButton.tsx          window.print() for PDF export
  DemoResetButton.tsx

lib/
  ai.ts                    LLM extraction + Q&A + embeddings (with fallbacks)
  data.ts                  data layer facade (in-memory or db)
  db.ts                    Supabase implementations
  supabase.ts              client factories
  calendar.ts              seeded meetings (replaceable with real cal sync)

supabase/
  schema.sql               tables + pgvector + RLS policies
  seed.sql                 advisors, clients, interactions, lessons
  functions.sql            match_lessons + match_interactions RPCs

scripts/
  embed-lessons.ts         backfill embeddings on existing rows

middleware.ts              auth gate
vercel.json                Vercel config
```

### Data model (the 7 core tables)

- `advisors` — id, name, email, role *(advisor / team_lead / admin)*
- `clients` — id, name, owning_advisor_id, profile *(jsonb)*
- `interactions` — id, client_id, advisor_id, raw_note, summary,
  **commitments** *(jsonb)*, **sensitivities** *(jsonb)*,
  **relational** *(jsonb)* ⭐, **topics** *(jsonb)*,
  partner_mentions *(jsonb)*, embedding *(vector 1536)*, created_at
- `learning_content` — id, title, topic, body, cpd_hours, embedding
- `cpd_log` — id, advisor_id, learning_content_id, hours, completed_at
- `partners` — id, name, specialty, contact
- `audit_log` — id, advisor_id, client_id, action, created_at

The **`relational` jsonb column** is the architectural differentiator. It's
the thing no CRM has and Compass always does.

### Security model

- Every page redirects to `/login` unless an auth cookie exists.
- Supabase RLS policies enforce "advisor sees only their own clients" at the
  *database* level, not just the UI level.
- Every client-record access writes an `audit_log` row.
- Compass deliberately never stores regulated identity data (IC, account
  numbers) — privacy-aware by design.

---

## 9. Demo script (the 5-minute story)

> Rehearse this until it's effortless. The story sells, not the slides.

**Pre-seed:** Wong family client + 3 historical notes + 3 lessons + 3
partners + 3 referrals are already in the system.

**Step 1 — Set the stakes (30s)**
> *"An advisor in Malaysia just resigned. Her firm assigns a successor to
> Mr Wong, a 7-year client. The CRM transfers his accounts perfectly. But
> within 6 months, Mr Wong leaves. Why? Because the new advisor brought up
> the 2022 trust recommendation in their first meeting — exactly the thing
> Mr Wong is still sore about. Nobody told her. It wasn't in the CRM. It
> was in the previous advisor's head."*

**Step 2 — Show the dashboard (20s)**
> *"This is Compass. Aisyah's morning view — today's meetings, CPD
> compliance, open commitments, all live."*

**Step 3 — Capture a note (45s)**
> Click **+ Log interaction** → use voice → dictate the Wong coffee note →
> save → show the relational chips that appear on the timeline.

**Step 4 — Brief me (30s)**
> Back to dashboard → click **Brief me** on Wong → show the 5-bullet
> grounded briefing.

**Step 5 — Learning loop (45s)**
> Open Learning → show two lessons surfaced **with similarity scores** →
> mark one complete → flip to CPD dashboard → show the hours auto-incremented.

**Step 6 — The handover moment (60s)**
> *"Aisyah just resigned."* → click **Generate handover pack** → walk through
> the one-pager → emphasise the *"how to work with them"* section → click
> **Export PDF**.

**Step 7 — The buyer's screen (30s)**
> Open Admin → show firm-wide metrics → audit feed → *"This is what the
> firm owner sees. Compliance is provable, not assumed."*

**Step 8 — Close (20s)**
> *"One platform. Three pain-killers. Built for the SEA firms nobody else
> serves. Compass: transfer the relationship, not just the records."*

---

## 10. Success metrics

What we'll measure (and what we'll claim on the final slide):

| Metric | How it shows up | Source |
|---|---|---|
| Admin time saved per advisor per week | Auto-extraction removes manual note typing + manual CPD logging | Estimated 6h/wk |
| % of CPD hours auto-logged vs manual | Dashboard contrast | `cpd_log` source field |
| Gap-to-lesson completion rate | What % of detected gaps result in a completed lesson | `cpd_log` join |
| Client retention through advisor transitions | Year-on-year churn delta when handover pack is used | Firm-level metric |
| Time-to-productivity for inheriting advisor | Days from inheritance to first independent client meeting | Self-reported |

---

## 11. Glossary

- **CRM** — Customer Relationship Management. Standard software (Salesforce,
  HubSpot) for storing customer **records**. Doesn't store relational
  signals.
- **Relational signals** — Behavioural context about a client: tone,
  triggers, preferences, trust state, communication style. The thing
  Compass uniquely captures.
- **CPD** — Continuing Professional Development. Mandatory learning hours
  for advisors in SEA, tracked by regulators.
- **Handover pack** — Compass's one-click relationship one-pager generated
  for a successor when an advisor leaves.
- **Memory graph** — The relationships between clients, interactions,
  lessons, and partners in our Postgres schema — plus vector embeddings
  for semantic search.
- **pgvector** — Postgres extension for storing and searching vector
  embeddings.
- **RAG** — Retrieval-Augmented Generation. Embed a question, vector-search
  relevant notes, feed only those to the LLM so the answer is grounded and
  citable.
- **RLS** — Row-Level Security. Postgres feature that enforces "user X can
  only read rows they own" at the database level.
- **Gap 1 / 3 / 4** — Shorthand for the three problems we solve. Gap 3
  (memory walks out) is the headline; Gap 1 (learning) compounds for free;
  Gap 4 (SME affordability) is the wedge.

---

## Companion documents

- **[CLAUDE.md](CLAUDE.md)** — The original project brief and conventions
- **[TASKS.md](TASKS.md)** — Remaining work split by FE / BE / FS with deps
- **[DEPLOY.md](DEPLOY.md)** — Vercel + Supabase setup runbook
- **[README.md](README.md)** — One-paragraph repo overview
- **[problem-statement.md](problem-statement.md)** — Pitch framing
- **[design.md](design.md)** — Architecture notes
- **[plan.md](plan.md)** — Workflow / plan
- **[task.md](task.md)** — Original implementation checklist
