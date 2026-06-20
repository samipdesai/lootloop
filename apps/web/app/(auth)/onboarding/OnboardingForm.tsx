'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createFamilyAndParent, joinFamilyAsParent, signOut, mapAuthError } from '@lootloop/client';
import { createClient } from '@/lib/supabase/client';
import { validateDisplayName, validateFamilyName, validateInviteCode } from '@/lib/auth/validation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

type Path = 'create' | 'join';

export function OnboardingForm() {
  const router = useRouter();
  const [path, setPath] = useState<Path>('create');

  // Shared field (preserved across path switches).
  const [name, setName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const [nameErr, setNameErr] = useState('');
  const [familyErr, setFamilyErr] = useState('');
  const [codeErr, setCodeErr] = useState('');

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const familyRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  function switchPath(next: string) {
    const p = next as Path;
    if (p === path) return;
    setPath(p);
    setFormError('');
    // Clear inactive path's errors; keep shared name.
    setFamilyErr('');
    setCodeErr('');
    // Move focus to the first path-specific field.
    setTimeout(() => (p === 'create' ? familyRef.current : codeRef.current)?.focus(), 0);
  }

  const canSubmit =
    !validateDisplayName(name) &&
    (path === 'create' ? !validateFamilyName(familyName) : !validateInviteCode(inviteCode)) &&
    !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nErr = validateDisplayName(name);
    setNameErr(nErr);
    let pathErr = '';
    if (path === 'create') {
      pathErr = validateFamilyName(familyName);
      setFamilyErr(pathErr);
    } else {
      pathErr = validateInviteCode(inviteCode);
      setCodeErr(pathErr);
    }
    if (nErr || pathErr) return;

    setSubmitting(true);
    setFormError('');
    const supabase = createClient();
    const displayName = name.trim();

    const { error } =
      path === 'create'
        ? await createFamilyAndParent(supabase, familyName.trim(), displayName)
        : await joinFamilyAsParent(supabase, inviteCode.trim().toUpperCase(), displayName);

    if (error) {
      setFormError(mapAuthError(error));
      setSubmitting(false);
      return;
    }
    router.replace('/');
    router.refresh();
  }

  async function logout() {
    const supabase = createClient();
    await signOut(supabase);
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[26px] font-extrabold leading-tight text-ink-900">
            You&apos;re in! 🎉
          </h1>
          <p className="font-sans text-base font-semibold text-ink-500">
            Create a family, or join one you&apos;ve been invited to.
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="shrink-0 font-sans text-[13px] font-bold text-indigo-strong hover:underline"
        >
          Log out
        </button>
      </div>

      <SegmentedTabs
        tabs={[
          { value: 'create', label: 'Create a family' },
          { value: 'join', label: 'Join a family' },
        ]}
        value={path}
        onChange={switchPath}
      />

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Your name"
          placeholder="e.g. Mom, Dad, Sam"
          maxLength={30}
          value={name}
          disabled={submitting}
          error={nameErr}
          onChange={e => {
            setName(e.target.value);
            if (nameErr) setNameErr(validateDisplayName(e.target.value));
          }}
          onBlur={() => setNameErr(validateDisplayName(name))}
        />

        {path === 'create' ? (
          <Input
            ref={familyRef}
            label="Family name"
            placeholder="The Desai Family"
            maxLength={40}
            value={familyName}
            disabled={submitting}
            error={familyErr}
            onChange={e => {
              setFamilyName(e.target.value);
              if (familyErr) setFamilyErr(validateFamilyName(e.target.value));
            }}
            onBlur={() => setFamilyErr(validateFamilyName(familyName))}
          />
        ) : (
          <Input
            ref={codeRef}
            label="Invite code"
            placeholder="e.g. LOOT-7F3K"
            autoCapitalize="characters"
            autoCorrect="off"
            hint="Ask the parent who invited you for the code."
            value={inviteCode}
            disabled={submitting}
            error={codeErr}
            onChange={e => {
              setInviteCode(e.target.value);
              if (codeErr) setCodeErr(validateInviteCode(e.target.value));
            }}
            onBlur={() => setCodeErr(validateInviteCode(inviteCode))}
          />
        )}

        {formError && <ErrorBanner>{formError}</ErrorBanner>}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          disabled={!canSubmit}
          loading={submitting}
        >
          {path === 'create' ? 'Create family' : 'Join family'}
        </Button>
      </form>
    </div>
  );
}
