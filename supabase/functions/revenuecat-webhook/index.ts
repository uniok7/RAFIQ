import { createClient } from 'npm:@supabase/supabase-js@2';

type Customer = { subscriber?: { entitlements?: Record<string, { expires_date?: string | null }> } };

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('method_not_allowed', { status: 405 });
  if (request.headers.get('Authorization') !== Deno.env.get('REVENUECAT_WEBHOOK_AUTH')) return new Response('unauthorized', { status: 401 });
  const body = await request.json() as { event?: { app_user_id?: string } };
  const userId = body.event?.app_user_id;
  if (!userId) return new Response('invalid_event', { status: 400 });
  const secret = Deno.env.get('REVENUECAT_V1_SECRET_API_KEY')!;
  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, { headers: { Authorization: `Bearer ${secret}` } });
  if (!response.ok) return new Response('lookup_failed', { status: 503 });
  const customer = await response.json() as Customer;
  const id = Deno.env.get('REVENUECAT_ENTITLEMENT_ID') ?? 'pro';
  const value = customer.subscriber?.entitlements?.[id];
  const expiresAt = value?.expires_date ?? null;
  const active = Boolean(value) && (!expiresAt || new Date(expiresAt).getTime() > Date.now());
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error } = await admin.from('user_entitlements').upsert({ user_id: userId, active, expires_at: expiresAt, updated_at: new Date().toISOString() });
  return error ? new Response('upsert_failed', { status: 500 }) : new Response('ok');
});
