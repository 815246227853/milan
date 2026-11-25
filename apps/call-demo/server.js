// Milan call demo.
// Landing (/) -> setup conversation (/start) -> dashboard (/app). On the dashboard the family talks to Milan
// (voice or typed): "Find a veg caterer..." -> Milan "calls" the caterers, each on its own vendor page (/vendor?v=<id>).
// Vendor audio -> Sarvam speech-to-text -> OpenAI decides the reply -> Sarvam text-to-speech.
// After each call, OpenAI extracts the quote; Sarvam translates the transcript.
// When every call is done, Milan compares the quotes, recommends one, and asks the family to approve.
// The family can then change the brief ("guest count is now 300"): Milan calls the caterer back,
// recalculates the cost and, if it is over budget, asks for approval again.
// Milan's rules (kill switch, budget, approvals, parallel calls) come from Flagsmith.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(here, '..', '..', '.env');
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);

const PORT = Number(process.env.DEMO_PORT || 3000);
const SARVAM_KEY = process.env.SARVAM_API_KEY;
const TTS_MODEL = process.env.SARVAM_TTS_MODEL || 'bulbul:v3';
const TTS_SPEAKER = process.env.SARVAM_TTS_SPEAKER || 'priya';
const STT_MODEL = process.env.SARVAM_STT_MODEL || 'saaras:v4';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1';
const FLAGSMITH_KEY = process.env.FLAGSMITH_ENVIRONMENT_KEY || '';
const FLAGSMITH_IDENTITY = process.env.FLAGSMITH_IDENTITY || 'wedding-riya-arjun';
const FLAGSMITH_API = (process.env.FLAGSMITH_API_URL || 'https://edge.api.flagsmith.com/api/v1').replace(/\/$/, '');
const MAX_VENDOR_TURNS = 8;

const missing = [];
if (!SARVAM_KEY) missing.push('SARVAM_API_KEY');
if (!process.env.OPENAI_API_KEY) missing.push('OPENAI_API_KEY');
if (missing.length) {
  console.error(`\nMissing in .env: ${missing.join(', ')}\nAdd them to ${envPath} and start again.\n`);
  process.exit(1);
}

// ---------- Demo data ----------
// The demo wedding. A family replaces it on the setup screen (/start); it lives in state.wedding.
const DEMO_WEDDING = makeWedding({
  partner1: 'Riya', partner2: 'Arjun', coupleHindi: 'रिया और अर्जुन', dateISO: '2026-12-12', city: 'Nagpur',
  guests: 250, budgetPerPlate: 1000, functions: ['Haldi', 'Mehendi', 'Sangeet', 'Wedding', 'Reception'],
});
function makeWedding(w) {
  const d = new Date(`${w.dateISO}T00:00:00`);
  return {
    partner1: w.partner1, partner2: w.partner2,
    couple: `${w.partner1} and ${w.partner2}`,
    coupleHindi: w.coupleHindi || `${w.partner1} और ${w.partner2}`,
    dateISO: w.dateISO,
    date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    dateShort: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    day: d.getDate(),
    city: w.city,
    guests: w.guests, // the guest count the catering budget was planned for
    budgetPerPlate: w.budgetPerPlate,
    functions: w.functions?.length ? w.functions : ['Wedding'],
  };
}
const W = () => state.wedding || DEMO_WEDDING;

// The three caterers from docs/demo/script.md. Each one gets its own vendor link.
const VENDORS = [
  { id: 'sharma', name: 'Sharma Caterers', category: 'Catering', area: 'Sitabuldi', language: 'Hindi', practice: false },
  // Practice vendors answer by themselves with a scripted Sarvam voice (lines from docs/demo/script.md).
  {
    id: 'annapurna', name: 'Annapurna Foods', category: 'Catering', area: 'Dharampeth', language: 'Hindi', practice: true,
    opening: () => `हाँ जी, ${W().day} तारीख को हम फ्री हैं। 980 पर प्लेट लगेगा, डेज़र्ट शामिल है। 25 प्रतिशत एडवांस लेते हैं।`,
    facts: 'Free on the wedding date. 980 rupees per plate for veg. Dessert included. No live counter. Service staff included. 25 percent advance.',
  },
  {
    id: 'gupta', name: 'Gupta Caterers', category: 'Catering', area: 'Sadar', language: 'Hindi', practice: true,
    opening: () => 'डेट फ्री है जी, 1200 लगेगा पर प्लेट, बेसिक मेन्यू के साथ। 40 प्रतिशत एडवांस।',
    facts: 'Free on the wedding date. 1200 rupees per plate for veg. Basic menu only: no live counter, no dessert. Service staff included. 40 percent advance. Price is fixed, no discount.',
  },
];
const PRACTICE_VOICE = process.env.SARVAM_PRACTICE_SPEAKER || 'aditya'; // a male voice for the practice caterers
const vendorById = (id) => VENDORS.find((v) => v.id === id);

// The AI disclosure is hard-coded so it is ALWAYS the first thing Milan says.
const DISCLOSURE = 'नमस्ते जी, मैं मिलन हूँ, एक AI असिस्टेंट।';
const GOODBYE_STOPPED = 'माफ़ कीजिए जी, मुझे यह कॉल अभी यहीं रोकनी पड़ रही है। परिवार आपसे जल्दी संपर्क करेगा। धन्यवाद, नमस्ते!';

// ---------- State (saved to disk on Kubernetes) ----------
// On Kubernetes, STATE_FILE points at a persistent volume, so a killed or restarted pod
// comes back with the job, calls and decisions exactly where they were.
const STATE_FILE = process.env.STATE_FILE || null;
let state = loadState();
function freshState(wedding = null) {
  return {
    wedding,                // set on the setup screen; null = not set up yet (the demo wedding is used)
    job: null,
    guests: (wedding || DEMO_WEDDING).guests, // current guest count (changes after an approved guest-count change)
    calls: {},              // { [vendorId]: quote call }
    decision: null,         // the first approval: which caterer to book
    change: null,           // a change to the brief: { fromGuests, toGuests, vendorId, call, decision }
    activity: [],           // everything Milan did, newest last: { at, text, kind }
  };
}

// Activity feed: everything Milan does shows up here (Job screen and Vendors page).
function log(text, kind = 'info') {
  state.activity.push({ at: Date.now(), text, kind });
  console.log(`[activity] ${text}`);
}

function loadState() {
  if (!STATE_FILE || !fs.existsSync(STATE_FILE)) return freshState();
  try {
    const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    console.log(`Restored saved state from ${STATE_FILE} (job: ${saved.job ? `"${saved.job.text}"` : 'none'})`);
    return { ...freshState(), ...saved };
  } catch (e) {
    console.error(`Could not read ${STATE_FILE}, starting fresh: ${e.message}`);
    return freshState();
  }
}

let lastSaved = '';
function saveState() {
  if (!STATE_FILE) return;
  const json = JSON.stringify(state);
  if (json === lastSaved) return;
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(`${STATE_FILE}.tmp`, json);
  fs.renameSync(`${STATE_FILE}.tmp`, STATE_FILE); // atomic: a kill mid-write never leaves half a file
  lastSaved = json;
}
if (STATE_FILE) {
  setInterval(() => {
    try {
      saveState();
    } catch (e) {
      console.error(`Could not save state: ${e.message}`);
    }
  }, 500).unref();
}

