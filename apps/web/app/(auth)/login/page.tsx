import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { LoginBrandPanel } from './LoginBrandPanel';
import { LoginForm } from './LoginForm';
import { SocialButtons } from './SocialButtons';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-wrap bg-surface-page">
      <LoginBrandPanel />

      {/* form panel */}
      <div className="flex flex-[1_1_460px] items-center justify-center p-7 sm:p-12">
        <div className="w-full max-w-[400px]">
          <Link
            href="/"
            className="mb-7 inline-flex items-center gap-1.5 font-sans text-sm font-bold text-ink-500 hover:text-ink-900"
          >
            <ChevronLeft size={16} />
            Back to home
          </Link>

          <h2 className="font-display text-[28px] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-4xl">
            Welcome back
          </h2>
          <p className="mt-2 text-base text-ink-500">Log in to manage your family.</p>

          <div className="mt-7">
            <LoginForm />
          </div>

          <div className="my-[22px] flex items-center gap-3.5">
            <span className="h-px flex-1 bg-ink-200" />
            <span className="text-[13px] font-bold text-ink-400">or</span>
            <span className="h-px flex-1 bg-ink-200" />
          </div>

          <SocialButtons />

          <p className="mt-6 text-center font-sans text-[15px] font-semibold text-ink-500">
            New here?{' '}
            <Link href="/signup" className="font-extrabold text-orange-strong hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
