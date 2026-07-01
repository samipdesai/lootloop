'use client';

import { useEffect, useState } from 'react';
import {
  listParents,
  listPendingInvites,
  revokeInvite,
  createFamilyInvite,
  type Parent,
  type PendingInvite,
} from '@lootloop/client';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

// A co-parent joins by signing up and entering an invite code on the "Join a
// family" onboarding step. This screen mints those codes, shows who's in the
// family, and lets a parent revoke a code they haven't handed out yet.
export function FamilyClient() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [myAuthId, setMyAuthId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const [parentsRes, invitesRes, { data: user }] = await Promise.all([
        listParents(supabase),
        listPendingInvites(supabase),
        supabase.auth.getUser(),
      ]);
      if (cancelled) return;
      if (parentsRes.error) {
        setLoadError(parentsRes.error.message ?? 'Could not load your family. Please try again.');
        setLoading(false);
        return;
      }
      setParents(parentsRes.data ?? []);
      setInvites(invitesRes.data ?? []);
      setMyAuthId(user.user?.id ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function reload() {
    setLoading(true);
    setLoadError('');
    setReloadKey(k => k + 1);
  }

  if (loading) {
    return <LoadingState />;
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-6">
        <Header />
        <Card className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="font-display text-lg font-extrabold text-ink-800">Something went wrong</p>
          <p className="max-w-sm font-sans text-base font-semibold text-ink-500">{loadError}</p>
          <Button type="button" variant="primary" size="md" onClick={reload}>
            Try again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Header />
      <ParentsCard parents={parents} myAuthId={myAuthId} />
      <InviteCard invites={invites} onChanged={() => setReloadKey(k => k + 1)} />
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between gap-3">
      <h1 className="font-display text-[28px] font-extrabold leading-tight text-ink-900">Family</h1>
    </div>
  );
}

function ParentsCard({ parents, myAuthId }: { parents: Parent[]; myAuthId: string | null }) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-extrabold text-ink-900">Parents</h2>
        <p className="font-sans text-sm font-semibold text-ink-500">
          Everyone here can manage chores, rewards, and approvals.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {parents.map(parent => {
          const initial = parent.display_name.trim().charAt(0).toUpperCase() || '?';
          const isYou = myAuthId != null && parent.auth_user_id === myAuthId;
          return (
            <li
              key={parent.id}
              className="flex items-center gap-3 rounded-card bg-surface-page p-3"
            >
              {parent.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={parent.avatar_url}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-soft font-display text-base font-extrabold text-indigo-ink"
                >
                  {initial}
                </span>
              )}
              <span className="truncate font-display text-[15px] font-extrabold text-ink-900">
                {parent.display_name}
              </span>
              {isYou && (
                <span className="rounded-pill bg-indigo-soft px-2.5 py-0.5 font-display text-[13px] font-bold text-indigo-ink">
                  You
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function InviteCard({ invites, onChanged }: { invites: PendingInvite[]; onChanged: () => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function handleGenerate() {
    setError('');
    setGenerating(true);
    const supabase = createClient();
    const { data, error: err } = await createFamilyInvite(supabase);
    if (err || !data) {
      setError(err?.message ?? 'Could not create an invite. Please try again.');
      setGenerating(false);
      return;
    }
    setCode(data);
    setCopied(false);
    setGenerating(false);
    onChanged();
  }

  async function handleCopy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy the code. Select it and copy manually.');
    }
  }

  async function handleRevoke(invite: PendingInvite) {
    if (
      !window.confirm(
        'Revoke this invite? The code stops working immediately — you can generate a new one anytime.',
      )
    ) {
      return;
    }
    setError('');
    setRevokingId(invite.id);
    const supabase = createClient();
    const { error: err } = await revokeInvite(supabase, invite.id);
    if (err) {
      setError(err.message ?? 'Could not revoke the invite. Please try again.');
      setRevokingId(null);
      return;
    }
    if (code === invite.code) setCode(null);
    setRevokingId(null);
    onChanged();
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-extrabold text-ink-900">Invite a co-parent</h2>
        <p className="font-sans text-sm font-semibold text-ink-500">
          Share a code with another parent. They enter it when they sign up to join your family.
          Codes are single-use and expire in 7 days.
        </p>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {code && (
        <div className="flex flex-col gap-3 rounded-card bg-surface-page p-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="select-all font-display text-3xl font-extrabold tracking-[0.2em] text-orange-strong">
            {code}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={() => handleCopy(code)}>
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      )}

      <Button
        type="button"
        variant="primary"
        size="md"
        onClick={handleGenerate}
        loading={generating}
      >
        {invites.length > 0 || code ? 'Generate another code' : 'Invite a co-parent'}
      </Button>

      {invites.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-sans text-sm font-extrabold uppercase tracking-wide text-ink-400">
            Pending invites
          </h3>
          <ul className="flex flex-col gap-2">
            {invites.map(invite => (
              <li
                key={invite.id}
                className="flex items-center justify-between gap-3 rounded-card bg-surface-page p-3"
              >
                <span className="select-all font-display text-lg font-extrabold tracking-[0.15em] text-ink-900">
                  {invite.code}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevoke(invite)}
                  loading={revokingId === invite.id}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading family">
      <div className="h-8 w-40 animate-pulse rounded-pill bg-ink-100" />
      {[0, 1].map(i => (
        <div
          key={i}
          className="flex flex-col gap-4 rounded-card bg-surface-card p-6 shadow-[0_4px_14px_rgba(32,36,58,0.07)]"
        >
          <div className="h-5 w-1/3 animate-pulse rounded-pill bg-ink-100" />
          <div className="h-12 w-full animate-pulse rounded-card bg-ink-100" />
        </div>
      ))}
    </div>
  );
}
