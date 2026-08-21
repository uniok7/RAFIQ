import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

type Job = 'onboarding_parse' | 'natural_language' | 'weekly_summary';

const prompts: Record<Job, string> = {
  onboarding_parse: `Return raw JSON only with this exact shape: {"goals":[{"title":"","why":""}],"tasks":[{"title":"","goal":"","estimate":30,"load":2,"due":null}]}. Maximum 4 goals and 10 tasks. Every task must be a concrete first action, never a theme. Estimate is minutes, load is 1, 2, or 3, and due is YYYY-MM-DD or null. Preserve the user's stated why without adding motivation.`,
  natural_language: `Return raw JSON only with this exact shape: {"say":"","action":"none|add_task|complete|set_energy|defer|shorten","task":{},"taskId":"","energy":"low|normal|high","minutes":30}. "say" is one or two plain sentences with no flattery. Use only ids present in state. Do not rank tasks. For a task the user says is nonexistent or dead, use action "complete" and set task.status to "dropped" so the client removes rather than completes it.`,
  weekly_summary: `Return raw JSON only with this exact shape: {"summary":""}. Write 2-3 plain sentences. No advice, motivation, praise, or diagnosis. If evidenceDays is under 15, report only literal counts or values and do not name a pattern, habit, tendency, or causal relationship. At 15+ days, every observation must be directly supported by the supplied aggregate input.`,
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

function cleanJson(text: string) {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

function validate(job: Job, value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('invalid_model_json');
  if (job === 'onboarding_parse') {
    const plan = value as { goals?: unknown[]; tasks?: unknown[] };
    if (!Array.isArray(plan.goals) || !Array.isArray(plan.tasks)) throw new Error('invalid_model_json');
    plan.goals = plan.goals.slice(0, 4);
    plan.tasks = plan.tasks.slice(0, 10);
  }
  return value;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'authentication_required' }, 401);
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: 'authentication_required' }, 401);

  let body: { job?: Job; input?: unknown };
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  if (!body.job || !prompts[body.job]) return json({ error: 'invalid_job' }, 400);
  const serialized = typeof body.input === 'string' ? body.input : JSON.stringify(body.input);
  if (!serialized || serialized.length > 20_000) return json({ error: 'invalid_input' }, 400);

  const { data: canCreate, error: accessError } = await supabase.rpc('can_create_recommendations');
  if (accessError) return json({ error: 'access_check_failed' }, 500);
  if (!canCreate) return json({ error: 'subscription_required' }, 402);

  const { error: quotaError } = await supabase.rpc('consume_llm_call');
  if (quotaError) return json({ error: quotaError.message.includes('daily_llm_limit') ? 'daily_limit_reached' : 'quota_failed' }, quotaError.message.includes('daily_llm_limit') ? 429 : 500);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'server_not_configured' }, 503);
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, temperature: 0.1, system: prompts[body.job], messages: [{ role: 'user', content: serialized }] }),
  });
  if (!response.ok) return json({ error: 'model_request_failed' }, 502);
  const message = await response.json() as { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } };
  const text = message.content?.find((block) => block.type === 'text')?.text;
  if (!text) return json({ error: 'empty_model_response' }, 502);
  await supabase.rpc('record_llm_tokens', { p_input: message.usage?.input_tokens ?? 0, p_output: message.usage?.output_tokens ?? 0 });

  try { return json({ data: validate(body.job, JSON.parse(cleanJson(text))) }); }
  catch { return json({ error: 'invalid_model_json' }, 502); }
});
