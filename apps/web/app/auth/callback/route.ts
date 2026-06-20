import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGateState } from '@/lib/auth/profile';

// Email-confirmation + password-recovery callback. Exchanges the code for a
// session, then routes: explicit ?next (recovery → /reset-password) wins;
// otherwise by profile state (no profile → /onboarding, onboarded → /).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next');

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login`);
  }

  if (next) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  const gate = await getGateState(supabase);
  const dest = gate === 'onboarded' ? '/' : '/onboarding';
  return NextResponse.redirect(`${origin}${dest}`);
}
