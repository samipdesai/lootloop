// Co-parent management panel (parent Settings → Co-parents). Shows the family's
// parents, mints single-use invite codes a co-parent redeems on the "Join a
// family" onboarding step, and lists / revokes pending invites. Mirrors
// FamilyCodePanel: self-loading card, inline errors, NO Alert.alert (revoke uses
// an inline confirm). The code is `selectable` so a parent can long-press to copy
// (no clipboard native module — matches the rest of the mobile app).
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import {
  listParents,
  listPendingInvites,
  revokeInvite,
  createFamilyInvite,
  type Parent,
  type PendingInvite,
} from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import tw from '../../lib/tw';

const cardShadow = {
  shadowColor: 'rgba(32,36,58,1)',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
} as const;

export function CoParentsPanel() {
  const [parents, setParents] = useState<Parent[] | null>(null);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [myAuthId, setMyAuthId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [code, setCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = async () => {
    setError('');
    const [parentsRes, invitesRes, userRes] = await Promise.all([
      listParents(supabase),
      listPendingInvites(supabase),
      supabase.auth.getUser(),
    ]);
    if (parentsRes.error) {
      setError('Couldn’t load your family. Try again.');
      setParents([]);
      return;
    }
    setParents(parentsRes.data ?? []);
    setInvites(invitesRes.data ?? []);
    setMyAuthId(userRes.data.user?.id ?? null);
  };

  useEffect(() => {
    void load();
     
  }, []);

  const handleGenerate = async () => {
    setError('');
    setGenerating(true);
    const { data, error: genError } = await createFamilyInvite(supabase);
    setGenerating(false);
    if (genError || !data) {
      setError('Couldn’t create an invite. Try again.');
      return;
    }
    setCode(data);
    await load();
  };

  const handleRevoke = async (invite: PendingInvite) => {
    setError('');
    setRevokingId(invite.id);
    const { error: revokeError } = await revokeInvite(supabase, invite.id);
    setRevokingId(null);
    setConfirmId(null);
    if (revokeError) {
      setError('Couldn’t revoke the invite. Try again.');
      return;
    }
    if (code === invite.code) setCode(null);
    await load();
  };

  if (parents === null) {
    return (
      <View style={tw`items-center py-10`}>
        <ActivityIndicator color="#F4720E" />
      </View>
    );
  }

  return (
    <View style={tw`gap-4`}>
      {/* Parents roster */}
      <View style={tw.style('rounded-card bg-surface-card p-4', cardShadow)}>
        <Text style={tw`font-display text-[16px] font-extrabold text-ink-900`}>Parents</Text>
        <Text style={tw`mt-1 font-sans text-[13px] font-semibold text-ink-500`}>
          Everyone here can manage chores, rewards, and approvals.
        </Text>
        <View style={tw`mt-3 gap-2`}>
          {parents.map((parent) => (
            <View key={parent.id} style={tw`flex-row items-center gap-3 rounded-md bg-surface-page px-3 py-2.5`}>
              <Avatar name={parent.display_name} src={parent.avatar_url} size={36} />
              <Text style={tw`flex-1 font-display text-[15px] font-extrabold text-ink-900`} numberOfLines={1}>
                {parent.display_name}
              </Text>
              {myAuthId != null && parent.auth_user_id === myAuthId ? (
                <View style={tw`rounded-pill bg-indigo-soft px-2.5 py-0.5`}>
                  <Text style={tw`font-display text-[12px] font-bold text-indigo-ink`}>You</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </View>

      {/* Invite a co-parent */}
      <View style={tw.style('rounded-card bg-surface-card p-4', cardShadow)}>
        <Text style={tw`font-display text-[16px] font-extrabold text-ink-900`}>Invite a co-parent</Text>
        <Text style={tw`mt-1 font-sans text-[13px] font-semibold text-ink-500`}>
          Share a code with another parent. They enter it when they sign up. Codes are single-use and
          expire in 7 days.
        </Text>

        {code ? (
          <View style={tw`mt-3 items-center rounded-md bg-indigo-soft px-4 py-3`}>
            <Text
              selectable
              accessibilityLabel={`Invite code ${code}`}
              style={tw`font-display text-[24px] font-extrabold tracking-[3px] text-indigo-ink`}
            >
              {code}
            </Text>
            <Text style={tw`mt-1 font-sans text-[12px] font-semibold text-ink-500`}>
              Long-press to copy.
            </Text>
          </View>
        ) : null}

        <View style={tw`mt-3`}>
          <Button size="lg" loading={generating} onPress={handleGenerate}>
            {invites.length > 0 || code ? 'Generate another code' : 'Invite a co-parent'}
          </Button>
        </View>

        {error ? (
          <Text style={tw`mt-2 font-sans text-[12px] font-semibold text-danger-ink`}>{error}</Text>
        ) : null}
      </View>

      {/* Pending invites */}
      {invites.length > 0 ? (
        <View style={tw.style('rounded-card bg-surface-card p-4', cardShadow)}>
          <Text style={tw`font-sans text-[13px] font-extrabold uppercase tracking-wide text-ink-400`}>
            Pending invites
          </Text>
          <View style={tw`mt-3 gap-2`}>
            {invites.map((invite) => (
              <View
                key={invite.id}
                style={tw`flex-row items-center justify-between gap-3 rounded-md bg-surface-page px-3 py-2.5`}
              >
                <Text
                  selectable
                  style={tw`font-display text-[18px] font-extrabold tracking-[2px] text-ink-900`}
                >
                  {invite.code}
                </Text>
                {confirmId === invite.id ? (
                  <View style={tw`flex-row items-center gap-2`}>
                    <Button size="sm" variant="ghost" disabled={revokingId === invite.id} onPress={() => setConfirmId(null)}>
                      Keep
                    </Button>
                    <Button size="sm" loading={revokingId === invite.id} onPress={() => handleRevoke(invite)}>
                      Revoke
                    </Button>
                  </View>
                ) : (
                  <Button size="sm" variant="ghost" onPress={() => setConfirmId(invite.id)}>
                    Revoke
                  </Button>
                )}
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