// After a restart, finish whatever the old process was in the middle of.
function resumeAfterRestart() {
  for (const call of allCalls()) {
    for (const line of call.transcript) if (line.english == null) translateLine(line);
    if (call.status === 'summarizing') {
      call.status = 'live'; // let finishCall run again
      finishCall(call);
    } else if (vendorById(call.vendorId)?.practice && (call.status === 'live' || call.status === 'ringing')) {
      Object.assign(call, { status: 'queued', transcript: [], vendorTurns: 0, startedAt: null, practiceRunning: false }); // redo the practice call
    }
  }
  if (state.job) state.job.planShown = true;
  applyRules();
  maybeRecommend();
  if (state.change?.call?.status === 'done' && !state.change.decision) computeChange();
}

// ---------- Rules (Flagsmith) ----------
// Same names and defaults as config/flagsmith/flags.json.
const FLAG_DEFAULTS = {
  calls_enabled: true,
  approval_before_booking: true,
  approval_over_budget: true,
  max_price_per_plate: 1000,
  call_languages: 'hi,mr',
  max_parallel_calls: 3,
  ai_disclosure: true,
};
const BOOLEAN_FLAGS = ['calls_enabled', 'approval_before_booking', 'approval_over_budget', 'ai_disclosure'];

let rules = {
  source: FLAGSMITH_KEY ? 'connecting' : 'defaults', // 'flagsmith' | 'defaults' | 'connecting'
  identity: FLAGSMITH_IDENTITY,
  error: null,
  fetchedAt: null,
  flags: Object.fromEntries(Object.entries(FLAG_DEFAULTS).map(([k, v]) => [k, { value: v, fromFlagsmith: false }])),
};
const rule = (name) => rules.flags[name].value;
// Budget per plate: Flagsmith's max_price_per_plate when it is set there, otherwise what the family typed at setup.
const budgetPerPlate = () => (rules.flags.max_price_per_plate.fromFlagsmith ? Number(rule('max_price_per_plate')) : Number(W().budgetPerPlate || rule('max_price_per_plate')));
const cateringBudget = () => budgetPerPlate() * W().guests;

async function refreshRules() {
  if (!FLAGSMITH_KEY) return;
  try {
    const res = await fetch(`${FLAGSMITH_API}/identities/?identifier=${encodeURIComponent(FLAGSMITH_IDENTITY)}`, {
      headers: { 'X-Environment-Key': FLAGSMITH_KEY },
      signal: AbortSignal.timeout(4000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
    const byName = Object.fromEntries((data.flags || []).map((f) => [f.feature?.name, f]));
    const flags = {};
    for (const [name, def] of Object.entries(FLAG_DEFAULTS)) {
      const f = byName[name];
      if (!f) { flags[name] = { value: def, fromFlagsmith: false }; continue; }
      let value;
      const raw = f.feature_state_value;
      if (BOOLEAN_FLAGS.includes(name)) value = !!f.enabled;
      else if (typeof def === 'number') value = raw != null && raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : def;
      else value = raw != null && raw !== '' ? String(raw) : def;
      flags[name] = { value, fromFlagsmith: true };
    }
    rules = { ...rules, source: 'flagsmith', error: null, fetchedAt: Date.now(), flags };
  } catch (e) {
    // Keep the last known rules if Flagsmith can't be reached.
    rules = { ...rules, source: rules.source === 'flagsmith' ? 'flagsmith' : 'defaults', error: `Could not reach Flagsmith: ${e.message}` };
  }
}

// Apply the rules to the calls: kill switch and how many can ring at once.
function applyRules() {
  const all = allCalls();
  if (state.job && !state.job.planShown) return; // Milan shows its plan before it starts calling
  if (!rule('calls_enabled')) {
    let stopped = false;
    for (const c of all) {
      if (c.status === 'ringing') { c.status = 'queued'; stopped = true; }          // stop ringing
      if (c.status === 'live' && !c.stopping) { c.stopping = true; stopped = true; } // end politely
    }
    if (stopped) log('Calls paused: calls_enabled was turned off in Flagsmith', 'warn');
    return;
  }
  // Calls the kill switch stopped before Milan got a quote: call them again now that calls are back on.
  for (const c of all) {
    if (c.status === 'done' && c.endReason && !c.result?.price_per_plate && c.kind !== 'callback') {
      Object.assign(c, { status: 'queued', transcript: [], vendorTurns: 0, startedAt: null, endedAt: null, result: null, error: null, stopping: false, endReason: null, practiceRunning: false });
      log(`Calls are back on: Milan will call ${vendorById(c.vendorId).name} again`);
    }
  }
  // Start queued calls, up to max_parallel_calls at once.
  const limit = Math.max(1, Number(rule('max_parallel_calls')) || 1);
  let active = all.filter((c) => c.status === 'ringing' || c.status === 'live').length;
  for (const c of all) {
    if (active >= limit) break;
    if (c.status === 'queued') {
      c.status = 'ringing';
      active++;
      log(`Calling ${vendorById(c.vendorId).name}${c.kind === 'callback' ? ' back' : ''}…`);
      if (vendorById(c.vendorId).practice) runPracticeCall(c);
    }
  }
}

setInterval(async () => { await refreshRules(); applyRules(); }, 3000).unref();

function allCalls() {
  return [...VENDORS.map((v) => state.calls[v.id]), state.change?.call].filter(Boolean);
}

// ---------- Network helper ----------
// Retry a request a couple of times if the network hiccups or the service is busy.
async function fetchRetry(url, opts, tries = 4, attemptMs = 10000) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(attemptMs) });
      const body = await res.text(); // read the whole answer inside the time limit, so a cut-off answer is retried too
      if ((res.status === 429 || res.status >= 500) && i < tries) throw new Error(`HTTP ${res.status}`);
      return new Response(body, { status: res.status, headers: res.headers });
    } catch (e) {
      if (i >= tries) throw new Error(`Could not reach ${new URL(url).host}: ${e.message}`);
      console.warn(`Retrying ${url} (${e.message})`);
      await new Promise((r) => setTimeout(r, 300 * i));
    }
  }
}

// ---------- Sarvam ----------
async function sarvamJson(url, body, attemptMs = 10000) {
  const res = await fetchRetry(url, {
    method: 'POST',
    headers: { 'api-subscription-key': SARVAM_KEY, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }, 4, attemptMs);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Sarvam ${url.split('/').pop()} failed (${res.status}): ${data?.error?.message || JSON.stringify(data)}`);
  return data;
}

async function textToSpeech(text, language = 'hi-IN') {
  const data = await sarvamJson('https://api.sarvam.ai/text-to-speech', {
    text,
    language_code: language,
    model: TTS_MODEL,
    speaker: TTS_SPEAKER,
  }, 20000); // long Hindi lines take a few seconds to voice
  if (!data.audios?.[0]) throw new Error('Sarvam text-to-speech returned no audio');
  return data.audios[0]; // base64 wav
}

async function speechToText(wavBuffer, language = 'hi-IN') {
  const form = new FormData();
  form.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'turn.wav');
  form.append('model', STT_MODEL);
  form.append('language_code', language);
  const res = await fetchRetry('https://api.sarvam.ai/speech-to-text', {
    method: 'POST',
    headers: { 'api-subscription-key': SARVAM_KEY },
    body: form,
  }, 4, 20000);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Sarvam speech-to-text failed (${res.status}): ${data?.error?.message || JSON.stringify(data)}`);
  return (data.transcript || '').trim();
}

