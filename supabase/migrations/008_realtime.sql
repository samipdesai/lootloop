-- 008: Realtime (#41) — cross-device live sync.
--
-- Add the family-scoped tables whose changes should propagate live to the
-- `supabase_realtime` publication. Realtime respects RLS, so each authenticated
-- principal (parent GoTrue session / kid custom JWT) only receives change events
-- for rows they're allowed to SELECT under the 002 policies. Clients subscribe
-- via postgres_changes filtered by family_id (see packages/client/src/realtime.ts).
--
-- Idempotent: skip tables already in the publication so re-running is safe.
do $$
declare
  t text;
  rt_tables text[] := array[
    'wallets', 'point_transactions', 'chore_completions', 'chore_instances',
    'reward_purchases', 'reading_logs', 'reading_streaks', 'savings_transactions',
    'schedule_items', 'chores', 'rewards', 'profiles'
  ];
begin
  foreach t in array rt_tables loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
