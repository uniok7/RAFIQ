// §3: sign in as user A, try to read AND write user B's rows in every table.
// The build fails if any cross-user read returns rows or any cross-user write succeeds.
// Requires a live Supabase project. Gated on env so it no-ops locally and runs in CI.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const live = Boolean(URL && ANON && SERVICE);

// Every user table that must be isolated.
const USER_TABLES = [
  'profiles',
  'goals',
  'tasks',
  'sessions',
  'day_signals',
  'meals',
  'tired_events',
  'recommendations',
  'observations',
  'routine_items',
  'routine_checks',
] as const;

const d = live ? describe : describe.skip;

d('RLS two-user isolation (§3)', () => {
  let admin: SupabaseClient;
  let a: SupabaseClient;
  let bUserId = '';
  const rnd = () => Math.random().toString(36).slice(2);
  const emailA = `rls-a-${rnd()}@example.com`;
  const emailB = `rls-b-${rnd()}@example.com`;
  const pass = `Pw-${rnd()}-${rnd()}`;

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } });
    const { data: ua } = await admin.auth.admin.createUser({
      email: emailA,
      password: pass,
      email_confirm: true,
    });
    const { data: ub } = await admin.auth.admin.createUser({
      email: emailB,
      password: pass,
      email_confirm: true,
    });
    bUserId = ub!.user!.id;

    // Seed one row for B in a couple of tables so cross-reads have a target.
    await admin.from('tasks').insert({ user_id: bUserId, title: 'B private task' });
    await admin.from('goals').insert({ user_id: bUserId, title: 'B private goal' });

    a = createClient(URL!, ANON!, { auth: { persistSession: false } });
    await a.auth.signInWithPassword({ email: emailA, password: pass });
    void ua;
  });

  afterAll(async () => {
    // Clean up both test users (cascades their rows).
    const { data } = await admin.auth.admin.listUsers();
    for (const u of data?.users ?? []) {
      if (u.email === emailA || u.email === emailB) {
        await admin.auth.admin.deleteUser(u.id);
      }
    }
  });

  for (const table of USER_TABLES) {
    it(`A cannot READ B's rows in ${table}`, async () => {
      const { data, error } = await a.from(table).select('*').eq('user_id', bUserId);
      // RLS returns an empty set (not an error) — the key assertion is zero rows.
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it(`A cannot WRITE a row owned by B in ${table}`, async () => {
      const row =
        table === 'profiles'
          ? { id: bUserId }
          : { user_id: bUserId, ...requiredCols(table) };
      const { data, error } = await a.from(table).insert(row).select();
      // The WITH CHECK clause must reject it: either an error or zero inserted rows.
      const inserted = (data ?? []).length;
      expect(error !== null || inserted === 0).toBe(true);
    });
  }
});

// Minimal NOT NULL columns per table so the insert reaches the RLS check.
function requiredCols(table: string): Record<string, unknown> {
  switch (table) {
    case 'goals':
      return { title: 'x' };
    case 'tasks':
      return { title: 'x' };
    case 'sessions':
      return { day: '2026-08-19', planned_mins: 30 };
    case 'day_signals':
      return { day: '2026-08-19' };
    case 'meals':
      return { day: '2026-08-19', raw_text: 'x' };
    case 'tired_events':
      return { day: '2026-08-19' };
    case 'recommendations':
      return { day: '2026-08-19', type: 'main_win', payload: {}, reasoning: 'x', engine_version: 1 };
    case 'observations':
      return { key: 'avoidance', label: 'x', value: 'x', source: 'inferred' };
    case 'routine_items':
      return { label: 'x' };
    case 'routine_checks':
      return { item_id: '00000000-0000-0000-0000-000000000000', day: '2026-08-19' };
    default:
      return {};
  }
}
