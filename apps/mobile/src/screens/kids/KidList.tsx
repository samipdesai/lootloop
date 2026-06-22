// Kid roster (#15). Scrollable list of kid cards: avatar/initial, name, age-mode
// badge, and per-row Edit / Change PIN / Delete (inline confirm — no blocking
// Alert.alert). The family device-code panel rides in the list header. Loading /
// empty / error states are handled by the parent KidsScreen; this renders the
// populated roster + the New affordance. One component tree; the regular (iPad)
// size class centres the column and widens it.
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { KidProfile } from '@lootloop/client';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Icon } from '../../components/ui/Icon';
import tw from '../../lib/tw';
import { ageModeBadge } from './ageMode';
// (FamilyCodePanel moved to the Settings → Family code screen.)

interface KidListProps {
  kids: KidProfile[];
  onNew: () => void;
  onSelect: (kid: KidProfile) => void;
}

function Avatar({ kid }: { kid: KidProfile }) {
  const initial = kid.display_name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View style={tw`h-12 w-12 items-center justify-center rounded-pill bg-mint-soft`}>
      <Text style={tw`font-display text-[20px] font-extrabold text-mint-ink`}>{initial}</Text>
    </View>
  );
}

// Clean tappable roster card — tapping opens the per-kid actions sheet.
function KidRow({ kid, onSelect }: { kid: KidProfile; onSelect: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={kid.display_name}
      onPress={onSelect}
      style={tw.style('flex-row items-center gap-3 rounded-card bg-surface-card p-4', {
        shadowColor: 'rgba(32,36,58,1)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
      })}
    >
      <Avatar kid={kid} />
      <View style={tw`min-w-0 flex-1`}>
        <Text numberOfLines={1} style={tw`font-display text-[16px] font-extrabold text-ink-900`}>
          {kid.display_name}
        </Text>
        <View style={tw`mt-1.5 flex-row`}>
          <View style={tw`rounded-pill bg-indigo-soft px-2.5 py-1`}>
            <Text style={tw`font-sans text-[12px] font-extrabold text-indigo-ink`}>
              {ageModeBadge(kid.age_mode)}
            </Text>
          </View>
        </View>
      </View>
      <Icon name="chevron-right" size={22} color="#A39CAD" />
    </Pressable>
  );
}

export function KidList({ kids, onNew, onSelect }: KidListProps) {
  const isRegular = useSizeClass() === 'regular';
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const canBack = navigation.canGoBack();

  return (
    <FlatList
      data={kids}
      keyExtractor={(k) => k.id}
      style={tw`flex-1 bg-surface-page`}
      contentContainerStyle={tw.style(
        'gap-3 px-5 pb-10',
        isRegular ? 'mx-auto w-full max-w-[720px]' : null,
        { paddingTop: insets.top + 12 },
      )}
      ListHeaderComponent={
        <View style={tw`mb-1 gap-4`}>
          <View style={tw`flex-row items-center justify-between`}>
            <View style={tw`flex-row items-center gap-2`}>
              {canBack ? (
                <Pressable
                  testID="parent-back"
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  onPress={() => navigation.goBack()}
                  hitSlop={8}
                  style={tw`h-10 w-10 items-center justify-center rounded-full bg-surface-card`}
                >
                  <Icon name="chevron-left" size={22} color="#211E27" />
                </Pressable>
              ) : null}
              <View>
                <Text style={tw`font-sans text-[13px] font-extrabold uppercase tracking-wide text-[13px] text-indigo`}>
                  Parent
                </Text>
                <Text style={tw`font-display text-[26px] font-extrabold text-ink-900`}>Kids</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New kid"
              onPress={onNew}
              style={tw.style('h-10 w-10 items-center justify-center rounded-full bg-indigo', {
                shadowColor: '#444CCB',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 1,
                shadowRadius: 0,
                elevation: 4,
              })}
            >
              <Icon name="plus" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      }
      renderItem={({ item }) => <KidRow kid={item} onSelect={() => onSelect(item)} />}
    />
  );
}
