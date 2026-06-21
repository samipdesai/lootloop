import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { SidebarNav } from '@/components/dashboard/SidebarNav';
import { BottomNav } from '@/components/dashboard/BottomNav';
import { LogoutButton } from '@/components/dashboard/LogoutButton';

// Parent dashboard nav shell (task #10). Middleware already guarantees an
// onboarded parent reaches these routes; we re-read the profile + family here
// to render the family name and as a defense-in-depth gate.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, family:families(name)')
    .eq('auth_user_id', user.id)
    .eq('role', 'parent')
    .maybeSingle();

  if (!profile) redirect('/onboarding');

  const familyName = profile.family?.name ?? 'Your family';

  return (
    <div className="min-h-screen md:flex">
      {/* Sidebar — md and up */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-8 border-r border-border bg-surface-card px-5 py-7 md:flex">
        <div className="flex items-center gap-2.5 px-2">
          <Image src="/logomark.svg" alt="" width={32} height={32} priority />
          <span className="font-display text-[22px] font-extrabold leading-none text-ink-900">
            LootLoop
          </span>
        </div>
        <SidebarNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-surface-page/90 px-5 py-4 backdrop-blur md:px-8">
          <div className="flex min-w-0 flex-col">
            <span className="font-display text-[12px] font-bold uppercase tracking-[0.06em] text-ink-400">
              Family
            </span>
            <span className="truncate font-display text-[20px] font-extrabold leading-tight text-ink-900">
              {familyName}
            </span>
          </div>
          <LogoutButton />
        </header>

        {/* Routed content */}
        <main className="flex-1 px-5 pb-28 pt-6 md:px-8 md:pb-10">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>

      {/* Bottom tab bar — below md */}
      <BottomNav />
    </div>
  );
}
