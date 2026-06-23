'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { leaveFamily, deleteFamily, signOut } from '@lootloop/client';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Modal } from '../../kids/_components/Modal';

interface DangerZoneProps {
  familyName: string;
  kidCount: number;
}

type ModalState = null | 'leave' | 'delete';

// The Edge Function returns 403 { error: "last_parent" } when the only parent
// tries to leave. With functions.invoke, a non-2xx surfaces as a
// FunctionsHttpError whose `.context` is the raw Response; we read its body to
// detect that case and show "delete the family instead".
async function isLastParentError(error: unknown): Promise<boolean> {
  const context = (error as { context?: unknown } | null)?.context;
  if (!(context instanceof Response)) return false;
  try {
    const body = (await context.clone().json()) as { error?: string };
    return body.error === 'last_parent';
  } catch {
    return false;
  }
}

// Parent-facing Danger Zone (task #52): leave a co-parented family, or hard-
// delete the entire family. Both call the @lootloop/client account service
// (Edge Function); on success the caller's auth user is gone, so we sign out
// and route to /login (same helper LogoutButton uses). Delete is gated behind
// a type-to-confirm input that must match the family name exactly.
export function DangerZone({ familyName, kidCount }: DangerZoneProps) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmText, setConfirmText] = useState('');

  function openModal(which: Exclude<ModalState, null>) {
    setError('');
    setConfirmText('');
    setModal(which);
  }

  function closeModal() {
    if (busy) return;
    setModal(null);
    setError('');
    setConfirmText('');
  }

  // After either action succeeds the parent's session points at a deleted
  // user — sign out (clears the cookie) and send them to /login.
  async function signOutAndLeave() {
    const supabase = createClient();
    await signOut(supabase);
    router.replace('/login');
    router.refresh();
  }

  async function onLeave() {
    if (busy) return;
    setBusy(true);
    setError('');
    const supabase = createClient();
    const { error: fnError } = await leaveFamily(supabase);
    if (fnError) {
      if (await isLastParentError(fnError)) {
        setError("You're the only parent — delete the family instead.");
      } else {
        setError(fnError.message ?? 'Could not leave the family. Please try again.');
      }
      setBusy(false);
      return;
    }
    await signOutAndLeave();
  }

  async function onDelete() {
    if (busy) return;
    setBusy(true);
    setError('');
    const supabase = createClient();
    const { error: fnError } = await deleteFamily(supabase);
    if (fnError) {
      setError(fnError.message ?? 'Could not delete the family. Please try again.');
      setBusy(false);
      return;
    }
    await signOutAndLeave();
  }

  const confirmMatches = confirmText.trim() === familyName.trim();
  const kidNoun = kidCount === 1 ? 'kid' : 'kids';

  return (
    <section className="flex flex-col gap-4 rounded-card border border-danger-soft bg-danger-soft/30 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-[18px] font-extrabold leading-tight text-danger-ink">
          Danger zone
        </h2>
        <p className="font-sans text-[14px] text-ink-600">
          These actions are permanent and cannot be undone.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Leave family — for co-parents */}
        <div className="flex flex-col gap-3 rounded-md border border-border bg-surface-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-display text-[15px] font-bold text-ink-900">Leave family</span>
            <span className="font-sans text-[13px] text-ink-500">
              Remove only your account. Other parents keep the family.
            </span>
          </div>
          <Button variant="ghost" onClick={() => openModal('leave')} className="shrink-0">
            Leave family
          </Button>
        </div>

        {/* Delete family — destructive */}
        <div className="flex flex-col gap-3 rounded-md border border-danger-soft bg-surface-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-display text-[15px] font-bold text-danger-ink">
              Delete family
            </span>
            <span className="font-sans text-[13px] text-ink-500">
              Permanently deletes the family and everything in it.
            </span>
          </div>
          <button
            type="button"
            onClick={() => openModal('delete')}
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-pill bg-danger px-[22px] font-display text-base font-bold leading-none text-white shadow-[0_4px_0_var(--color-danger-ink)] transition-[transform,box-shadow] hover:brightness-95 active:translate-y-[2px] active:shadow-[0_2px_0_var(--color-danger-ink)]"
          >
            Delete family
          </button>
        </div>
      </div>

      {modal === 'leave' && (
        <Modal title="Leave family?" onClose={closeModal} busy={busy}>
          <div className="flex flex-col gap-5 px-6 py-5">
            <p className="font-sans text-[15px] text-ink-700">
              This removes your account from{' '}
              <span className="font-bold text-ink-900">{familyName}</span>. The family and the other
              parents are unaffected. You&apos;ll be signed out.
            </p>
            {error && <ErrorBanner>{error}</ErrorBanner>}
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={closeModal} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={onLeave} loading={busy}>
                Leave family
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {modal === 'delete' && (
        <Modal title="Delete family?" onClose={closeModal} busy={busy}>
          <div className="flex flex-col gap-5 px-6 py-5">
            <p className="font-sans text-[15px] text-ink-700">
              This permanently deletes all kids, chores, rewards, and history for{' '}
              <span className="font-bold text-ink-900">
                {kidCount} {kidNoun}
              </span>
              . This cannot be undone.
            </p>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="confirm-family-name"
                className="font-display text-[13px] font-bold text-ink-700"
              >
                Type <span className="text-danger-ink">{familyName}</span> to confirm
              </label>
              <input
                id="confirm-family-name"
                type="text"
                autoComplete="off"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                disabled={busy}
                className="h-12 rounded-md border border-border bg-surface-page px-4 font-sans text-[15px] text-ink-900 outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:opacity-60"
              />
            </div>
            {error && <ErrorBanner>{error}</ErrorBanner>}
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={closeModal} disabled={busy}>
                Cancel
              </Button>
              <button
                type="button"
                onClick={onDelete}
                disabled={!confirmMatches || busy}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-pill px-[22px] font-display text-base font-bold leading-none text-white transition-[transform,box-shadow] disabled:cursor-not-allowed disabled:bg-ink-200 disabled:text-ink-400 disabled:shadow-none [&:not(:disabled)]:bg-danger [&:not(:disabled)]:shadow-[0_4px_0_var(--color-danger-ink)] [&:not(:disabled)]:hover:brightness-95 [&:not(:disabled)]:active:translate-y-[2px] [&:not(:disabled)]:active:shadow-[0_2px_0_var(--color-danger-ink)]"
              >
                {busy && (
                  <span
                    aria-hidden
                    className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  />
                )}
                Delete everything
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
