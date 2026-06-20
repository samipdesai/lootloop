import type { ReactNode } from 'react';

// White surface, rounded-card (24px), shadow-md (design/components/core/Card.jsx).
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-card bg-surface-card p-6 shadow-[0_8px_20px_rgba(32,36,58,0.10)] ${className}`}
    >
      {children}
    </div>
  );
}
