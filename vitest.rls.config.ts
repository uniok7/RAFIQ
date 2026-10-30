import { defineConfig } from 'vitest/config';
// Separate config: the RLS test imports @supabase/supabase-js and needs a live project.
// It self-skips when SUPABASE_* env vars are absent.
export default defineConfig({
  test: { include: ['supabase/tests/**/*.test.ts'], environment: 'node' },
});
