// Family device-code panel (#15). Shows the family kid_code that kids type on
// their device to sign in, with a Regenerate action (inline-confirm — NO
// Alert.alert — because regenerating invalidates the previously shared code).
// Self-loading: fetches the code on mount and updates it after a regenerate.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { getFamilyCode, regenerateFamilyCode } from '@lootloop/client';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import tw from '../../lib/tw';

export function FamilyCodePanel() {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error: loadError } = await getFamilyCode(supabase);
      if (!active) return;
      setLoading(false);
      if (loadError) {
        setError('Couldn’t load the family code.');
        return;
      }
      setCode(data?.kid_code ?? null);
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleRegenerate = async () => {
    setRegenerating(true);
    setError('');
    const { data, error: regenError } = await regenerateFamilyCode(supabase);
    setRegenerating(false);
    setConfirming(false);
    if (regenError) {
      setError('Couldn’t regenerate the code. Try again.');
      return;
    }
    if (data) setCode(data);
  };

  return (
    <View
      style={tw.style('rounded-card bg-surface-card p-4', {
        shadowColor: 'rgba(32,36,58,1)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
      })}
    >
      <Text style={tw`font-display text-[16px] font-extrabold text-ink-900`}>Family device code</Text>
      <Text style={tw`mt-1 font-sans text-[13px] font-semibold text-ink-500`}>
        Kids type this code on their device to sign in.
      </Text>

      <View style={tw`mt-3 flex-row items-center justify-between gap-3`}>
        {loading ? (
          <ActivityIndicator color="#F4720E" />
        ) : (
          <View style={tw`rounded-pill bg-indigo-soft px-4 py-2`}>
            <Text
              accessibilityLabel={code ? `Family code ${code}` : 'No family code yet'}
              style={tw`font-display text-[20px] font-extrabold tracking-[2px] text-indigo-ink`}
            >
              {code ?? '——————'}
            </Text>
          </View>
        )}

        {!loading ? (
          confirming ? (
            <View style={tw`flex-row items-center gap-2`}>
              <Button
                size="sm"
                variant="ghost"
                disabled={regenerating}
                onPress={() => setConfirming(false)}
              >
                Keep
              </Button>
              <Button size="sm" loading={regenerating} onPress={handleRegenerate}>
                Regenerate
              </Button>
            </View>
          ) : (
            <Button size="sm" variant="ghost" onPress={() => setConfirming(true)}>
              Regenerate
            </Button>
          )
        ) : null}
      </View>

      {confirming ? (
        <Text style={tw`mt-2 font-sans text-[12px] font-semibold text-ink-500`}>
          This invalidates the current code — kids using the old one will need the new one.
        </Text>
      ) : null}

      {error ? (
        <Text style={tw`mt-2 font-sans text-[12px] font-semibold text-danger-ink`}>{error}</Text>
      ) : null}
    </View>
  );
}
