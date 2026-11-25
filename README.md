<div align="center">

# Milan

**Your wedding, beautifully in sync.**

An AI wedding operations agent for Indian weddings. Milan calls your wedding vendors in their language, gets the answers, and brings back only the decisions that need you.

[Landing page](apps/landing/index.html) · [Wireframes](docs/wireframes/index.html) · [Demo video](#demo) · [How it works](#how-it-works) · [Sponsor tools](#how-we-use-the-sponsor-tools) · [Run it locally](#run-it-locally)

Built for **FestiveHacks** by WeMakeDevs, with **Sarvam**, **Flagsmith** and **NudgeBee**.

</div>

---

## The problem

India expects about **52 lakh weddings between 21 November and 15 December 2026**, more than two lakh a day ([CAIT, via Deccan Chronicle](https://www.deccanchronicle.com/nation/52-lakh-marriages-rs75-lakh-crore-of-business-this-wedding-season-cait-2006168)). Every one of them runs on vendors: caterers, decorators, bands, pandits, photographers. Almost all of them work by phone.

So one person in every family becomes the wedding's unpaid operations team: calling for quotes, comparing prices that are never quoted the same way, chasing confirmations, and passing every change on to everyone else.

Apps help you **find** vendors (WedMeGood) or **manage guests** (Weddingkart). Nothing **talks to the vendors** for you.

## What Milan does

You give Milan a job in plain words:

> "Find me a vegetarian caterer for 250 guests, within ₹1,000 per plate."

Milan:

1. Picks the caterers from your vendor list.
2. **Calls each one in Hindi** (or Marathi, and more), introducing itself as your AI assistant.
3. Asks every vendor the same questions: date free? price? what's included? advance?
4. Turns each call into structured answers and a side-by-side comparison.
5. Recommends one, and **asks you before booking**, with the cost and the reason.
6. Calls back to confirm, sends the vendor a written summary, and keeps the family posted.

When plans change ("the guest count is now 300"), Milan works out what's affected, calls the vendor back, recalculates the cost, and asks you again if it's over budget.

## Demo

- **Demo video:** Coming soon
- **Live app:** Coming soon

| Real in this demo | Simulated in this demo |
|---|---|
| Phone calls, Sarvam speech and voice, the agent, quote extraction, comparisons, approvals, Flagsmith rules, Kubernetes and NudgeBee monitoring | Vendors are teammates answering real phones with scripted prices. No real money moves. |

## How it works

```
Family (web app)
   │  "Find a veg caterer…"
   ▼
API + Agent ──── reads rules ────► Flagsmith
   │  creates call tasks
   ▼
Calls (Kubernetes)        ◄──── watched by ──── NudgeBee
   │  audio in/out
   ├──► Sarvam: speech-to-text, text-to-speech, translation
   ▼
Phone line (Twilio or Exotel) ──► Vendor's phone
   │
   ▼
Postgres: weddings, vendors, jobs, calls, quotes, decisions, activity
```

**The app has three places** (see the [wireframes](docs/wireframes/index.html)):

- **Home:** what needs you, and what Milan is doing right now.
- **Jobs:** give Milan a task and watch it get done.
- **Vendors:** everyone you're dealing with, across every function.

Haldi, mehendi, sangeet, wedding and reception are labels on vendors and jobs, not separate sections.

## How we use the sponsor tools

### Sarvam: the voice of every call
- **Speech-to-text** on the vendor's side of the call, including prices said out loud ("pandrah sau per plate").
- **Text-to-speech** so Milan speaks natural Hindi and Marathi.
- **Translation** of transcripts into English for the family.
- Code: [`apps/call-worker/src/sarvam.ts`](apps/call-worker/src/sarvam.ts)

### Flagsmith: the rules an agent must follow
Milan reads these before every call and every commitment. Each wedding is a Flagsmith identity, so families can have different rules.

| Flag | Type | Default | What it controls |
|---|---|---|---|
| `calls_enabled` | on/off | on | **Kill switch.** Off stops all calls immediately; live calls end politely. |
| `approval_over_budget` | on/off | on | Over-budget choices become a decision for the family instead of a booking. |
| `max_price_per_plate` | value | 1000 | Quotes above it are marked over budget. |
| `call_languages` | value | `hi,mr` | Languages Milan may use on calls. |
| `max_parallel_calls` | value | 3 | How many vendors Milan calls at once. |
| `ai_disclosure` | on/off | on | Every call opens by saying Milan is an AI assistant. Never turned off in production. |

- Definitions: [`config/flagsmith/flags.json`](config/flagsmith/flags.json)
- Code: [`apps/api/src/agent/rules.ts`](apps/api/src/agent/rules.ts)

### NudgeBee: keeping it running in peak season
- Milan runs as a Kubernetes deployment ([`deploy/k8s/milan.yaml`](deploy/k8s/milan.yaml)), with health checks and its job state on a persistent volume.
- NudgeBee monitors the cluster, flags crashed or unhealthy pods, and helps find the cause.
- NudgeBee Cloud's AI (NuBi) investigates incidents and traces them to a root cause, with a causality chain and the evidence.
- Demo: a bad config push crash-loops Milan mid-job. NudgeBee flags it, NuBi traces it to the missing Sarvam key, we roll back with approval, and the wedding job is still there. Setup and script: [`docs/k8s-nudgebee.md`](docs/k8s-nudgebee.md).

## Tech stack

| Part | Choice |
|---|---|
| Web app | Next.js, TypeScript |
| API and agent | Node.js, TypeScript, LLM with tool calls |
| Call workers | Node.js, phone audio streamed to Sarvam |
| Phone line | Twilio or Exotel |
| Database | Postgres (Supabase or local Docker) |
| Queue | Redis |
| Infra | Docker, Kubernetes (kind locally), NudgeBee |

## Repo structure

```
milan/
├── apps/
│   ├── landing/             # marketing landing page (static HTML, parallax + micro-animations)
│   ├── web/                 # Next.js app: setup, home, jobs, approvals, vendors
│   ├── api/                 # REST API + the agent
│   │   └── src/
│   │       ├── agent/       # planner, tools, rules (Flagsmith), quote extraction
│   │       └── routes/      # weddings, vendors, jobs, decisions, imports
│   └── call-worker/         # runs phone calls: phone line ⇄ Sarvam ⇄ agent
│       └── src/
├── packages/
│   ├── shared/              # shared types (Wedding, Vendor, Job, Call, Decision)
│   └── db/                  # SQL migrations and demo seed data
├── config/
│   └── flagsmith/           # flag definitions and defaults
├── deploy/
│   └── k8s/                 # Kubernetes manifests + up.sh (kind) for NudgeBee
├── docs/
│   ├── wireframes/          # clickable greyscale wireframes (open index.html)
│   ├── wireframes.md        # screens and flows, in words
│   └── demo/                # demo script and vendor personas for the video
├── docker-compose.yml       # Postgres + Redis for local dev
├── .env.example
└── README.md
```

## See the designs

- **Landing page:** open [`apps/landing/index.html`](apps/landing/index.html) in a browser, or publish it with GitHub Pages (Settings → Pages → deploy from the `main` branch).
- **Wireframes:** open [`docs/wireframes/index.html`](docs/wireframes/index.html) and click through the five screens.

## Run it locally

**You need:** Node 20+, pnpm, Docker, and API keys for Sarvam, Flagsmith, your LLM provider and Twilio or Exotel.

```bash
git clone https://github.com/815246227853/milan.git milan && cd milan
cp .env.example .env            # add your keys
pnpm install
docker compose up -d            # Postgres + Redis
pnpm db:migrate && pnpm db:seed # demo wedding: Riya's, 12 Dec, Nagpur
pnpm dev                        # web on :3000, api on :4000, call-worker on :4100
```

Phone calls need a public URL for the phone line's webhooks during local dev, for example with `ngrok http 4100`, set as `PUBLIC_CALL_URL` in `.env`.

### Run it on Kubernetes (for NudgeBee)

Needs Docker, kind and kubectl. Uses `SARVAM_API_KEY` and `OPENAI_API_KEY` from `.env`.

```bash
./deploy/k8s/up.sh              # kind cluster + build + deploy → http://localhost:8080
```

Connecting NudgeBee and the demo moments: [`docs/k8s-nudgebee.md`](docs/k8s-nudgebee.md).

## Data model

`weddings` → `functions` (haldi, sangeet…) → `vendors` → `jobs` → `calls` (transcripts) → `quotes` → `decisions` (needs approval) → `activity` (everything Milan did). Schema: [`packages/db/migrations/001_init.sql`](packages/db/migrations/001_init.sql).

## Principles

1. **Action over advice.** Milan does the work, not a checklist.
2. **You stay in control.** Money and commitments always come back to you.
3. **Honest by default.** Every call says Milan is an AI assistant.
4. **Visible.** Everything Milan does shows up in the activity feed.
5. **Their language.** Vendors talk the way they're comfortable.

## Roadmap

- WhatsApp: tag @Milan in the family group
- Day-before and day-of reconfirmation calls for every vendor
- Timeline dependencies: one delay re-plans everything it affects
- Payment reminders for advances and balances

## Team

| Name | Role |
|---|---|
| [NAME] | Product, design, demo |
| [NAME] | Voice and calls |
| [NAME] | Agent and API |
| [NAME] | Infra and sponsors |

## License

MIT
