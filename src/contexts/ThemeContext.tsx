import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, useColorScheme } from 'react-native';
import { setAlternateAppIcon } from 'expo-alternate-app-icons';
import { storage } from '../services/storage';
import { AppTheme, AppIcon, darkColors, lightColors } from '../types';

export interface ThemeContextData {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => Promise<void>;
  icon: AppIcon;
  setIcon: (icon: AppIcon) => Promise<void>;
  colors: typeof darkColors;
}

export const ThemeContext = createContext<ThemeContextData>({} as ThemeContextData);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<AppTheme>('dark');
  const [icon, setIconState] = useState<AppIcon>('default');

  useEffect(() => {
    storage.getSettings().then((settings) => {
      if (settings.tema) {
        setThemeState(settings.tema);
      }
      if (settings.iconePreferido) {
        setIconState(settings.iconePreferido);
      }
    });
  }, []);

  const setTheme = useCallback(async (newTheme: AppTheme) => {
    setThemeState(newTheme);
    const settings = await storage.getSettings();
    await storage.setSettings({ ...settings, tema: newTheme });
  }, []);

  const activeTheme = theme === 'auto' ? (systemColorScheme || 'dark') : theme;
  const colors = activeTheme === 'light' ? lightColors : darkColors;

  const applyAlternateIcon = useCallback(async (iconPref: AppIcon, effectiveTheme: 'dark' | 'light') => {
    const resolved = iconPref === 'auto' ? effectiveTheme : iconPref;
    if (resolved === 'light') {
      await setAlternateAppIcon('icon-light');
    } else {
      // null resets to primary icon (CFBundlePrimaryIcon)
      await setAlternateAppIcon(null);
    }
  }, []);

  const setIcon = useCallback(async (newIcon: AppIcon) => {
    setIconState(newIcon);
    // Persist preference first — icon change is best-effort
    const settings = await storage.getSettings();
    await storage.setSettings({ ...settings, iconePreferido: newIcon });
    // Apply to OS — only works in native builds, fails silently elsewhere
    applyAlternateIcon(newIcon, activeTheme).catch((e: any) => {
      Alert.alert('Erro troca de ícone [DEBUG]', e?.message ?? String(e));
    });
  }, [applyAlternateIcon, activeTheme]);

  useEffect(() => {
    if (icon === 'auto') {
      applyAlternateIcon('auto', activeTheme);
    }
  }, [activeTheme, icon, applyAlternateIcon]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      icon,
      setIcon,
      colors,
    }),
    [theme, colors, setTheme, icon, setIcon]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
