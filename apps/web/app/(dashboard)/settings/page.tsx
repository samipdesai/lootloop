import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DangerZone } from './_components/DangerZone';

// Settings → Danger Zone (task #52). Server component re-reads the parent's
// family (name + kid count) — same pattern as the dashboard layout — so the
// type-to-confirm gate and the "N kids" consequence copy render with real
// values. The destructive actions themselves run client-side via the
// @lootloop/client account service (DangerZone).
export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('family:families(name)')
    .eq('auth_user_id', user.id)
    .eq('role', 'parent')
    .maybeSingle();

  if (!profile) redirect('/onboarding');

  const familyName = profile.family?.name ?? 'Your family';

  // Count the kids in this family (RLS scopes the read to the parent's family)
  // for the "permanently deletes … for N kids" consequence copy.
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'kid');

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[28px] font-extrabold leading-tight text-ink-900">
          Settings
        </h1>
        <p className="font-sans text-[15px] text-ink-500">Manage your account and family.</p>
      </div>

      <DangerZone familyName={familyName} kidCount={count ?? 0} />
    </div>
  );
}
