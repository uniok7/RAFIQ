import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } }); }

type Customer = { subscriber?: { entitlements?: Record<string, { expires_date?: string | null }> } };

async function revenueCatCustomer(userId: string) {
  const secret = Deno.env.get('REVENUECAT_V1_SECRET_API_KEY');
  if (!secret) throw new Error('revenuecat_not_configured');
  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, { headers: { Authorization: `Bearer ${secret}` } });
  if (!response.ok) throw new Error('revenuecat_lookup_failed');
  return await response.json() as Customer;
}

function entitlement(customer: Customer) {
  const id = Deno.env.get('REVENUECAT_ENTITLEMENT_ID') ?? 'pro';
  const value = customer.subscriber?.entitlements?.[id];
  const expiresAt = value?.expires_date ?? null;
  return { active: Boolean(value) && (!expiresAt || new Date(expiresAt).getTime() > Date.now()), expiresAt };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'authentication_required' }, 401);
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return json({ error: 'authentication_required' }, 401);
  const admin = createClient(url, serviceKey);

  if (request.method === 'DELETE') {
    const secret = Deno.env.get('REVENUECAT_V1_SECRET_API_KEY');
    if (secret) await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(data.user.id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${secret}` } }).catch(() => undefined);
    const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
    return deleteError ? json({ error: 'delete_failed' }, 500) : json({ deleted: true });
  }

  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  let body: { action?: string };
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  if (body.action !== 'sync_entitlement') return json({ error: 'invalid_action' }, 400);
  try {
    const current = entitlement(await revenueCatCustomer(data.user.id));
    const { error: upsertError } = await admin.from('user_entitlements').upsert({ user_id: data.user.id, active: current.active, expires_at: current.expiresAt, updated_at: new Date().toISOString() });
    if (upsertError) throw upsertError;
    return json(current);
  } catch (syncError) {
    return json({ error: syncError instanceof Error ? syncError.message : 'sync_failed' }, 503);
  }
});
