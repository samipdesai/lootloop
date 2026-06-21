// Kid login step 2 (#9-client): "Who's here?" — the kid taps their own profile
// from the family roster resolved in step 1. Tapping moves to the PIN screen.
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { KidRosterEntry } from '@lootloop/client';
import type { AuthStackParamList } from '../../navigation/types';
import { useSizeClass } from '../../hooks/useSizeClass';
import tw from '../../lib/tw';

type Props = NativeStackScreenProps<AuthStackParamList, 'KidRoster'>;

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

export function KidRosterScreen({ navigation, route }: Props) {
  const { roster } = route.params;
  const insets = useSafeAreaInsets();
  const isRegular = useSizeClass() === 'regular';

  const onPick = (kid: KidRosterEntry) => {
    navigation.navigate('KidPin', {
      familyId: roster.family_id,
      profileId: kid.profile_id,
      displayName: kid.display_name,
    });
  };

  return (
    <ScrollView
      style={tw`flex-1 bg-surface-page`}
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: insets.top + 32,
        paddingBottom: insets.bottom + 24,
      }}
    >
      <View style={tw.style('w-full gap-6', isRegular ? 'max-w-[560px]' : '')}>
        <View style={tw`items-center gap-1`}>
          <Text style={tw`font-display text-[26px] font-extrabold text-ink-900`}>Who's here?</Text>
          <Text style={tw`font-sans text-[16px] font-semibold text-ink-500`}>
            {roster.family_name}
          </Text>
        </View>

        {roster.kids.length === 0 ? (
          <View style={tw`items-center gap-2 rounded-lg bg-surface-card px-6 py-10`}>
            <Text style={tw`text-[40px]`}>🧒</Text>
            <Text style={tw`text-center font-sans text-[15px] font-semibold text-ink-500`}>
              No kids in this family yet. Ask a grown-up to add you in their Kids screen.
            </Text>
          </View>
        ) : (
          <View style={tw`flex-row flex-wrap justify-center gap-3`}>
            {roster.kids.map((kid) => (
              <Pressable
                key={kid.profile_id}
                accessibilityRole="button"
                accessibilityLabel={`Sign in as ${kid.display_name}`}
                onPress={() => onPick(kid)}
                style={tw`w-[136px] items-center gap-3 rounded-xl bg-surface-card px-4 py-6`}
              >
                <View
                  style={tw`h-16 w-16 items-center justify-center rounded-full bg-indigo-soft`}
                >
                  <Text style={tw`font-display text-[26px] font-extrabold text-indigo-strong`}>
                    {initial(kid.display_name)}
                  </Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={tw`max-w-full font-display text-[16px] font-extrabold text-ink-900`}
                >
                  {kid.display_name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={tw`items-center py-2`}
        >
          <Text style={tw`font-sans text-[14px] font-bold text-orange-strong`}>
            Use a different code
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
