'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost';
type Size = 'lg' | 'md' | 'sm';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
  iconLeft?: ReactNode;
}

const sizeClasses: Record<Size, string> = {
  lg: 'h-14 px-7 text-[18px]',
  md: 'h-12 px-[22px] text-base',
  sm: 'h-10 px-4 text-sm',
};

// Pill button with the chunky 3D bottom edge that depresses 2px on press
// (design/components/core/Button.jsx contract). Primary (orange) + ghost only.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    block = false,
    loading = false,
    disabled,
    iconLeft,
    children,
    className = '',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
  const isGhost = variant === 'ghost';

  const base =
    'inline-flex items-center justify-center gap-2 font-display font-bold leading-none whitespace-nowrap select-none rounded-pill transition-[transform,box-shadow,background] outline-none focus-visible:ring-2 focus-visible:ring-indigo-strong';

  let variantClass: string;
  if (isDisabled && !loading) {
    variantClass = 'bg-ink-200 text-ink-400 cursor-not-allowed shadow-none';
  } else if (isGhost) {
    variantClass = 'bg-transparent text-orange-strong hover:text-orange-ink shadow-none';
  } else {
    // 3D bottom edge via shadow; active translates down and collapses the edge.
    variantClass =
      'bg-orange hover:bg-orange-strong text-white shadow-[0_4px_0_var(--color-orange-strong)] active:translate-y-[2px] active:shadow-[0_2px_0_var(--color-orange-strong)]';
  }

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={`${base} ${sizeClasses[size]} ${block ? 'w-full' : 'w-auto'} ${variantClass} ${loading ? 'cursor-wait' : ''} ${className}`}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white"
        />
      ) : (
        iconLeft
      )}
      {children}
    </button>
  );
});
