import { useCallback, useEffect, useState } from 'react';
import { storage, subscribe } from '../services/storage';
import { STORAGE_KEYS } from '../types';

export function useHideValues(): [boolean, () => Promise<void>] {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const settings = await storage.getSettings();
      if (alive) setHidden(settings.ocultarValores);
    };
    load();
    const unsub = subscribe(STORAGE_KEYS.SETTINGS, load);
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  const toggle = useCallback(async () => {
    const current = await storage.getSettings();
    await storage.setSettings({ ...current, ocultarValores: !current.ocultarValores });
  }, []);

  return [hidden, toggle];
}

export function maskCurrency(value: number, hidden: boolean, format: (v: number) => string): string {
  if (!hidden) return format(value);
  return 'R$ ••••';
}
