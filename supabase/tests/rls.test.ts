import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  throw new Error('RLS tests require SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.');
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
let userAClient: SupabaseClient;
let userAId = '';
let userBId = '';
let goalB = '';
let taskB = '';
let sessionB = '';
let recommendationB = '';
let observationB = '';
let routineItemB = '';
const testDay = '2026-08-19';
const runId = crypto.randomUUID();
const password = `Rls-${crypto.randomUUID()}-Aa9!`;

type Target = {
  table: string;
  select: Record<string, string>;
  update: Record<string, unknown>;
};

async function createTestUser(label: string) {
  const email = `rls-${label}-${runId}@example.invalid`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  return { email, id: data.user.id };
}

beforeAll(async () => {
  const userA = await createTestUser('a');
  const userB = await createTestUser('b');
  userAId = userA.id;
  userBId = userB.id;

  userAClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await userAClient.auth.signInWithPassword({ email: userA.email, password });
  if (signInError) throw signInError;

  const { data: goal, error: goalError } = await admin.from('goals').insert({ user_id: userBId, title: 'Private B goal' }).select('id').single();
  if (goalError) throw goalError;
  goalB = goal.id;

  const { data: task, error: taskError } = await admin.from('tasks').insert({ user_id: userBId, goal_id: goalB, title: 'Private B task' }).select('id').single();
  if (taskError) throw taskError;
  taskB = task.id;

  const { data: session, error: sessionError } = await admin.from('sessions').insert({ user_id: userBId, task_id: taskB, day: testDay, planned_mins: 30 }).select('id').single();
  if (sessionError) throw sessionError;
  sessionB = session.id;

  const seedResults = await Promise.all([
    admin.from('day_signals').insert({ user_id: userBId, day: testDay, sleep_mins: 420 }),
    admin.from('recommendations').insert({ user_id: userBId, day: testDay, type: 'main_win', payload: { taskId: taskB }, reasoning: 'Private', engine_version: 1 }).select('id').single(),
    admin.from('observations').insert({ user_id: userBId, key: 'avoidance', label: 'Private', value: 'Private', source: 'inferred' }).select('id').single(),
    admin.from('routine_items').insert({ user_id: userBId, label: 'Private routine' }).select('id').single(),
    admin.from('population_priors').upsert({ key: `rls-${runId}`, value: 1, n: 1 }),
    admin.from('llm_daily_usage').upsert({ user_id: userBId, day: testDay, calls: 1 }),
    admin.from('user_entitlements').upsert({ user_id: userBId, active: true }),
  ]);
  for (const result of seedResults) if (result.error) throw result.error;
  recommendationB = seedResults[1].data!.id;
  observationB = seedResults[2].data!.id;
  routineItemB = seedResults[3].data!.id;

  const { error: checkError } = await admin.from('routine_checks').insert({ user_id: userBId, item_id: routineItemB, day: testDay });
  if (checkError) throw checkError;
}, 30_000);

afterAll(async () => {
  await admin.from('population_priors').delete().eq('key', `rls-${runId}`);
  if (userAId) await admin.auth.admin.deleteUser(userAId);
  if (userBId) await admin.auth.admin.deleteUser(userBId);
});

describe('two-user RLS isolation', () => {
  it('user A cannot read or update user B profile', async () => {
    const read = await userAClient.from('profiles').select('*').eq('id', userBId);
    expect(read.error).toBeNull();
    expect(read.data).toHaveLength(0);
    const write = await userAClient.from('profiles').update({ display_name: 'breach' }).eq('id', userBId).select();
    expect(write.error).toBeNull();
    expect(write.data).toHaveLength(0);
  });

  it('blocks reads and writes to every user-owned table', async () => {
    const targets: Target[] = [
      { table: 'goals', select: { id: goalB }, update: { title: 'breach' } },
      { table: 'tasks', select: { id: taskB }, update: { title: 'breach' } },
      { table: 'sessions', select: { id: sessionB }, update: { interruptions: 99 } },
      { table: 'day_signals', select: { user_id: userBId, day: testDay }, update: { sleep_mins: 1 } },
      { table: 'observations', select: { id: observationB }, update: { value: 'breach' } },
      { table: 'routine_items', select: { id: routineItemB }, update: { label: 'breach' } },
      { table: 'routine_checks', select: { user_id: userBId, item_id: routineItemB, day: testDay }, update: { day: '2026-08-20' } },
    ];

    for (const target of targets) {
      let readQuery = userAClient.from(target.table).select('*');
      for (const [key, value] of Object.entries(target.select)) readQuery = readQuery.eq(key, value);
      const read = await readQuery;
      expect(read.error, `${target.table} read should be filtered`).toBeNull();
      expect(read.data, `${target.table} leaked user B data`).toHaveLength(0);

      let writeQuery = userAClient.from(target.table).update(target.update);
      for (const [key, value] of Object.entries(target.select)) writeQuery = writeQuery.eq(key, value);
      const write = await writeQuery.select();
      expect(write.error, `${target.table} update should not expose an error side channel`).toBeNull();
      expect(write.data, `${target.table} allowed a cross-user update`).toHaveLength(0);
    }
  });

  it('keeps server-only population priors inaccessible', async () => {
    const read = await userAClient.from('population_priors').select('*').eq('key', `rls-${runId}`);
    expect(read.data ?? []).toHaveLength(0);
    const write = await userAClient.from('population_priors').insert({ key: `breach-${runId}`, value: 2, n: 1 });
    expect(write.error).not.toBeNull();
  });

  it('keeps per-user LLM spend server-only', async () => {
    const read = await userAClient.from('llm_daily_usage').select('*').eq('user_id', userBId);
    expect(read.data ?? []).toHaveLength(0);
    const write = await userAClient.from('llm_daily_usage').update({ calls: 0 }).eq('user_id', userBId);
    expect(write.error).not.toBeNull();
  });

  it('keeps subscription writes server-only and other users hidden', async () => {
    const read = await userAClient.from('user_entitlements').select('*').eq('user_id', userBId);
    expect(read.error).toBeNull();
    expect(read.data ?? []).toHaveLength(0);
    const write = await userAClient.from('user_entitlements').update({ active: false }).eq('user_id', userAId);
    expect(write.error).not.toBeNull();
  });

  it('keeps recommendation writes behind audited RPCs', async () => {
    const read = await userAClient.from('recommendations').select('*').eq('id', recommendationB);
    expect(read.error).toBeNull();
    expect(read.data ?? []).toHaveLength(0);
    const directWrite = await userAClient.from('recommendations').update({ reasoning: 'breach' }).eq('id', recommendationB);
    expect(directWrite.error).not.toBeNull();
  });
});