// The family talking to Milan on the dashboard: English, Hindi or a mix. Let Sarvam detect the
// language; if this model does not accept auto-detect, fall back to Indian English.
async function hearFamily(wavBuffer) {
  try {
    return await speechToText(wavBuffer, 'unknown');
  } catch (e) {
    console.warn(`Auto-detect speech-to-text failed, trying en-IN: ${e.message}`);
    return speechToText(wavBuffer, 'en-IN');
  }
}

// Spoken replies are cached: onboarding questions and common lines are voiced once.
const ttsCache = new Map();
async function voice(text, language) {
  const key = `${language}|${text}`;
  if (!ttsCache.has(key)) {
    const p = textToSpeech(text, language);
    ttsCache.set(key, p);
    p.catch(() => ttsCache.delete(key));
  }
  return ttsCache.get(key);
}

async function translateToEnglish(text) {
  const data = await sarvamJson('https://api.sarvam.ai/translate', {
    input: text.slice(0, 1000),
    source_language_code: 'auto',
    target_language_code: 'en-IN',
    model: 'mayura:v1',
  });
  return data.translated_text;
}

// ---------- OpenAI ----------
async function askAI(system, userText, schema) {
  const res = await fetchRetry('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.3,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userText },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'answer', strict: true, schema } },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OpenAI failed (${res.status}): ${data?.error?.message || JSON.stringify(data)}`);
  const msg = data.choices?.[0]?.message;
  if (msg?.refusal) throw new Error('OpenAI declined this request');
  return JSON.parse(msg.content);
}

const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    say: { type: 'string', description: "Milan's next line, in Hindi (Devanagari script)" },
    end_call: { type: 'boolean' },
  },
  required: ['say', 'end_call'],
  additionalProperties: false,
};

// For the first call to a caterer: Milan ticks off the four answers before deciding what to say.
const QUOTE_REPLY_SCHEMA = {
  type: 'object',
  properties: {
    have_date: { type: 'boolean', description: 'The vendor has said whether they are free on the date' },
    have_price: { type: 'boolean', description: 'The vendor has said a price per plate' },
    have_includes: { type: 'boolean', description: 'The vendor has said what is included (anything they mentioned counts)' },
    have_advance: { type: 'boolean', description: 'The vendor has said the advance' },
    say: { type: 'string', description: "Milan's next line, in Hindi (Devanagari script). If all four are known: the short closing line (repeat the facts, thank them, the family will get back after comparing)." },
    end_call: { type: 'boolean' },
  },
  required: ['have_date', 'have_price', 'have_includes', 'have_advance', 'say', 'end_call'],
  additionalProperties: false,
};

const SPEAKING_RULES = `Rules:
- Speak natural, polite spoken Hindi in Devanagari script, the way a friendly assistant talks on the phone. Use "जी". Speak as a woman (e.g. "कर रही हूँ").
- Keep each reply short: one or two sentences, at most one or two questions at a time. This is spoken aloud.
- Write all numbers as digits (e.g. "950 रुपये प्रति प्लेट", "250 मेहमान", "30 प्रतिशत"). Never write the ₹ symbol.
- Never book, agree to a deal, or promise money. If asked, say the family will confirm.
- If something is unclear, ask once to confirm.
- When you repeat a price or fact back, copy the number exactly as the vendor said it. Never guess or change a number. If you did not hear a number clearly, ask again.
- Do not ask for phone numbers, menus, addresses or anything outside your questions.
- Never greet again after the opening ("नमस्ते" only once).
- If the vendor asks whether you are a real person, say honestly that you are an AI assistant.`;

function quoteSystemPrompt(vendor) {
  return `You are Milan, an AI wedding assistant, speaking on a phone call (voice only) with a vendor in India.
You are calling on behalf of the family of ${W().couple} (in Hindi, always write their names exactly as: ${W().coupleHindi}). Wedding: ${W().date}, ${W().city}, ${state.guests} guests.
You are calling ${vendor.name} (${vendor.category}).

The family's request: "${state.job?.text}"

Your goal is to find out, politely and quickly:
1. Is the vendor free on ${W().date}?
2. Price per plate for vegetarian food for this many guests.
3. What is included (e.g. live counter, dessert, service staff).
4. How much advance they need.

${SPEAKING_RULES}
- Before each reply, check which of the four answers you already have from the call so far. Only ask about the ones still missing.
- For "what is included", whatever the vendor mentions (e.g. "live counter") IS the answer. Do not ask about other items they did not mention (dessert, staff, menu type, etc.).
- The family asked for vegetarian food; you do not need to confirm it is vegetarian.
- As soon as you have all four answers (or the vendor cannot help), do not ask anything more: briefly repeat the key facts, thank them, say the family will get back to them after comparing, and set end_call to true.`;
}

function callbackSystemPrompt(vendor) {
  const ch = state.change;
  const before = state.calls[vendor.id]?.result || {};
  return `You are Milan, an AI wedding assistant, calling ${vendor.name} BACK on the phone (voice only).
You spoke to them earlier for the family of ${W().couple} (in Hindi, always write their names exactly as: ${W().coupleHindi}). Wedding: ${W().date}, ${W().city}.
Earlier they quoted: ${state.decision?.pricePerPlate ?? before.price_per_plate} rupees per plate for ${ch.fromGuests} guests (includes: ${before.includes || 'not discussed'}; advance: ${before.advance || 'not discussed'}).

What changed: the guest count has gone up from ${ch.fromGuests} to ${ch.toGuests}.

Your goal is to find out, politely and quickly:
1. Can they serve ${ch.toGuests} guests on ${W().date}?
2. What will the price per plate be for ${ch.toGuests} guests (or does it stay the same)? If it changes, why?

${SPEAKING_RULES}
- As soon as you have both answers, do not ask anything more: briefly repeat them, thank them, say the family will confirm, and set end_call to true.`;
}

function transcriptAsText(call) {
  return call.transcript.map((l) => `${l.speaker === 'milan' ? 'Milan' : 'Vendor'}: ${l.text}`).join('\n');
}

async function nextMilanLine(call, opening) {
  const vendor = vendorById(call.vendorId);
  const system = call.kind === 'callback' ? callbackSystemPrompt(vendor) : quoteSystemPrompt(vendor);
  const intro = 'Your introduction as an AI assistant will be added automatically before your line, so do NOT introduce yourself again and do not say नमस्ते again.';
  const prompt = opening
    ? call.kind === 'callback'
      ? `The vendor has just picked up the phone. ${intro} Say you are calling back about the wedding, tell them what changed, and ask your first question.`
      : `The vendor has just picked up the phone. ${intro} Say who you are calling for and the wedding details in one sentence, then ask your first question.`
    : `Call so far:\n${transcriptAsText(call)}\n\nWhat does Milan say next?`;
  const quote = call.kind !== 'callback';
  const out = await askAI(system, prompt, quote ? QUOTE_REPLY_SCHEMA : REPLY_SCHEMA);
  // All four answers known: this is the closing line, so end the call (no extra questions).
  if (quote && !opening && out.have_date && out.have_price && out.have_includes && out.have_advance) out.end_call = true;
  // ai_disclosure: Milan ALWAYS says it is an AI in this demo, even if the flag is turned off.
  return { say: opening ? `${DISCLOSURE} ${out.say}` : out.say, end: opening ? false : out.end_call };
}

