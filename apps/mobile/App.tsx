import { useEffect } from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { checkConnection } from '@lootloop/client';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './src/config/env';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F5F1" />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const { top, bottom } = useSafeAreaInsets();
  useEffect(() => {
    void checkConnection(SUPABASE_URL, SUPABASE_ANON_KEY, 'mobile');
  }, []);
  return (
    <View style={[styles.container, { paddingTop: top, paddingBottom: bottom }]}>
      <Text style={styles.emoji}>🪙</Text>
      <Text style={styles.heading}>Hello LootLoop</Text>
      <Text style={styles.sub}>Kid app — scaffold complete</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F5F1',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emoji: {
    fontSize: 64,
  },
  heading: {
    fontSize: 32,
    fontWeight: '800',
    color: '#211E27',
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 16,
    fontWeight: '600',
    color: '#756E80',
  },
});

export default App;
