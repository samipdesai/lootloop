'use client';

import { useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Input } from './Input';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  hint?: string;
  error?: string;
}

// Password field with a show/hide eye toggle (spec §5.1, §10).
export function PasswordInput(props: PasswordInputProps) {
  const [show, setShow] = useState(false);
  return (
    <Input
      {...props}
      type={show ? 'text' : 'password'}
      suffix={
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="font-sans text-[13px] font-bold text-indigo-strong outline-none focus-visible:underline"
        >
          {show ? 'Hide' : 'Show'}
        </button>
      }
    />
  );
}
