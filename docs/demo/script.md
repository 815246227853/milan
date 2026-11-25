# Demo script and vendor personas

## The job
"Find me a vegetarian caterer for 250 guests, within ₹1,000 per plate. Check availability and get quotes."

## Vendor personas (teammates on real phones)
| Vendor | Says | Quote |
|---|---|---|
| Sharma Caterers | "Ji, 950 mein ho jayega, live counter ke saath." | ₹950 a plate, free, live counter, 30% advance |
| Annapurna Foods | "Haan ji, 980 per plate, dessert included." | ₹980 a plate, free, dessert, 25% advance |
| Gupta Caterers | "Date free hai, 1,200 lagega." | ₹1,200 a plate, over budget |

## The change
"The guest count just went up to 300. Check what needs to change."
Sharma, on the call back: "Ho jayega, par staff badhega, toh 990 per plate lagega." → ₹2,97,000, over the ₹2,50,000 catering budget → approval.

## Sponsor moments
1. Sarvam: the live Hindi call with English subtitles.
2. Flagsmith: approval triggered by `approval_over_budget`; then flip `calls_enabled` off mid-call.
3. NudgeBee: `kubectl set env deployment/milan SARVAM_API_KEY=""` → Milan crash-loops → NudgeBee flags it, NuBi's Investigate traces it to the missing key → roll back (NuBi with approval, or `kubectl rollout undo deployment/milan`) → the job is still there. Details: [`docs/k8s-nudgebee.md`](../k8s-nudgebee.md).

## The app flow for the video
1. **Landing** (`/`): click **Plan my wedding**.
2. **Setup** (`/start`): Milan says namaste and asks four questions out loud (couple, date and city, guests and budget, functions). Tap the orb (or press Space) and answer. The fields fill in as you speak, and you can still type. It ends on an invitation card, then **Open my dashboard**.
3. **Dashboard** (`/app`): tap the orb and say *"Find me a veg caterer for 250 guests under ₹1,000 a plate."* Milan replies out loud, the job appears, and the calls go live with Hindi transcripts and English subtitles.
4. When the quotes are in, Milan says which caterer it recommends and opens the approval sheet by itself. Approve on screen, or just say *"Haan, book kar do."*
5. Say *"The guest count is now 300."* Milan calls the caterer back, recalculates the cost, and asks again because the new total is over budget.

To shoot again: **Behind the scenes → Start a new job** keeps the wedding; **Start over from the setup** clears it too (`POST /api/reset?all=1`). The older Job screen is still at `/job`.

**Landing page on Vercel:** set `<meta name="milan-app-url" content="https://your-milan-app">` in `apps/landing/index.html` so the buttons open the running app. A static host can't run Milan itself.