const EXTRACT_SYSTEM = 'You read phone call transcripts between Milan (an AI wedding assistant) and a caterer, and pull out the facts the family needs. Take every fact, especially every number, ONLY from the lines marked "Vendor". Milan\'s lines are questions and may contain mistakes: never take a price or percentage from a Milan line. If the vendor said "हाँ"/"yes" to a question Milan asked, that confirms what Milan asked about (but not any number Milan said).';

const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    price_per_plate: { type: ['integer', 'null'], description: 'Rupees per plate quoted, or null if not given' },
    date_available: { type: 'string', enum: ['Free', 'Not free', 'Not clear'] },
    includes: { type: 'string', description: 'Short English list of what is included, e.g. "Live counter, service staff"' },
    advance: { type: 'string', description: 'Advance asked for, e.g. "30%", or "Not discussed"' },
    quote_line: { type: 'string', description: "The vendor's single most important sentence, exactly as they said it (copy from the transcript)" },
    summary: { type: 'string', description: 'One sentence in English for the family' },
  },
  required: ['price_per_plate', 'date_available', 'includes', 'advance', 'quote_line', 'summary'],
  additionalProperties: false,
};

const CALLBACK_SCHEMA = {
  type: 'object',
  properties: {
    can_serve: { type: 'string', enum: ['Yes', 'No', 'Not clear'] },
    new_price_per_plate: { type: ['integer', 'null'], description: 'New rupees per plate for the new guest count; the old price if they said it stays the same; null if not given' },
    reason: { type: 'string', description: 'Short English reason for any price change, e.g. "they need more staff", or "" if none given' },
    quote_line: { type: 'string', description: "The vendor's single most important sentence, exactly as they said it (copy from the transcript)" },
    summary: { type: 'string', description: 'One sentence in English for the family' },
  },
  required: ['can_serve', 'new_price_per_plate', 'reason', 'quote_line', 'summary'],
  additionalProperties: false,
};

async function extractResult(call) {
  if (call.kind === 'callback') {
    const ch = state.change;
    return askAI(
      EXTRACT_SYSTEM,
      `This was a call BACK. The guest count changed from ${ch.fromGuests} to ${ch.toGuests}. The earlier price was ${state.decision?.pricePerPlate} rupees per plate.\n\nTranscript:\n${transcriptAsText(call)}`,
      CALLBACK_SCHEMA,
    );
  }
  return askAI(
    EXTRACT_SYSTEM,
    `Family's request: "${state.job.text}"\nWedding date: ${W().date}. Guests: ${state.guests}.\n\nTranscript:\n${transcriptAsText(call)}`,
    RESULT_SCHEMA,
  );
}

// ---------- Call flow ----------
function newCall(vendorId, kind = 'quote') {
  // queued -> ringing -> live -> summarizing -> done
  return { vendorId, kind, status: 'queued', transcript: [], vendorTurns: 0, startedAt: null, endedAt: null, result: null, error: null, stopping: false, endReason: null };
}

function addLine(call, speaker, text) {
  const line = { speaker, text, english: null };
  call.transcript.push(line);
  translateLine(line);
  return line;
}

function translateLine(line) {
  translateToEnglish(line.text)
    .then((en) => (line.english = en))
    .catch((e) => {
      console.error(e.message);
      line.english = '(translation failed)';
    });
}

async function finishCall(call) {
  if (call.status === 'summarizing' || call.status === 'done') return;
  call.status = 'summarizing';
  call.endedAt = call.endedAt || Date.now();
  if (call.transcript.some((l) => l.speaker === 'vendor')) {
    try {
      call.result = await extractResult(call);
    } catch (e) {
      console.error(e);
      call.error = e.message;
    }
  }
  call.status = 'done';
  const vname = vendorById(call.vendorId).name;
  if (call.kind !== 'callback' && call.result?.price_per_plate) {
    const over = call.result.price_per_plate > budgetPerPlate();
    log(`Quote from ${vname}: ${inr(call.result.price_per_plate)} a plate${over ? ' (over budget)' : ''}`);
  } else if (call.kind === 'callback' && call.result?.new_price_per_plate) {
    log(`${vname} on the call back: ${call.result.can_serve === 'Yes' ? `can serve ${state.change.toGuests} guests at ${inr(call.result.new_price_per_plate)} a plate` : 'could not confirm the new guest count'}`);
  } else if (!call.endReason) log(`Call with ${vname} ended without a quote`, 'warn');
  applyRules(); // a slot is free: start the next queued call
  if (call.kind === 'callback') computeChange();
  else maybeRecommend();
}

async function politeGoodbye(call) {
  call.endReason = 'Stopped: calls were turned off in Flagsmith';
  addLine(call, 'milan', GOODBYE_STOPPED);
  log(`Milan ended the call with ${vendorById(call.vendorId).name} politely (calls turned off)`, 'warn');
  const audio = await textToSpeech(GOODBYE_STOPPED);
  finishCall(call);
  return { say: GOODBYE_STOPPED, audio, end: true };
}

// ---------- Practice vendors ----------
// Annapurna and Gupta answer by themselves. Each vendor line is spoken with a Sarvam voice,
// then heard through Sarvam speech-to-text, exactly like a real vendor on the phone.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function practiceVendorLine(call, vendor) {
  if (call.vendorTurns === 0) return vendor.opening();
  const out = await askAI(
    `You are the owner of ${vendor.name}, a caterer in ${W().city}, on a phone call with Milan, an AI wedding assistant. Your facts (never change them): ${vendor.facts}
Reply in short, natural spoken Hindi (Devanagari), one sentence, the way a busy caterer talks on the phone. Write numbers as digits. Only answer what you were asked. If Milan is saying goodbye, just say thanks.`,
    `Call so far:\n${transcriptAsText(call)}\n\nWhat do you say next?`,
    { type: 'object', properties: { say: { type: 'string' } }, required: ['say'], additionalProperties: false },
  );
  return out.say;
}

async function practiceHear(text) {
  // Speak the line with Sarvam text-to-speech, then transcribe it with Sarvam speech-to-text.
  try {
    const data = await sarvamJson('https://api.sarvam.ai/text-to-speech', {
      text, language_code: 'hi-IN', model: TTS_MODEL, speaker: PRACTICE_VOICE, speech_sample_rate: 16000,
    }, 20000);
    const heard = await speechToText(Buffer.from(data.audios[0], 'base64'));
    return heard || text;
  } catch (e) {
    console.warn(`Practice voice failed, using the script text: ${e.message}`);
    return text;
  }
}

async function runPracticeCall(call) {
  if (call.practiceRunning) return;
  call.practiceRunning = true;
  const vendor = vendorById(call.vendorId);
  try {
    await wait(2500 + Math.random() * 2000); // let it ring
    if (call.status !== 'ringing' || !rule('calls_enabled')) return;
    call.status = 'live';
    call.startedAt = Date.now();
    log(`${vendor.name} answered (practice vendor)`);
    const first = await nextMilanLine(call, true);
    addLine(call, 'milan', first.say);
    for (let turn = 0; turn < MAX_VENDOR_TURNS; turn++) {
      await wait(1200);
      if (call.stopping) return practiceGoodbye(call);
      const heard = await practiceHear(await practiceVendorLine(call, vendor));
      addLine(call, 'vendor', heard);
      call.vendorTurns += 1;
      await wait(800);
      if (call.stopping) return practiceGoodbye(call);
      const next = await nextMilanLine(call, false);
      addLine(call, 'milan', next.say);
      if (next.end) break;
    }
    finishCall(call);
  } catch (e) {
    console.error(e);
    call.error = e.message;
    finishCall(call);
  } finally {
    call.practiceRunning = false;
  }
}

