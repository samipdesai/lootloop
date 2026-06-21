import { useState } from 'react';
import { View } from 'react-native';
import {
  createFamilyAndParent,
  joinFamilyAsParent,
  signOut,
  mapAuthError,
} from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import { AuthScreen } from './AuthScreen';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Tabs } from '../../components/ui/Tabs';
import { GhostLink } from '../../components/ui/GhostLink';
import { validateDisplayName, validateFamilyName, validateInviteCode } from './validation';
import tw from '../../lib/tw';

type Path = 'create' | 'join';

// First confirmed login with no parent profile lands here (spec §5.3). On RPC
// success the profile now exists; the next auth/profile refresh routes the user
// into the parent shell. We trigger that refresh by re-reading the session.
export function OnboardingScreen() {
  const [path, setPath] = useState<Path>('create');
  const [displayName, setDisplayName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [touched, setTouched] = useState({ name: false, family: false, code: false });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const nameError = touched.name ? validateDisplayName(displayName) : undefined;
  const familyError = touched.family ? validateFamilyName(familyName) : undefined;
  const codeError = touched.code ? validateInviteCode(inviteCode) : undefined;

  const canSubmit =
    !validateDisplayName(displayName) &&
    (path === 'create' ? !validateFamilyName(familyName) : !validateInviteCode(inviteCode)) &&
    !submitting;

  const switchPath = (next: string) => {
    setPath(next as Path);
    setFormError('');
    // Clear the inactive path's validation; keep the shared "Your name".
    setTouched((s) => ({ ...s, family: false, code: false }));
  };

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setFormError('');
    const name = displayName.trim();
    const { error } =
      path === 'create'
        ? await createFamilyAndParent(supabase, familyName.trim(), name)
        : await joinFamilyAsParent(supabase, inviteCode.trim().toUpperCase(), name);
    if (error) {
      setSubmitting(false);
      setFormError(mapAuthError(error));
      return;
    }
    // Profile now exists — refresh the session so RootNavigator re-runs the
    // profile lookup and swaps to the parent shell.
    await supabase.auth.refreshSession();
  };

  return (
    <AuthScreen
      title="You're in! 🎉"
      subtitle="Create a family, or join one you've been invited to."
      formError={formError}
      footer={<GhostLink label="Log out" onPress={() => void signOut(supabase)} />}
    >
      <View style={tw`gap-4`}>
        <Tabs
          tabs={[
            { value: 'create', label: 'Create a family' },
            { value: 'join', label: 'Join a family' },
          ]}
          value={path}
          onChange={switchPath}
        />
        <Input
          label="Your name"
          placeholder="e.g. Mom, Dad, Sam"
          value={displayName}
          maxLength={30}
          onChangeText={(t) => {
            setDisplayName(t);
            if (formError) setFormError('');
          }}
          onBlur={() => setTouched((s) => ({ ...s, name: true }))}
          error={nameError}
          editable={!submitting}
        />
        {path === 'create' ? (
          <Input
            label="Family name"
            placeholder="The Desai Family"
            value={familyName}
            maxLength={40}
            onChangeText={(t) => {
              setFamilyName(t);
              if (formError) setFormError('');
            }}
            onBlur={() => setTouched((s) => ({ ...s, family: true }))}
            error={familyError}
            editable={!submitting}
          />
        ) : (
          <Input
            label="Invite code"
            placeholder="e.g. LOOT-7F3K"
            hint="Ask the parent who invited you for the code."
            value={inviteCode}
            onChangeText={(t) => {
              setInviteCode(t);
              if (formError) setFormError('');
            }}
            onBlur={() => setTouched((s) => ({ ...s, code: true }))}
            error={codeError}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!submitting}
          />
        )}
        <Button block loading={submitting} disabled={!canSubmit} onPress={onSubmit}>
          {path === 'create' ? 'Create family' : 'Join family'}
        </Button>
      </View>
    </AuthScreen>
  );
}
