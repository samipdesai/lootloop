/**
 * @format
 */

// Polyfill a spec-compliant URL (with working setters) before anything that
// constructs the Supabase client — RN's built-in URL has a getter-only
// `protocol`, which supabase-js assigns to. Must run first.
import 'react-native-url-polyfill/auto';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
