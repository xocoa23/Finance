import { useCallback, useEffect, useState } from 'react';
import { storage, subscribe } from '../services/storage';
import { STORAGE_KEYS, SalarioAjusteTipo } from '../types';

export interface SalarioConfig {
  base: number;
  ajusteValor: number;
  ajusteTipo: SalarioAjusteTipo;
  ajusteEhPorcentagem: boolean;
}

export function calcRendaLiquida(c: SalarioConfig): number {
  if (!c.ajusteValor || c.ajusteValor === 0) return c.base;
  const delta = c.ajusteEhPorcentagem
    ? (c.base * c.ajusteValor) / 100
    : c.ajusteValor;
  return c.ajusteTipo === 'soma' ? c.base + delta : c.base - delta;
}

export interface UseMonthlyIncomeResult {
  rendaLiquida: number;
  config: SalarioConfig;
  setBase: (value: number) => Promise<void>;
  setAjuste: (
    valor: number,
    tipo: SalarioAjusteTipo,
    ehPorcentagem: boolean,
  ) => Promise<void>;
}

const DEFAULT_CONFIG: SalarioConfig = {
  base: 0,
  ajusteValor: 0,
  ajusteTipo: 'subtracao',
  ajusteEhPorcentagem: false,
};

export function useMonthlyIncome(): UseMonthlyIncomeResult {
  const [config, setConfig] = useState<SalarioConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const settings = await storage.getSettings();
      if (!alive) return;
      setConfig({
        base: settings.rendaMensal ?? 0,
        ajusteValor: settings.salarioAjusteValor ?? 0,
        ajusteTipo: settings.salarioAjusteTipo ?? 'subtracao',
        ajusteEhPorcentagem: settings.salarioAjusteEhPorcentagem ?? false,
      });
    };
    load();
    const unsub = subscribe(STORAGE_KEYS.SETTINGS, load);
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  const setBase = useCallback(async (value: number) => {
    const current = await storage.getSettings();
    await storage.setSettings({ ...current, rendaMensal: value });
  }, []);

  const setAjuste = useCallback(
    async (valor: number, tipo: SalarioAjusteTipo, ehPorcentagem: boolean) => {
      const current = await storage.getSettings();
      await storage.setSettings({
        ...current,
        salarioAjusteValor: valor,
        salarioAjusteTipo: tipo,
        salarioAjusteEhPorcentagem: ehPorcentagem,
      });
    },
    [],
  );

  return {
    rendaLiquida: calcRendaLiquida(config),
    config,
    setBase,
    setAjuste,
  };
}
