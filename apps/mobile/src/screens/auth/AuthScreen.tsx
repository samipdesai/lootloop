// Shared auth-screen skeleton (spec §5). One component tree; the container
// branches on size class only (spec §9):
//   compact (iPhone) -> flat, full-width, vertically-centered stack
//   regular (iPad)   -> centered floating Card (max 420) with more chrome.
// Fields / button / error are identical across both.
import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Card } from '../../components/ui/Card';
import { Logomark, Wordmark } from '../../components/ui/BrandMark';
import tw from '../../lib/tw';

interface AuthScreenProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  // Form-level error banner copy (already mapped via mapAuthError). Renders
  // above the children's submit button area when present.
  formError?: string;
  footer?: ReactNode;
}

function Brandmark({ large }: { large: boolean }) {
  // Logomark (loop + coin) over the wordmark. iPad gets larger chrome.
  return (
    <View style={tw`items-center gap-2`}>
      <Logomark size={large ? 64 : 52} />
      <Wordmark className={`text-ink-900 ${large ? 'text-[32px]' : 'text-[28px]'}`} />
    </View>
  );
}

export function FormError({ message }: { message: string }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={tw`flex-row items-center gap-2 rounded-md bg-danger-soft px-4 py-3`}
    >
      <Text style={tw`text-[14px]`}>⚠️</Text>
      <Text style={tw`flex-1 font-sans text-[14px] font-bold text-danger-ink`}>{message}</Text>
    </View>
  );
}

export function AuthScreen({ title, subtitle, children, formError, footer }: AuthScreenProps) {
  const sizeClass = useSizeClass();
  const insets = useSafeAreaInsets();
  const isRegular = sizeClass === 'regular';

  const body = (
    <View style={tw.style(isRegular ? 'w-full max-w-[420px] items-stretch gap-6' : 'w-full gap-5')}>
      <Brandmark large={isRegular} />
      <Card flat={!isRegular}>
        <View style={tw`gap-4`}>
          <View style={tw`gap-1`}>
            <Text
              style={tw.style('font-display font-extrabold text-ink-900', isRegular ? 'text-[32px]' : 'text-[26px]')}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text style={tw`font-sans text-[16px] font-semibold text-ink-500`}>{subtitle}</Text>
            ) : null}
          </View>
          {children}
          {formError ? <FormError message={formError} /> : null}
        </View>
      </Card>
      {footer ? <View style={tw`items-center`}>{footer}</View> : null}
    </View>
  );

  return (
    <View style={tw`flex-1 bg-surface-page`}>
      {/* Let iOS smoothly adjust the scroll content inset when the keyboard opens
          (automaticallyAdjustKeyboardInsets) instead of a KeyboardAvoidingView
          padding animation — the latter abruptly re-centered the justify-center
          content and visibly overlapped the header with the first field. */}
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
      >
        {body}
      </ScrollView>
    </View>
  );
}
