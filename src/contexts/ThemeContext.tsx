import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
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

  const setIcon = useCallback(async (newIcon: AppIcon) => {
    setIconState(newIcon);
    try {
      const { setAlternateAppIcon } = await import('expo-alternate-app-icons');
      if (newIcon === 'default') {
        await setAlternateAppIcon(null);
      } else {
        await setAlternateAppIcon(`icon-${newIcon}`);
      }
    } catch (e) {
      console.log('Alternate icons not supported in Expo Go');
    }
    const settings = await storage.getSettings();
    await storage.setSettings({ ...settings, iconePreferido: newIcon });
  }, []);

  const activeTheme = theme === 'auto' ? (systemColorScheme || 'dark') : theme;
  const colors = activeTheme === 'light' ? lightColors : darkColors;

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
