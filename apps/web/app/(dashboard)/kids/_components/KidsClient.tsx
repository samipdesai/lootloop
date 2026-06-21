'use client';

import { useEffect, useState } from 'react';
import { listKids, deleteKid, type KidProfile } from '@lootloop/client';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { KidRow } from './KidRow';
import { KidForm } from './KidForm';
import { ChangePinModal } from './ChangePinModal';
import { FamilyCodePanel } from './FamilyCodePanel';

// `form` state: null = closed, 'new' = create, KidProfile = editing that kid.
type FormState = null | 'new' | KidProfile;

export function KidsClient() {
  const [kids, setKids] = useState<KidProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [form, setForm] = useState<FormState>(null);
  const [pinKid, setPinKid] = useState<KidProfile | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  // Bumped to re-run the load effect (mount load + retry + post-save refetch).
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      const { data, error } = await listKids(supabase);
      if (cancelled) return;
      if (error) {
        setLoadError(error.message ?? 'Could not load your kids. Please try again.');
        setLoading(false);
        return;
      }
      setKids(data ?? []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function refetch() {
    setReloadKey(k => k + 1);
  }

  function reload() {
    setLoading(true);
    setLoadError('');
    refetch();
  }

  // create/edit/change-PIN all resolve to a fresh roster read (the RPCs return
  // ids/void, not full profile rows), then close the modal.
  function handleSaved() {
    setForm(null);
    setPinKid(null);
    refetch();
  }

  async function handleDelete(kid: KidProfile) {
    if (
      !window.confirm(
        `Delete ${kid.display_name}? This removes their account and all their data. This can't be undone.`,
      )
    ) {
      return;
    }
    setActionError('');
    setDeletingId(kid.id);
    const supabase = createClient();
    const { error } = await deleteKid(supabase, kid.id);
    if (error) {
      setActionError(error.message ?? 'Could not delete the kid. Please try again.');
      setDeletingId(null);
      return;
    }
    setKids(prev => prev.filter(k => k.id !== kid.id));
    setDeletingId(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[28px] font-extrabold leading-tight text-ink-900">Kids</h1>
        {!loading && !loadError && (
          <Button type="button" variant="primary" size="md" onClick={() => setForm('new')}>
            Add kid
          </Button>
        )}
      </div>

      <FamilyCodePanel />

      {actionError && <ErrorBanner>{actionError}</ErrorBanner>}

      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <Card className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="font-display text-lg font-extrabold text-ink-800">Something went wrong</p>
          <p className="max-w-sm font-sans text-base font-semibold text-ink-500">{loadError}</p>
          <Button type="button" variant="primary" size="md" onClick={reload}>
            Try again
          </Button>
        </Card>
      ) : kids.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 py-14 text-center">
          <div className="text-5xl" aria-hidden>
            🧒
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="font-display text-xl font-extrabold text-ink-800">No kids yet</p>
            <p className="max-w-sm font-sans text-base font-semibold text-ink-500">
              Add your first kid to set up their PIN and age mode.
            </p>
          </div>
          <Button type="button" variant="primary" size="md" onClick={() => setForm('new')}>
            Add your first kid
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {kids.map(kid => (
            <KidRow
              key={kid.id}
              kid={kid}
              onEdit={k => setForm(k)}
              onChangePin={k => setPinKid(k)}
              onDelete={handleDelete}
              deleting={deletingId === kid.id}
            />
          ))}
        </div>
      )}

      {form !== null && (
        <KidForm
          kid={form === 'new' ? null : form}
          onClose={() => setForm(null)}
          onSaved={handleSaved}
        />
      )}

      {pinKid && (
        <ChangePinModal kid={pinKid} onClose={() => setPinKid(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading kids">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-card bg-surface-card p-5 shadow-[0_4px_14px_rgba(32,36,58,0.07)]"
        >
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-ink-100" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-4 w-1/3 animate-pulse rounded-pill bg-ink-100" />
            <div className="h-3 w-1/4 animate-pulse rounded-pill bg-ink-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
