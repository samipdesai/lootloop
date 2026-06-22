'use client';

import { useEffect } from 'react';

export interface ToastState {
  message: string;
  tone: 'mint' | 'neutral';
}

// Transient confirmation surfaced after an approve/reject succeeds and the row
// has been removed. Auto-dismisses; mint tone for awards, neutral for rejects.
export function Toast({
  message,
  tone,
  onDismiss,
}: {
  message: string;
  tone: 'mint' | 'neutral';
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3200);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  const toneClass = tone === 'mint' ? 'bg-mint-soft text-mint-ink' : 'bg-ink-100 text-ink-700';

  return (
    <div
      role="status"
      className={`fixed bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-pill px-5 py-3 font-display text-sm font-extrabold shadow-[0_8px_20px_rgba(32,36,58,0.16)] ${toneClass}`}
    >
      {message}
    </div>
  );
}