function practiceGoodbye(call) {
  call.endReason = 'Stopped: calls were turned off in Flagsmith';
  addLine(call, 'milan', GOODBYE_STOPPED);
  log(`Milan ended the call with ${vendorById(call.vendorId).name} politely (calls turned off)`, 'warn');
  finishCall(call);
}

// Once every quote call is finished, compare the quotes and pick one.
// Rule: date must be free, price must be within max_price_per_plate (Flagsmith); then cheapest wins.
function maybeRecommend() {
  const calls = VENDORS.map((v) => state.calls[v.id]).filter(Boolean);
  if (!calls.length || calls.some((c) => c.status !== 'done') || state.decision) return;
  if (calls.some((c) => c.endReason && !c.result?.price_per_plate)) return; // stopped by the kill switch: wait for calls to resume

  const perPlate = budgetPerPlate();
  const budgetTotal = perPlate * state.guests;
  const quotes = calls
    .filter((c) => c.result?.price_per_plate)
    .map((c) => ({ call: c, vendor: vendorById(c.vendorId), price: c.result.price_per_plate }));
  const eligible = quotes
    .filter((q) => q.call.result.date_available === 'Free' && q.price <= perPlate)
    .sort((a, b) => a.price - b.price);

  if (!eligible.length) {
    state.decision = {
      status: 'none',
      budgetPerPlate: perPlate,
      budgetTotal,
      reason: 'None of the caterers is free on the date and within budget. Try a higher budget or more caterers.',
    };
    log('No caterer is free and within budget', 'warn');
    return;
  }

  const best = eligible[0];
  const total = best.price * state.guests;
  const others = quotes.filter((q) => q !== best);
  const overBudget = others.filter((q) => q.price > perPlate).map((q) => q.vendor.name);
  const notFree = others.filter((q) => q.call.result.date_available !== 'Free').map((q) => q.vendor.name);
  const pricier = others.filter((q) => q.price <= perPlate && q.call.result.date_available === 'Free');

  // One line: why this caterer.
  const inc = best.call.result.includes && !/^none|not discussed/i.test(best.call.result.includes) ? `, with ${best.call.result.includes.toLowerCase()}` : '';
  let why = `Cheapest caterer free on ${W().dateShort} within your ${inr(perPlate)} a plate budget: ${inr(best.price)} a plate (${inr(total)} for ${state.guests} guests)${inc}.`;
  const notes = [];
  if (pricier.length) notes.push(`${pricier.map((q) => q.vendor.name).join(' and ')} ${pricier.length > 1 ? 'cost' : 'costs'} more`);
  if (overBudget.length) notes.push(`${overBudget.join(' and ')} ${overBudget.length > 1 ? 'are' : 'is'} over budget`);
  if (notFree.length) notes.push(`${notFree.join(' and ')} ${notFree.length > 1 ? 'are' : 'is'} not free`);

  const ask = !!rule('approval_before_booking');
  state.decision = {
    status: ask ? 'pending' : 'approved', // pending -> approved | declined
    auto: !ask,
    createdAt: Date.now(),
    others: notes.join('; '),
    vendorId: best.vendor.id,
    vendorName: best.vendor.name,
    pricePerPlate: best.price,
    guests: state.guests,
    total,
    budgetPerPlate: perPlate,
    budgetTotal,
    advance: best.call.result.advance,
    includes: best.call.result.includes,
    reason: why,
  };
  log(`Recommended: ${best.vendor.name}. ${why}`, 'good');
  if (ask) log(`Asked you to approve booking ${best.vendor.name} for ${inr(total)} (approval_before_booking is on in Flagsmith)`, 'ask');
  else log(`Booked ${best.vendor.name} for ${inr(total)} without asking (approval_before_booking is off in Flagsmith)`, 'good');
}

// After the call back: recalculate the cost and decide whether the family must approve.
// Rule: approval_over_budget (Flagsmith) on + new total over the catering budget -> ask the family.
function computeChange() {
  const ch = state.change;
  if (!ch || ch.decision) return;
  const r = ch.call.result;
  const vendor = vendorById(ch.vendorId);
  const oldPrice = state.decision.pricePerPlate;
  const before = { guests: ch.fromGuests, price: oldPrice, total: ch.fromGuests * oldPrice };
  const budgetTotal = cateringBudget();

  if (!r || r.can_serve !== 'Yes' || !r.new_price_per_plate) {
    ch.decision = {
      status: 'none',
      reason: !r
        ? `${vendor.name} did not answer the call back. Try the change again.`
        : r.can_serve === 'No'
          ? `${vendor.name} cannot serve ${ch.toGuests} guests. You may need another caterer.`
          : `Milan could not get a clear answer from ${vendor.name}. Try the change again.`,
    };
    return;
  }

  const now = { guests: ch.toGuests, price: r.new_price_per_plate, total: ch.toGuests * r.new_price_per_plate };
  const overBy = now.total - budgetTotal;
  const needsApproval = !!rule('approval_over_budget') && overBy > 0;

  let why = `${vendor.name} can serve ${ch.toGuests} guests at ${inr(now.price)} a plate`;
  if (r.reason) why += ` because ${r.reason.replace(/^because\s+/i, '').replace(/\.$/, '')}`;
  why += `. That is ${inr(now.total)}, `;
  why += overBy > 0 ? `over the ${inr(budgetTotal)} catering budget by ${inr(overBy)}.` : `within the ${inr(budgetTotal)} catering budget.`;

  ch.decision = {
    status: needsApproval ? 'pending' : 'approved',
    auto: !needsApproval,
    autoReason: needsApproval ? null : overBy > 0 ? 'approval_over_budget is off in Flagsmith, so Milan went ahead without asking.' : 'It is within budget, so no approval was needed.',
    vendorId: vendor.id,
    vendorName: vendor.name,
    before,
    now,
    budgetTotal,
    overBy,
    priceReason: r.reason,
    reason: why,
  };
  if (!needsApproval) applyGuestChange();
}

function applyGuestChange() {
  const ch = state.change;
  state.guests = ch.toGuests;
  if (state.decision?.vendorId === ch.vendorId) {
    state.decision.guests = ch.toGuests;
    state.decision.pricePerPlate = ch.decision.now.price;
    state.decision.total = ch.decision.now.total;
  }
}

function inr(n) {
  return '₹' + Number(n).toLocaleString('en-IN');
}

// ---------- HTTP ----------
function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

function readBody(req, limit = 15_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) reject(new Error('Body too large'));
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
const LANDING = [path.join(here, 'landing/index.html'), path.join(here, '..', 'landing', 'index.html')].find((p) => fs.existsSync(p));
function page(res, file) {
  if (!file || !fs.existsSync(file)) return send(res, 404, 'Not found', 'text/plain');
  send(res, 200, fs.readFileSync(file), 'text/html; charset=utf-8');
}
function redirect(res, to) {
  res.writeHead(302, { location: to, 'cache-control': 'no-store' });
  res.end();
}
const STATIC_TYPES = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const readJson = async (req) => JSON.parse((await readBody(req)).toString() || '{}');

