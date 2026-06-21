// White rounded surface with the --shadow-md elevation. Mirrors
// design/components/core/Card.jsx. `flat` drops the bg + shadow so fields sit
// directly on the page (iPhone auth feel, spec §9).
import type { ReactNode } from 'react';
import { View } from 'react-native';

interface CardProps {
  children: ReactNode;
  flat?: boolean;
}

export function Card({ children, flat = false }: CardProps) {
  if (flat) {
    return <View className="w-full">{children}</View>;
  }
  return (
    <View
      className="w-full rounded-card bg-surface-card p-6"
      style={{
        shadowColor: 'rgba(32,36,58,1)',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 6,
      }}
    >
      {children}
    </View>
  );
}
