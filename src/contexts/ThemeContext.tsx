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

  const activeTheme = theme === 'auto' ? (systemColorScheme || 'dark') : theme;
  const colors = activeTheme === 'light' ? lightColors : darkColors;

  const applyAlternateIcon = useCallback(async (iconPref: AppIcon, effectiveTheme: 'dark' | 'light') => {
    try {
      const AlternateIcons = await import('expo-alternate-app-icons');
      // Some versions export setAlternateAppIcon directly, others as a property of default
      const setter = AlternateIcons.setAlternateAppIcon || (AlternateIcons as any).default?.setAlternateAppIcon;
      
      if (typeof setter !== 'function') return;

      const resolved = iconPref === 'auto' ? effectiveTheme : (iconPref === 'light' ? 'light' : 'default');
      
      if (resolved === 'light') {
        await setter('icon-light');
      } else {
        await setter(null);
      }
    } catch (e) {
      // Silently fail if not supported (e.g. Expo Go)
    }
  }, []);

  const setIcon = useCallback(async (newIcon: AppIcon) => {
    setIconState(newIcon);
    await applyAlternateIcon(newIcon, activeTheme);
    const settings = await storage.getSettings();
    await storage.setSettings({ ...settings, iconePreferido: newIcon });
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
