'use client';

import { useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './Input';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  hint?: string;
  error?: string;
  iconLeft?: ReactNode;
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
          className="flex items-center text-ink-400 outline-none focus-visible:text-indigo-strong"
        >
          {show ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>
      }
    />
  );
}
