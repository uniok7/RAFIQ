// §4/§13: export — collect every table's rows for this user and email a JSON dump.
// Uses Resend if RESEND_API_KEY is set; otherwise returns the JSON in the response.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const RESEND = Deno.env.get('RESEND_API_KEY');

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TABLES = [
  'profiles', 'goals', 'tasks', 'sessions', 'day_signals',
  'recommendations', 'observations', 'routine_items', 'routine_checks',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return new Response('unauthorized', { status: 401, headers: cors });

  const asUser = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: u } = await asUser.auth.getUser();
  const userId = u?.user?.id;
  const email = u?.user?.email;
  if (!userId) return new Response('unauthorized', { status: 401, headers: cors });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const dump: Record<string, unknown> = {};
  for (const table of TABLES) {
    const col = table === 'profiles' ? 'id' : 'user_id';
    const { data } = await admin.from(table).select('*').eq(col, userId);
    dump[table] = data ?? [];
  }

  const json = JSON.stringify(dump, null, 2);

  if (RESEND && email) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: 'One Thing <export@onething.app>',
        to: email,
        subject: 'Your One Thing data export',
        text: 'Your data is attached as JSON.',
        attachments: [{ filename: 'one-thing-export.json', content: btoa(json) }],
      }),
    });
    return new Response(JSON.stringify({ ok: true, emailed: true }), {
      headers: { ...cors, 'content-type': 'application/json' },
    });
  }

  // No mailer configured (dev): return the dump directly.
  return new Response(json, { headers: { ...cors, 'content-type': 'application/json' } });
});