function publicState() {
  return {
    setup: !!state.wedding,
    wedding: W(),
    budgetPerPlate: budgetPerPlate(),
    chat: state.chat || [],
    guests: state.guests,
    cateringBudget: cateringBudget(),
    vendors: VENDORS,
    job: state.job,
    calls: state.calls,
    decision: state.decision,
    change: state.change,
    activity: state.activity,
    rules,
    publicUrl: process.env.PUBLIC_URL || null,
  };
}

// Which call a phone request is for: /api/call/...?v=sharma.
// If Milan is calling that caterer back about a change, it's the call back.
function callFor(url) {
  const id = url.searchParams.get('v') || VENDORS[0].id;
  if (state.change?.vendorId === id && state.change.call) return state.change.call;
  return state.calls[id];
}


// ---------- Jobs and changes (used by the buttons and by the voice agent) ----------
async function startJob(text) {
  state = freshState(state.wedding);
  state.job = { text: text.trim(), createdAt: Date.now(), planShown: false };
  for (const v of VENDORS) state.calls[v.id] = newCall(v.id);
  log(`New job: "${state.job.text}"`);
  await refreshRules(); // read the rules before starting calls
  // Show the plan first, then start calling.
  const job = state.job;
  setTimeout(() => {
    if (state.job !== job) return;
    job.planShown = true;
    log(`Plan: call ${VENDORS.length} caterers in Hindi (${VENDORS.map((v) => v.name).join(', ')}), compare, then book once you approve`);
    applyRules();
  }, 2000);
}

// Returns null when the change started, or { code, error }.
async function startChange(text, toGuests) {
  const d = state.decision;
  if (!d?.vendorId || d.status === 'declined') return { code: 409, error: 'Milan needs a chosen caterer before it can handle a change.' };
  if (changeBusy()) return { code: 409, error: 'Milan is still working on the last change.' };
  let to = toGuests;
  if (!to) {
    const parsed = await askAI(
      'The family of a wedding is telling their AI assistant about a change. Extract the new total guest count if they gave one.',
      `Current guest count: ${state.guests}.\nMessage: "${text.trim()}"`,
      { type: 'object', properties: { new_guest_count: { type: ['integer', 'null'] } }, required: ['new_guest_count'], additionalProperties: false },
    );
    to = parsed.new_guest_count;
  }
  if (!to || to === state.guests) return { code: 400, error: `For now Milan can only handle a new guest count, e.g. "The guest count is now 300". (Current count: ${state.guests}.)` };
  state.change = { text: text.trim(), fromGuests: state.guests, toGuests: to, vendorId: d.vendorId, call: newCall(d.vendorId, 'callback'), decision: null, createdAt: Date.now() };
  log(`Change: guest count ${state.guests} → ${to}. Calling ${vendorById(d.vendorId).name} back`);
  await refreshRules();
  applyRules();
  return null;
}

function decide(which, action) {
  const d = which === 'change' ? state.change?.decision : state.decision;
  if (!d || d.status !== 'pending') return 'Nothing waiting for approval';
  d.status = action === 'approve' ? 'approved' : 'declined';
  d.decidedAt = Date.now();
  if (which === 'change' && d.status === 'approved') applyGuestChange();
  if (which !== 'change') {
    if (d.status === 'approved') log(`Booked ${d.vendorName} for ${inr(d.total)}`, 'good');
    else log(`You declined ${d.vendorName}. Nothing was booked.`, 'warn');
  } else {
    log(d.status === 'approved' ? `Booked ${d.vendorName} for ${d.now.guests} guests at ${inr(d.now.total)}` : `You declined the change for ${d.vendorName}`, d.status === 'approved' ? 'good' : 'warn');
  }
  return null;
}

// ---------- Talk to Milan (the family's voice agent) ----------
// What Milan knows right now, in a few lines, so it can answer "what's pending?".
function situation() {
  const w = W();
  const lines = [
    `Wedding: ${w.couple}, ${w.date}, ${w.city}. Functions: ${w.functions.join(', ')}. Guests now: ${state.guests}. Catering budget: ${inr(budgetPerPlate())} a plate (${inr(cateringBudget())} total).`,
    `Vendors Milan can call: ${VENDORS.map((v) => `${v.name} (${v.category})`).join(', ')}.`,
  ];
  if (!state.job) lines.push('No job yet.');
  else {
    lines.push(`Current job: "${state.job.text}".`);
    for (const v of VENDORS) {
      const c = state.calls[v.id];
      if (!c) continue;
      const r = c.result;
      lines.push(`- ${v.name}: call ${c.status}${r?.price_per_plate ? `, quoted ${inr(r.price_per_plate)} a plate, ${r.date_available}, includes ${r.includes}, advance ${r.advance}` : ''}.`);
    }
    const d = state.decision;
    if (d?.status === 'pending') lines.push(`WAITING FOR THE FAMILY: approve booking ${d.vendorName} at ${inr(d.pricePerPlate)} a plate (${inr(d.total)}). Reason: ${d.reason}`);
    else if (d?.status === 'approved') lines.push(`Booked: ${d.vendorName}, ${d.guests} guests, ${inr(d.total)}.`);
    else if (d?.status === 'declined') lines.push(`Family declined ${d.vendorName}.`);
    else if (d?.status === 'none') lines.push(`No caterer fits: ${d.reason}`);
    const ch = state.change;
    if (ch) {
      const cd = ch.decision;
      lines.push(`Change: guest count ${ch.fromGuests} → ${ch.toGuests}. Call back: ${ch.call.status}.${cd?.now ? ` New total ${inr(cd.now.total)} (${cd.overBy > 0 ? `over budget by ${inr(cd.overBy)}` : 'within budget'}).` : ''}${cd?.status === 'pending' ? ' WAITING FOR THE FAMILY to approve it.' : cd ? ` Status: ${cd.status}.` : ''}`);
    }
  }
  lines.push(`Calls allowed right now: ${rule('calls_enabled') ? 'yes' : 'no (paused in Flagsmith)'}.`);
  return lines.join('\n');
}

const ASK_SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: ['start_job', 'change_guests', 'approve', 'decline', 'status', 'other'] },
    job_text: { type: ['string', 'null'], description: 'For start_job: the job as a clear one-line instruction in English, e.g. "Find a vegetarian caterer for 250 guests under ₹1,000 a plate"' },
    new_guest_count: { type: ['integer', 'null'] },
    reply: { type: 'string', description: 'What Milan says back, spoken aloud. Warm, short: at most two sentences.' },
    language: { type: 'string', enum: ['en-IN', 'hi-IN'], description: "The language of the family's latest message: en-IN for English, hi-IN for Hindi or Hinglish." },
  },
  required: ['intent', 'job_text', 'new_guest_count', 'reply', 'language'],
  additionalProperties: false,
};

