// §4: account deletion — cascades all rows (FK on delete cascade) and revokes the auth user.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return new Response('unauthorized', { status: 401, headers: cors });

  const asUser = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data } = await asUser.auth.getUser();
  const userId = data?.user?.id;
  if (!userId) return new Response('unauthorized', { status: 401, headers: cors });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  // Deleting the auth user cascades every user table (references auth.users on delete cascade).
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return new Response(error.message, { status: 500, headers: cors });
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...cors, 'content-type': 'application/json' },
  });
});
