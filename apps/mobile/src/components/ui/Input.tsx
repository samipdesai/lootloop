// Rounded text field with label, hint/error caption, and an optional password
// show/hide toggle. Mirrors design/components/core/Input.jsx: 2px inset ring
// idle -> indigo on focus -> danger on error.
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import tw from '../../lib/tw';

interface InputProps extends Omit<TextInputProps, 'secureTextEntry'> {
  label?: string;
  hint?: string;
  error?: string;
  // When true, renders a password field with a Show/Hide toggle.
  password?: boolean;
}

export function Input({ label, hint, error, password = false, onFocus, onBlur, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const ringColor = error ? '#E5484D' : focused ? '#444CCB' : '#E6E2EA';

  return (
    <View style={tw`w-full gap-1.5`}>
      {label ? (
        <Text style={tw`font-sans text-[14px] font-bold text-ink-900`}>{label}</Text>
      ) : null}
      <View
        style={tw.style('h-12 flex-row items-center rounded-lg bg-surface-card px-4', {
          borderWidth: 2,
          borderColor: ringColor,
        })}
      >
        <TextInput
          style={tw`flex-1 font-sans text-[16px] font-semibold text-ink-900`}
          placeholderTextColor="#A39CAD"
          secureTextEntry={password && !revealed}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {password ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            hitSlop={8}
            onPress={() => setRevealed((v) => !v)}
          >
            <Text style={tw`font-sans text-[13px] font-bold text-indigo-strong`}>
              {revealed ? 'Hide' : 'Show'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {error || hint ? (
        <Text
          style={tw.style('font-sans text-[12px] font-semibold', error ? 'text-danger-ink' : 'text-ink-500')}
        >
          {error || hint}
        </Text>
      ) : null}
    </View>
  );
}
