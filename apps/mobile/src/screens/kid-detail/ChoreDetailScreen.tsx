// Kid: Chore detail (canvas 09). Pushed from My chores. The chore's icon + title +
// reward, info rows (recurrence, who it's for), and the primary action — Claim a
// shared chore that's up for grabs, or Mark done one that's yours.
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import {
  claimChore,
  completeChore,
  getChore,
  type KidChore,
} from '@lootloop/client';
import { useKidSession } from '../../stores/kidSession';
import { useSizeClass } from '../../hooks/useSizeClass';
import { useShellNav, useShellParams } from '../../navigation/shellNav';
import { Button } from '../../components/ui/Button';
import { Icon, type IconName } from '../../components/ui/Icon';
import { CoinBadge } from '../../components/ui/money';
import tw from '../../lib/tw';
import { DetailHeader } from './DetailHeader';

const CHORE_ICONS = new Set(['bed', 'dog', 'utensils', 'book-open', 'book', 'trash-2', 'sparkles', 'list-todo']);
const iconFor = (icon: string | null): IconName =>
  icon && CHORE_ICONS.has(icon) ? (icon as IconName) : 'list-todo';

function recurrenceLabel(rule: string | null): string {
  if (!rule) return 'One-off chore';
  if (rule.includes('DAILY')) return 'Every day';
  if (rule.includes('WEEKLY')) return 'Every week';
  return 'Repeats';
}

function InfoRow({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View
      style={tw.style('flex-row items-center gap-3 rounded-lg bg-surface-card px-4 py-3.5', {
        shadowColor: 'rgba(32,36,58,1)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
      })}
    >
      <Icon name={icon} size={22} color="#A39CAD" />
      <Text style={tw`font-sans text-[15px] font-bold text-ink-700`}>{label}</Text>
    </View>
  );
}

export function ChoreDetailScreen() {
  const { client, profile } = useKidSession();
  const isRegular = useSizeClass() === 'regular';
  const nav = useShellNav();
  const chore = (useShellParams() as { chore: KidChore } | undefined)?.chore;
  const [recurrence, setRecurrence] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!client || !chore) return;
    void getChore(client, chore.chore_id).then(({ data }) => setRecurrence(data?.recurrence_rule ?? null));
  }, [client, chore]);

  if (!chore) {
    return (
      <View style={tw`flex-1 bg-surface-page`}>
        <DetailHeader title="Chore" />
      </View>
    );
  }

  const claimable = chore.assignment === 'shared' && chore.completion_id == null;
  const done = chore.status === 'approved';
  const pending = chore.status === 'pending';

  const act = async (action: typeof claimChore | typeof completeChore) => {
    if (!client || !profile || busy) return;
    setBusy(true);
    setError('');
    const { error: err } = await action(client, chore.instance_id, profile.id);
    setBusy(false);
    if (err) {
      setError("That didn't work — try again.");
      return;
    }
    nav.goBack();
  };

  return (
    <View style={tw`flex-1 bg-surface-page`}>
      <DetailHeader />
      <ScrollView contentContainerStyle={tw.style('gap-3 px-5 pb-6', isRegular ? 'mx-auto w-full max-w-[560px]' : '')}>
        <View style={tw`items-center gap-3 pb-1 pt-1`}>
          <View style={tw`h-24 w-24 items-center justify-center rounded-2xl bg-indigo-soft`}>
            <Icon name={iconFor(chore.icon)} size={48} color="#5B63E6" />
          </View>
          <Text style={tw`text-center font-display text-[28px] font-extrabold text-ink-900`}>{chore.title}</Text>
          <CoinBadge amount={chore.points} size="lg" tone="soft" />
        </View>

        <View style={tw`gap-2.5`}>
          {recurrence !== undefined ? <InfoRow icon="repeat" label={recurrenceLabel(recurrence)} /> : null}
          <InfoRow
            icon={chore.assignment === 'shared' ? 'users' : 'star'}
            label={chore.assignment === 'shared' ? 'Shared — anyone can do it' : 'Just for you'}
          />
        </View>

        {error ? (
          <View style={tw`rounded-md bg-danger-soft px-4 py-3`}>
            <Text style={tw`font-sans text-[14px] font-bold text-danger-ink`}>{error}</Text>
          </View>
        ) : null}

        <View style={tw`mt-2`}>
          {done ? (
            <View style={tw`flex-row items-center justify-center gap-2 rounded-pill bg-mint-soft py-4`}>
              <Icon name="circle-check-big" size={20} color="#0A6A46" />
              <Text style={tw`font-display text-[16px] font-extrabold text-mint-ink`}>All done!</Text>
            </View>
          ) : pending ? (
            <View style={tw`flex-row items-center justify-center gap-2 rounded-pill bg-coin-soft py-4`}>
              <Icon name="clock" size={20} color="#8A6400" />
              <Text style={tw`font-display text-[16px] font-extrabold text-coin-ink`}>Waiting for approval</Text>
            </View>
          ) : claimable ? (
            <Button variant="indigo" block size="lg" loading={busy} disabled={busy} onPress={() => void act(claimChore)}>
              Claim it
            </Button>
          ) : (
            <Button testID="chore-done" block size="lg" loading={busy} disabled={busy} onPress={() => void act(completeChore)}>
              Mark done
            </Button>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
