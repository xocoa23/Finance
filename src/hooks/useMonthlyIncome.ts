import { useCallback, useEffect, useState } from 'react';
import { storage, subscribe } from '../services/storage';
import { STORAGE_KEYS } from '../types';

export function useMonthlyIncome(): [number, (value: number) => Promise<void>] {
  const [renda, setRenda] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const settings = await storage.getSettings();
      if (alive) setRenda(settings.rendaMensal ?? 0);
    };
    load();
    const unsub = subscribe(STORAGE_KEYS.SETTINGS, load);
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  const update = useCallback(async (value: number) => {
    const current = await storage.getSettings();
    await storage.setSettings({ ...current, rendaMensal: value });
  }, []);

  return [renda, update];
}
