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

export default App;
