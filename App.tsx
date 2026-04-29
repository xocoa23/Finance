import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { AppState, AppStateStatus, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

import { AuthContext, AuthState } from './src/hooks/useAuth';
import { auth as authService } from './src/services/auth';
import { storage } from './src/services/storage';
import { notifications } from './src/services/notifications';
import { SESSION_TIMEOUT_MS } from './src/types';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { useTheme } from './src/hooks/useTheme';

import { LockScreen } from './src/screens/LockScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { LancamentosScreen } from './src/screens/LancamentosScreen';
import { GastosScreen } from './src/screens/GastosScreen';
import { ParcelasScreen } from './src/screens/ParcelasScreen';
import { MetasScreen } from './src/screens/MetasScreen';
import { MaisScreen } from './src/screens/MaisScreen';

const Tab = createBottomTabNavigator();

type IoniconName = keyof typeof Ionicons.glyphMap;

interface TabIconProps {
  name: IoniconName;
  focused: boolean;
  color: string;
}

function TabIcon({ name, color }: TabIconProps) {
  return <Ionicons name={name} size={22} color={color} />;
}

function MainTabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.borderSoft,
          borderTopWidth: 0.5,
          height: 78,
          paddingBottom: 18,
          paddingTop: 10,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} color={color} />
          ),
          tabBarLabel: 'Início',
        }}
      />
      <Tab.Screen
        name="Lancamentos"
        component={LancamentosScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'swap-vertical' : 'swap-vertical-outline'} focused={focused} color={color} />
          ),
          tabBarLabel: 'Lançamentos',
        }}
      />
      <Tab.Screen
        name="Gastos"
        component={GastosScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'calendar' : 'calendar-outline'} focused={focused} color={color} />
          ),
          tabBarLabel: 'Gastos',
        }}
      />
      <Tab.Screen
        name="Parcelas"
        component={ParcelasScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'card' : 'card-outline'} focused={focused} color={color} />
          ),
          tabBarLabel: 'Parcelas',
        }}
      />
      <Tab.Screen
        name="Metas"
        component={MetasScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'trophy' : 'trophy-outline'} focused={focused} color={color} />
          ),
          tabBarLabel: 'Metas',
        }}
      />
      <Tab.Screen
        name="Mais"
        component={MaisScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              name={focused ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal-circle-outline'}
              focused={focused} color={color}
            />
          ),
          tabBarLabel: 'Mais',
        }}
      />
    </Tab.Navigator>
  );
}

function AuthProviderWrap({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>('loading');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometria');
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const lastBackgroundedAt = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const [hasBio, label, settings, pinSet] = await Promise.all([
      authService.hasBiometricSupport(),
      authService.getBiometricLabel(),
      storage.getSettings(),
      authService.isPinSet(),
    ]);
    setBiometricAvailable(hasBio);
    setBiometricLabel(label);
    setBiometricEnabled(settings.biometriaAtiva && hasBio);
    setState((curr) => {
      if (!pinSet) return 'setup';
      if (curr === 'unlocked') return 'unlocked';
      return 'locked';
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    notifications.requestPermissions().catch(() => {});
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        lastBackgroundedAt.current = Date.now();
      } else if (next === 'active') {
        if (state === 'unlocked' && lastBackgroundedAt.current) {
          const elapsed = Date.now() - lastBackgroundedAt.current;
          if (elapsed >= SESSION_TIMEOUT_MS) {
            setState('locked');
          }
        }
        lastBackgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, [state]);

  const unlockWithPin = useCallback(async (pin: string) => {
    const ok = await authService.checkPin(pin);
    if (ok) setState('unlocked');
    return ok;
  }, []);

  const unlockWithBiometric = useCallback(async () => {
    const ok = await authService.authenticateBiometric();
    if (ok) setState('unlocked');
    return ok;
  }, []);

  const setupPin = useCallback(
    async (pin: string, enableBio: boolean) => {
      await authService.setPin(pin);
      const settings = await storage.getSettings();
      await storage.setSettings({
        ...settings,
        biometriaAtiva: enableBio && biometricAvailable,
        primeiraAbertura: false,
      });
      setBiometricEnabled(enableBio && biometricAvailable);
      setState('unlocked');
    },
    [biometricAvailable],
  );

  const changePin = useCallback(async (_currentPin: string, newPin: string) => {
    await authService.setPin(newPin);
    return true;
  }, []);

  const setBiometricEnabledFn = useCallback(async (val: boolean) => {
    await authService.setBiometricEnabled(val);
    setBiometricEnabled(val);
  }, []);

  const lock = useCallback(() => {
    setState('locked');
  }, []);

  const value = {
    state, biometricAvailable, biometricLabel, biometricEnabled,
    unlockWithPin, unlockWithBiometric, setupPin, changePin,
    setBiometricEnabled: setBiometricEnabledFn, lock, refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function RootContent() {
  const ctx = React.useContext(AuthContext);
  const { colors, theme } = useTheme();

  const navTheme = useMemo(() => ({
    ...DefaultTheme,
    dark: theme === 'dark' || (theme === 'auto' && colors.background === '#0a0a0b'),
    colors: {
      ...DefaultTheme.colors,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
      notification: colors.primary,
    },
  }), [colors, theme]);

  const styles = useMemo(() => StyleSheet.create({
    loading: {
      flex: 1, backgroundColor: colors.background,
      alignItems: 'center', justifyContent: 'center',
    },
    loadingLogo: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: colors.primarySoft,
      alignItems: 'center', justifyContent: 'center',
    },
  }), [colors]);

  if (!ctx || ctx.state === 'loading') {
    return (
      <View style={styles.loading}>
        <View style={styles.loadingLogo}>
          <Ionicons name="wallet" size={36} color={colors.primary} />
        </View>
      </View>
    );
  }

  if (ctx.state === 'unlocked') {
    return (
      <NavigationContainer theme={navTheme}>
        <MainTabs />
      </NavigationContainer>
    );
  }

  return <LockScreen />;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <StatusBar style="auto" />
          <AuthProviderWrap>
            <RootContent />
          </AuthProviderWrap>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
