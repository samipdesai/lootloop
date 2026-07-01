import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@lootloop/types';

// Auth routes a fully-onboarded user gets bounced away from.
const AUTH_ROUTES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/confirm',
  '/onboarding',
];

// Routes a logged-out user may view (onboarding excluded — spec §7).
const PUBLIC_ROUTES = ['/login', '/signup', '/forgot-password', '/confirm'];

// Fully public marketing/legal routes (M7 #55, #53). These render for anyone —
// logged-out or logged-in, onboarded or not — and must never trigger an auth or
// onboarding redirect. Checked first, before any session work.
const MARKETING_ROUTES = ['/welcome', '/coming-soon', '/privacy', '/terms'];

// Refreshes the Supabase session on every request (the standard @supabase/ssr
// updateSession pattern) and gates routes by session + profile state (spec §7).
export async function middleware(request: NextRequest) {
  // Public marketing/legal pages bypass all auth gating.
  if (MARKETING_ROUTES.some(r => request.nextUrl.pathname.startsWith(r))) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = AUTH_ROUTES.some(r => pathname.startsWith(r));
  const isPublicRoute = PUBLIC_ROUTES.some(r => pathname.startsWith(r));
  const isCallback = pathname.startsWith('/auth/callback');

  // Let the callback exchange run regardless of session state.
  if (isCallback) return response;

  // /reset-password is reached via a recovery session from the emailed link;
  // never redirect away from it — the screen handles the no-session (invalid
  // link) case itself.
  if (pathname.startsWith('/reset-password')) return response;

  // No session: public auth routes (/login, /signup, …) render directly; the
  // apex "/" REWRITES to the marketing homepage (URL stays "/", no visible
  // redirect); any other gated path (dashboard routes) still bounces to /login.
  if (!user) {
    if (isPublicRoute) return response;
    if (pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/welcome';
      return NextResponse.rewrite(url);
    }
    return redirect(request, '/login');
  }

  // Session present: resolve profile state.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .eq('role', 'parent')
    .maybeSingle();

  const onboarded = Boolean(profile);

  if (!onboarded) {
    // Confirmed but no profile → force onboarding from anywhere.
    if (pathname.startsWith('/onboarding')) return response;
    return redirect(request, '/onboarding');
  }

  // Fully onboarded → auth routes bounce to the dashboard.
  if (isAuthRoute) return redirect(request, '/');

  return response;
}

function redirect(request: NextRequest, to: string) {
  const url = request.nextUrl.clone();
  url.pathname = to;
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except static assets and image files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)'],
};
