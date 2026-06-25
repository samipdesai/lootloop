import * as Sentry from '@sentry/react-native';
import { enableScreens } from 'react-native-screens';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from './src/stores/session';
import { KidSessionProvider } from './src/stores/kidSession';
import { RootNavigator } from './src/navigation/RootNavigator';

// react-navigation perf: back native screen containers.
enableScreens();

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F5F1" />
      <SessionProvider>
        <KidSessionProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </KidSessionProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

// Sentry.wrap adds the crash error-boundary + touch/navigation breadcrumbs
// (task #61). Inert until initSentry() runs with a DSN (index.js / release only).
export default Sentry.wrap(App);