async function talkToMilan(text) {
  const out = await askAI(
    `You are Milan, an AI wedding operations agent for an Indian family. You talk to the family on their dashboard (voice). You can:
- start_job: find and call vendors. Right now Milan can only run catering jobs (it calls the caterers on the family's list in Hindi, collects quotes, compares, and asks before booking). For other vendor types, say it is coming soon and use intent "other".
- change_guests: handle a change to the guest count after a caterer is chosen (Milan calls the caterer back and recalculates the cost).
- approve / decline: answer something that is waiting for the family's approval.
- status: answer questions about what is happening, what is pending, what was booked, the budget.
Language: look ONLY at the family's latest message. If it is English, reply in English (language "en-IN"). If it is Hindi or Hinglish (Devanagari or Hindi words in English letters, e.g. "book kar do"), reply in Hindi written in Devanagari (language "hi-IN"), speaking as a woman (e.g. "कर रही हूँ", "बताती हूँ").
Use only the facts below; never make up vendors, prices or bookings. When starting a job, say briefly what you will do (e.g. "I'll call 3 caterers now and bring back their quotes"). Write amounts like "₹980 a plate" in English replies; in Hindi write numbers as digits and say "रुपये" instead of ₹.

What Milan knows now:
${situation()}`,
    text,
    ASK_SCHEMA,
  );
  let reply = out.reply;
  let action = out.intent;
  if (out.intent === 'start_job') {
    const busy = state.job && !['approved', 'declined', 'none'].includes(state.decision?.status);
    if (busy) { reply = out.language === 'hi-IN' ? 'मैं अभी कैटरर वाले काम पर लगी हूँ। पूरा होते ही बताती हूँ।' : "I'm still working on the caterer job. I'll tell you as soon as it's done."; action = 'busy'; }
    else await startJob(out.job_text || text);
  } else if (out.intent === 'change_guests') {
    const err = await startChange(text, out.new_guest_count);
    if (err) { reply = err.error; action = 'error'; }
  } else if (out.intent === 'approve' || out.intent === 'decline') {
    const which = state.change?.decision?.status === 'pending' ? 'change' : 'initial';
    const err = decide(which, out.intent);
    if (err) { reply = out.language === 'hi-IN' ? 'अभी आपकी मंज़ूरी के लिए कुछ नहीं है।' : 'There is nothing waiting for your approval right now.'; action = 'error'; }
  }
  state.chat = [...(state.chat || []), { at: Date.now(), you: text, milan: reply, action }].slice(-20);
  return { reply, language: out.language, action };
}

const UNDERSTAND_SCHEMA = {
  type: 'object',
  properties: {
    partner1: { type: ['string', 'null'] },
    partner2: { type: ['string', 'null'] },
    dateISO: { type: ['string', 'null'], description: 'YYYY-MM-DD. If no year is given, the next time that date comes.' },
    city: { type: ['string', 'null'] },
    guests: { type: ['integer', 'null'] },
    budgetPerPlate: { type: ['integer', 'null'], description: 'Rupees per plate for catering' },
    functions: { type: ['array', 'null'], items: { type: 'string', enum: ['Engagement', 'Haldi', 'Mehendi', 'Sangeet', 'Wedding', 'Reception'] } },
  },
  required: ['partner1', 'partner2', 'dateISO', 'city', 'guests', 'budgetPerPlate', 'functions'],
  additionalProperties: false,
};

const changeBusy = () => state.change && !['approved', 'declined', 'none'].includes(state.change.decision?.status);

