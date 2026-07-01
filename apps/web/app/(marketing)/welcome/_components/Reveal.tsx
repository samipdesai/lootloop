'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

// Scroll-reveal wrapper: children fade + rise in when they enter the viewport.
// Server sections wrap their content in <Reveal>. Honors prefers-reduced-motion
// (renders visible immediately). The one generic client primitive on the page.
export function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) {
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -5% 0px' },
    );
    io.observe(el);
    // Safety net: never leave content permanently hidden if the observer never
    // fires (e.g. printed, no-scroll, or a captured full-page render).
    const fallback = setTimeout(() => setShown(true), 1200);
    return () => {
      io.disconnect();
      clearTimeout(fallback);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'} ${className}`}
    >
      {children}
    </div>
  );
}
