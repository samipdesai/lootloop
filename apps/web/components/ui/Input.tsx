'use client';

import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  suffix?: ReactNode;
  // Optional leading icon rendered inside the field, before the input (mirrors
  // `suffix`). Used by the login redesign (mail / lock icons).
  iconLeft?: ReactNode;
}

// h-12, rounded-lg (22px), 2px inset ring: border idle → indigo focus (+ glow)
// → danger on error. Nunito 600 (design/components/core/Input.jsx contract).
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, suffix, iconLeft, id, className = '', ...rest },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  const describedBy = error || hint ? `${inputId}-desc` : undefined;

  const ring = error
    ? 'shadow-[inset_0_0_0_2px_var(--color-danger)]'
    : 'shadow-[inset_0_0_0_2px_var(--color-border)] focus-within:shadow-[inset_0_0_0_2px_var(--color-indigo),0_0_0_4px_rgba(91,99,230,0.32)]';

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="font-sans text-sm font-bold text-ink-900">
          {label}
        </label>
      )}
      <div
        className={`flex h-12 items-center gap-2.5 rounded-lg bg-surface-card px-4 transition-shadow ${ring}`}
      >
        {iconLeft && <span className="flex items-center text-ink-400">{iconLeft}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`min-w-0 flex-1 border-none bg-transparent font-sans text-base font-semibold text-ink-900 outline-none placeholder:text-ink-400 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
          {...rest}
        />
        {suffix && <span className="flex items-center">{suffix}</span>}
      </div>
      {(error || hint) && (
        <span
          id={describedBy}
          className={`font-sans text-[13px] font-semibold ${error ? 'text-danger-ink' : 'text-ink-500'}`}
        >
          {error || hint}
        </span>
      )}
    </div>
  );
});
