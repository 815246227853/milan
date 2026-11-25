<div align="center">

# Milan

**Shaadi ka kaam, phone par.**

Tell Milan what you need for the wedding. It finds vendors near you on Google Maps, calls each one through Bolna in Hindi, and brings back quotes you can compare and book.

</div>

---

## The problem

India has about 52 lakh weddings between 21 November and 15 December 2026. Every one of them runs on vendors (caterers, halls, decorators, bands, pandits), and almost all of them work by phone. One person in every family ends up calling for quotes, comparing prices that are never quoted the same way, and chasing confirmations.

## What Milan does

> "Find a pure veg caterer near Dharampeth for 300 guests, within ₹1,000 a plate"

1. **Reads the request**: category, area, guests, budget, wishes (LLM, with a rule-based fallback).
2. **Finds vendors**: top-rated places with a phone number near that area on Google Maps.
3. **You choose who gets called.** Nothing is dialled until you tap *Call*.
4. **Calls them in parallel** with a Bolna voice agent (Sarvam speech in Hindi and other Indian languages). Every call opens by saying Milan is an AI assistant.
5. **Turns each call into a quote**: free on the date? price? what's included? advance?
6. **Compares and recommends** one, with how far it is under or over budget.
7. **Books on your tap.** If it is over budget, you're asked first. Then it calls the vendor back to confirm.

## Run it

Node 22.13+ (uses the built-in `node:sqlite`).

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:3000
```

With no keys, everything still works: sample vendors, simulated calls with Hinglish transcripts, and rule-based parsing. Add keys to make it real:

| Key | Turns on |
|---|---|
| `BOLNA_API_KEY` + `BOLNA_AGENT_VENDOR` | Real phone calls. Run `npm run sync-agent` once to create the agent and fill in its id. |
| `DEMO_PHONE_NUMBERS` | Demo mode: every call rings these numbers (teammates playing vendors) instead of the vendor. Leave empty to call real vendors. |
| `GOOGLE_PLACES_API_KEY` | Real vendor search (Places API (New), Text Search). |
| `OPENAI_API_KEY` | Better request reading and quote extraction from transcripts. |
| `FLAGSMITH_ENVIRONMENT_KEY` | Live rules (below). Defaults apply without it. |

### Flagsmith rules (optional)

| Flag | Default | What it does |
|---|---|---|
| `calls_enabled` | on | Kill switch for new calls. |
| `approval_over_budget` | on | Over-budget bookings need "Book anyway". |
| `max_parallel_calls` | 3 | How many vendors are on the phone at once. |

Create all three flags in Flagsmith if you use it. A flag that is missing counts as off.

## How it fits together

```
Next.js app (mobile-first)            src/app, src/components
   │  POST /api/jobs  "find a caterer…"
   ▼
Agent                                  src/lib/agent
   ├─ parse.ts     request → brief (OpenAI or rules)
   ├─ places.ts    Google Places → shortlist (sample vendors without a key)
   ├─ runner.ts    queue → dial → poll → quote → compare → book
   ├─ bolna.ts     POST /call, GET /executions/:id
   ├─ extract.ts   transcript → quote
   └─ simulate.ts  practice calls when Bolna isn't set up
   ▼
SQLite (data/milan.db)                 src/lib/db.ts, src/lib/repo.ts
```

The job page polls `GET /api/jobs/:id`, which advances calls by reading Bolna executions, so no public webhook URL is needed.

Bolna agent: [`bolna/vendor.json`](bolna/vendor.json) and its prompt [`bolna/prompts/vendor.md`](bolna/prompts/vendor.md).

## Tests

```bash
npm test
npm run typecheck
```

## Principles

1. **You stay in control.** Milan never dials without your tap and never books without your tap.
2. **Honest by default.** Every call says Milan is an AI assistant.
3. **Their language.** Vendors talk the way they're comfortable.

## Not done yet

- One wedding per install, no login.
- SQLite on local disk: deploying needs a persistent disk (Render, Fly) or a swap to Postgres in `repo.ts`.
- WhatsApp summaries to vendors and the family.

## License

MIT
