'use client';

import { useEffect, useState } from 'react';
import { getFamilyCode, regenerateFamilyCode } from '@lootloop/client';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

export function FamilyCodePanel() {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const { data, error: err } = await getFamilyCode(supabase);
      if (cancelled) return;
      if (err) {
        setError(err.message ?? 'Could not load your family code.');
        setLoading(false);
        return;
      }
      setCode(data?.kid_code ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy the code. Select it and copy manually.');
    }
  }

  async function handleRegenerate() {
    if (
      !window.confirm(
        'Regenerate the family code? The old code stops working — kids using it will need the new one.',
      )
    ) {
      return;
    }
    setError('');
    setRegenerating(true);
    const supabase = createClient();
    const { data, error: err } = await regenerateFamilyCode(supabase);
    if (err || !data) {
      setError(err?.message ?? 'Could not regenerate the code. Please try again.');
      setRegenerating(false);
      return;
    }
    setCode(data);
    setCopied(false);
    setRegenerating(false);
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-extrabold text-ink-900">Family device code</h2>
        <p className="font-sans text-sm font-semibold text-ink-500">
          Kids type this code on their device to sign in.
        </p>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {loading ? (
        <div className="h-14 w-48 animate-pulse rounded-lg bg-ink-100" aria-label="Loading code" />
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="select-all font-display text-3xl font-extrabold tracking-[0.2em] text-orange-strong">
            {code ?? '——'}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              disabled={!code || regenerating}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleRegenerate}
              loading={regenerating}
            >
              Regenerate
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
