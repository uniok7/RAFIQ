// POST /llm — the ONLY place the Anthropic key exists (§6, §2).
// Holds the key, rate-limits per user (60/day), logs token spend, runs jobs A/B/C.
// Deno runtime (Supabase Edge Functions). Never called from the client with the key.
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Spec-pinned model id (§6). If Anthropic renames it, change here only.
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1000;
const DAILY_CALL_CAP = 60; // §6

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Job = 'A' | 'B' | 'C' | 'D';

interface Body {
  job: Job;
  input: unknown;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });
}

// ── prompts per job (§6). Each demands raw JSON only. ──
function buildPrompt(job: Job, input: any): { system: string; user: string; fallback: unknown } {
  switch (job) {
    case 'A': // onboarding parse
      return {
        system:
          'You turn a messy paragraph into a concrete plan. Output RAW JSON only, no prose, no code fences. ' +
          'Max 4 goals, max 10 tasks. Every task must be a concrete first action, not a theme. ' +
          'Schema: {"goals":[{"title":"","why":""}],"tasks":[{"title":"","goal":"","estimate":30,"load":2,"due":null}]}',
        user: String(input?.paragraph ?? ''),
        fallback: { goals: [], tasks: [] },
      };
    case 'B': // natural language input
      return {
        system:
          'You interpret one user sentence against their current state. Output RAW JSON only. ' +
          '"say" is one or two plain sentences, no flattery. ' +
          'Schema: {"say":"","action":"none|add_task|complete|set_energy|defer|shorten|log_meal|tired",' +
          '"task":{},"taskId":"","energy":"low|normal|high","minutes":30,"mealText":""}',
        user: JSON.stringify(input ?? {}),
        fallback: { say: "That didn't go through. Say it again?", action: 'none' },
      };
    case 'C': // weekly summary
      return {
        system:
          'Write 2-3 sentences of plain observation about this week. No advice, no motivation. ' +
          'Output RAW JSON only. Schema: {"text":""}',
        user: JSON.stringify(input ?? {}),
        fallback: { text: '' },
      };
    case 'D': // meal parse (§8 Job D)
      return {
        system:
          'Parse this meal into JSON only, no markdown. ' +
          'Schema: {"items":[string],"slot":"breakfast|lunch|dinner|snack",' +
          '"protein":"none|low|ok|good","veg":"none|low|ok|good","fibre":"none|low|ok|good",' +
          '"carb_type":"refined|whole|mixed|none","missing":[string]}. ' +
          'Rules: rate COARSELY — never estimate grams, calories, or micronutrient amounts. ' +
          '"missing" = food groups absent, max 2. Too vague to rate -> "unknown", never guess.',
        user: `Meal: "${input?.raw_text ?? ''}"  Time: ${input?.time ?? ''}`,
        // Fallback: store raw text with null ratings, never block the log (§8).
        fallback: { items: [], slot: null, protein: null, veg: null, fibre: null, carb_type: null, missing: [] },
      };
  }
}

// Strip ``` fences then JSON.parse; fall back on any failure (§6).
function parseLoose(raw: string, fallback: unknown): unknown {
  const cleaned = raw.replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return fallback;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

  // Identify the caller from their JWT (RLS-scoped client).
  const asUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await asUser.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const today = new Date().toISOString().slice(0, 10);

  // Rate limit: count today's calls (§6). Server-side, cannot be bypassed by the client.
  const { count } = await admin
    .from('llm_usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('day', today);
  if ((count ?? 0) >= DAILY_CALL_CAP) return json({ error: 'rate_limited' }, 429);

  // §12: free tier after trial makes NO new AI calls. Enforce against RevenueCat
  // entitlement here before spending tokens.
  if (!(await hasAiEntitlement(userId))) return json({ error: 'no_entitlement' }, 402);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!['A', 'B', 'C', 'D'].includes(body.job)) return json({ error: 'bad_job' }, 400);

  const { system, user, fallback } = buildPrompt(body.job, body.input);

  let result: unknown = fallback;
  let inTok = 0;
  let outTok = 0;
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      const text = data?.content?.[0]?.text ?? '';
      inTok = data?.usage?.input_tokens ?? 0;
      outTok = data?.usage?.output_tokens ?? 0;
      result = parseLoose(text, fallback);
    }
  } catch {
    result = fallback; // network/parse failure -> defined fallback
  }

  // Log spend regardless of success so the cap counts real attempts.
  await admin.from('llm_usage').insert({
    user_id: userId,
    day: today,
    job: body.job,
    input_tokens: inTok,
    output_tokens: outTok,
  });

  return json({ result });
});

// RevenueCat entitlement check (§12). Trial and paid both grant AI; expired-free does not.
// Fails OPEN only in dev when RC isn't configured, so the app is usable before billing lands.
async function hasAiEntitlement(userId: string): Promise<boolean> {
  const rcKey = Deno.env.get('REVENUECAT_SECRET_KEY');
  if (!rcKey) return true; // dev / pre-billing
  try {
    const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${userId}`, {
      headers: { Authorization: `Bearer ${rcKey}` },
    });
    if (!r.ok) return false;
    const data = await r.json();
    const ent = data?.subscriber?.entitlements ?? {};
    // "ai" entitlement active if any expiry is in the future (trial counts).
    return Object.values(ent).some((e: any) => {
      const exp = e?.expires_date ? Date.parse(e.expires_date) : Infinity;
      return exp > Date.now();
    });
  } catch {
    return false;
  }
}