const routes = {
  // Landing page -> /start (first-time setup, a conversation with Milan) -> /app (the dashboard).
  'GET /': (req, res) => page(res, LANDING),
  'GET /start': (req, res) => page(res, path.join(here, 'public/start.html')),
  'GET /app': (req, res) => (state.wedding ? page(res, path.join(here, 'public/app.html')) : redirect(res, '/start')),
  'GET /job': (req, res) => page(res, path.join(here, 'public/job.html')), // the older, plain job screen
  'GET /vendor': (req, res) => send(res, 200, fs.readFileSync(path.join(here, 'public/vendor.html')), 'text/html; charset=utf-8'),
  'GET /vendors': (req, res) => send(res, 200, fs.readFileSync(path.join(here, 'public/vendors.html')), 'text/html; charset=utf-8'),
  'GET /api/state': (req, res) => {
    res.setHeader('access-control-allow-origin', '*'); // the landing page may be hosted elsewhere (Vercel) and asks if a wedding is set up
    send(res, 200, publicState());
  },

  // First-time setup: save the wedding. Starts a fresh job (calls use the new details).
  'POST /api/wedding': async (req, res) => {
    const b = await readJson(req);
    const guests = Number(b.guests), perPlate = Number(b.budgetPerPlate);
    if (!b.partner1?.trim() || !b.partner2?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(b.dateISO || '') || !b.city?.trim()
      || !Number.isInteger(guests) || guests < 10 || guests > 5000 || !(perPlate >= 100 && perPlate <= 20000)) {
      return send(res, 400, { error: 'Please give both names, the date, the city, guests (10 to 5,000) and a budget per plate (₹100 to ₹20,000).' });
    }
    const p1 = b.partner1.trim().slice(0, 40), p2 = b.partner2.trim().slice(0, 40);
    let coupleHindi = null;
    try {
      coupleHindi = (await askAI('Write these two Indian first names in Hindi (Devanagari), joined by " और ".', `${p1}, ${p2}`,
        { type: 'object', properties: { hindi: { type: 'string' } }, required: ['hindi'], additionalProperties: false })).hindi;
    } catch (e) { console.warn(`Could not write the names in Hindi: ${e.message}`); }
    const wedding = makeWedding({ partner1: p1, partner2: p2, coupleHindi, dateISO: b.dateISO, city: b.city.trim().slice(0, 60), guests, budgetPerPlate: perPlate,
      functions: (b.functions || []).filter((f) => ['Engagement', 'Haldi', 'Mehendi', 'Sangeet', 'Wedding', 'Reception'].includes(f)) });
    state = freshState(wedding);
    log(`Wedding set up: ${wedding.couple}, ${wedding.date}, ${wedding.city}, ${guests} guests`);
    send(res, 200, publicState());
  },

  // Setup by voice: pull the wedding details out of what the family said.
  'POST /api/understand': async (req, res) => {
    const { text, question } = await readJson(req);
    if (!text?.trim()) return send(res, 400, { error: 'Say something first' });
    const today = new Date().toISOString().slice(0, 10);
    const out = await askAI(
      `A family is setting up their Indian wedding with Milan, an AI assistant. Today is ${today}. Milan asked: "${question || ''}". Pull out only the details they actually gave; null for the rest. Names: first names only, capitalised, in English letters. Amounts like "ek hazaar" or "1k" are numbers (1000).`,
      text.trim(), UNDERSTAND_SCHEMA);
    send(res, 200, out);
  },

  // Speech-to-text only (setup screen).
  'POST /api/listen': async (req, res) => send(res, 200, { heard: await hearFamily(await readBody(req)) }),

  // Milan speaks a line (setup questions). Cached.
  'POST /api/say': async (req, res) => {
    const { text, language } = await readJson(req);
    if (!text?.trim()) return send(res, 400, { error: 'Nothing to say' });
    send(res, 200, { audio: await voice(text.trim().slice(0, 450), language === 'hi-IN' ? 'hi-IN' : 'en-IN') });
  },

  // Talk to Milan on the dashboard, typed: { text } -> Milan acts and replies (with voice).
  'POST /api/ask': async (req, res) => {
    const { text } = await readJson(req);
    if (!text?.trim()) return send(res, 400, { error: 'Say something first' });
    const out = await talkToMilan(text.trim());
    const audio = await voice(out.reply, out.language).catch((e) => (console.error(e.message), null));
    send(res, 200, { heard: text.trim(), ...out, audio, state: publicState() });
  },

  // Talk to Milan on the dashboard, spoken: WAV in -> what Milan heard, what it did, its reply (with voice).
  'POST /api/voice': async (req, res) => {
    const heard = await hearFamily(await readBody(req));
    if (!heard) return send(res, 200, { heard: '', reply: "Sorry, I didn't catch that. Could you say it again?", language: 'en-IN', action: 'none', audio: await voice("Sorry, I didn't catch that. Could you say it again?", 'en-IN').catch(() => null), state: publicState() });
    const out = await talkToMilan(heard);
    const audio = await voice(out.reply, out.language).catch((e) => (console.error(e.message), null));
    send(res, 200, { heard, ...out, audio, state: publicState() });
  },
  // Kubernetes liveness and readiness probes.
  'GET /health': (req, res) => send(res, 200, { ok: true }),

  // Family gives Milan the job -> the caterers' phones start ringing (as the rules allow).
  'POST /api/job': async (req, res) => {
    const { text } = await readJson(req);
    if (!text?.trim()) return send(res, 400, { error: 'Type a job first' });
    await startJob(text);
    send(res, 200, publicState());
  },

  // Family changes the brief, e.g. "The guest count just went up to 300".
  'POST /api/change': async (req, res) => {
    const { text } = await readJson(req);
    if (!text?.trim()) return send(res, 400, { error: 'Type a message first' });
    const err = await startChange(text);
    if (err) return send(res, err.code, { error: err.error });
    send(res, 200, publicState());
  },

  // Vendor taps "Answer" -> Milan checks the rules, introduces itself as an AI and asks the first question.
  'POST /api/call/answer': async (req, res, url) => {
    const call = callFor(url);
    if (!call || call.status !== 'ringing') return send(res, 409, { error: 'No incoming call' });
    await refreshRules(); // read the rules right before every call
    if (!rule('calls_enabled')) {
      applyRules();
      return send(res, 409, { error: 'Calls are paused (calls_enabled is off in Flagsmith).' });
    }
    call.status = 'live';
    call.startedAt = Date.now();
    try {
      const { say } = await nextMilanLine(call, true);
      addLine(call, 'milan', say);
      const audio = await textToSpeech(say);
      call.error = null;
      send(res, 200, { say, audio, end: false });
    } catch (e) {
      // Couldn't start the call (network trouble): ring again so they can answer once more.
      call.status = 'ringing';
      call.startedAt = null;
      call.transcript = [];
      call.error = e.message;
      throw e;
    }
  },

  // Vendor finished speaking -> transcribe, decide the reply, speak it.
  'POST /api/call/turn': async (req, res, url) => {
    const call = callFor(url);
    if (!call || call.status !== 'live') return send(res, 409, { error: 'No live call' });
    try {
      const wav = await readBody(req);
      const heard = await speechToText(wav);
      if (heard) {
        addLine(call, 'vendor', heard);
        call.vendorTurns += 1;
      }
      // Kill switch flipped during the call: end politely.
      if (call.stopping) return send(res, 200, { heard, ...(await politeGoodbye(call)) });

      let say;
      let end = false;
      if (!heard) {
        say = 'माफ़ कीजिए जी, मैं सुन नहीं पाई। क्या आप दोबारा बोल सकते हैं?';
      } else {
        ({ say, end } = await nextMilanLine(call, false));
        if (call.vendorTurns >= MAX_VENDOR_TURNS && !end) {
          say = 'बहुत धन्यवाद जी, आपकी सारी जानकारी मिल गई। परिवार आपसे जल्दी संपर्क करेगा। नमस्ते!';
          end = true;
        }
      }
      addLine(call, 'milan', say);
      const audio = await textToSpeech(say);
      call.error = null;
      if (end) finishCall(call);
      send(res, 200, { heard, say, audio, end });
    } catch (e) {
      call.error = e.message;
      throw e;
    }
  },

  // The vendor phone noticed the kill switch while waiting: Milan says goodbye and hangs up.
  'POST /api/call/goodbye': async (req, res, url) => {
    const call = callFor(url);
    if (!call || call.status !== 'live' || !call.stopping) return send(res, 409, { error: 'Nothing to stop' });
    send(res, 200, await politeGoodbye(call));
  },

  // Vendor hangs up (or declines) early.
  'POST /api/call/hangup': async (req, res, url) => {
    const call = callFor(url);
    if (call && (call.status === 'live' || call.status === 'ringing')) {
      if (call.transcript.length) finishCall(call);
      else {
        call.status = 'done';
        call.endedAt = Date.now();
        call.error = 'No answer';
        applyRules();
        if (call.kind === 'callback') computeChange();
        else maybeRecommend();
      }
    }
    send(res, 200, publicState());
  },

  // Family approves or declines (the Approve side sheet). which = 'initial' | 'change'.
  'POST /api/decision': async (req, res) => {
    const { action, which } = await readJson(req);
    if (!['approve', 'decline'].includes(action)) return send(res, 400, { error: 'Unknown action' });
    const err = decide(which, action);
    if (err) return send(res, 409, { error: err });
    send(res, 200, publicState());
  },

  // Start over (for re-running the demo).
  // ?all=1 also forgets the wedding, so the next visit starts at the setup questions.
  'POST /api/reset': (req, res, url) => {
    state = freshState(url.searchParams.get('all') ? null : state.wedding);
    send(res, 200, publicState());
  },
};

resumeAfterRestart();

// Kubernetes sends SIGTERM when it deletes a pod. Save and exit at once instead of
// waiting out the 30-second grace period (Node ignores SIGTERM by default as PID 1).
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`${signal} received, saving state and exiting`);
    try {
      saveState();
    } catch (e) {
      console.error(`Could not save state: ${e.message}`);
    }
    process.exit(0);
  });
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET' && url.pathname.startsWith('/static/')) {
      const name = path.basename(url.pathname); // no folders: nothing outside public/static can be read
      const file = path.join(here, 'public/static', name);
      if (!STATIC_TYPES[path.extname(name)] || !fs.existsSync(file)) return send(res, 404, { error: 'Not found' });
      return send(res, 200, fs.readFileSync(file), STATIC_TYPES[path.extname(name)]);
    }
    const handler = routes[`${req.method} ${url.pathname}`];
    if (!handler) return send(res, 404, { error: 'Not found' });
    try {
      await handler(req, res, url);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) send(res, 500, { error: e.message });
    }
  })
  .listen(PORT, async () => {
    console.log(`\nMilan is running.`);
    console.log(`  Landing page:      http://localhost:${PORT}/`);
    console.log(`  Setup (first run): http://localhost:${PORT}/start`);
    console.log(`  Dashboard:         http://localhost:${PORT}/app`);
    console.log(`  Vendor pages:      <your https tunnel link>/vendor?v=${VENDORS.map((v) => v.id).join(' | ')}`);
    await refreshRules();
    applyRules();
    console.log(`  Rules:             ${rules.source === 'flagsmith' ? `from Flagsmith (identity "${FLAGSMITH_IDENTITY}")` : 'defaults (add FLAGSMITH_ENVIRONMENT_KEY to .env to use Flagsmith)'}${rules.error ? ` (${rules.error})` : ''}\n`);
  });
