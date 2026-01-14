import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useCallback } from 'react';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ExpoSplashScreen from 'expo-splash-screen';
import './src/i18n'; // Initialize i18n
import RootNavigator from './src/navigation';
import { AuthProvider } from './src/context/AuthContext';
import { TimerProvider } from './src/context/TimerContext';
import { RoleProvider } from './src/context/RoleContext';
import { ActivityProvider } from './src/context/ActivityContext';
import { PermissionsProvider } from './src/context/PermissionsContext';
import SplashScreen from './src/screens/SplashScreen';

// Keep the native splash screen visible while we fetch resources
ExpoSplashScreen.preventAutoHideAsync();

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      setAppIsReady(true);
    }
  }, [fontsLoaded]);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      // Hide the native splash screen once our custom splash is ready
      await ExpoSplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  // Show custom Taskly splash screen
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} onLayout={onLayoutRootView} />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RoleProvider>
          <PermissionsProvider>
            <TimerProvider>
              <ActivityProvider>
                <RootNavigator />
              </ActivityProvider>
            </TimerProvider>
          </PermissionsProvider>
        </RoleProvider>
      </AuthProvider>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
