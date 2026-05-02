import { useCallback, useEffect, useState } from 'react';
import { storage, subscribe } from '../services/storage';
import { STORAGE_KEYS, SalarioAjuste } from '../types';

export function calcRendaLiquida(base: number, ajustes: SalarioAjuste[]): number {
  return ajustes.reduce((acc, a) => {
    const delta = a.ehPorcentagem ? (base * a.valor) / 100 : a.valor;
    return a.tipo === 'soma' ? acc + delta : Math.max(0, acc - delta);
  }, base);
}

export interface UseMonthlyIncomeResult {
  rendaLiquida: number;
  base: number;
  ajustes: SalarioAjuste[];
  setBase: (value: number) => Promise<void>;
  setAjustes: (ajustes: SalarioAjuste[]) => Promise<void>;
}

export function useMonthlyIncome(): UseMonthlyIncomeResult {
  const [base, setBaseState] = useState(0);
  const [ajustes, setAjustesState] = useState<SalarioAjuste[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const settings = await storage.getSettings();
      if (!alive) return;
      setBaseState(settings.rendaMensal ?? 0);

      if (settings.salarioAjustes && settings.salarioAjustes.length > 0) {
        setAjustesState(settings.salarioAjustes);
      } else if (settings.salarioAjusteValor && settings.salarioAjusteValor > 0) {
        // Migrate from old single-adjustment format
        const migrated: SalarioAjuste = {
          id: 'ajuste-migrado',
          descricao: settings.salarioAjusteTipo === 'soma' ? 'Bônus' : 'Desconto',
          valor: settings.salarioAjusteValor,
          tipo: settings.salarioAjusteTipo ?? 'subtracao',
          ehPorcentagem: settings.salarioAjusteEhPorcentagem ?? false,
        };
        setAjustesState([migrated]);
      } else {
        setAjustesState([]);
      }
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

  const setAjustes = useCallback(async (newAjustes: SalarioAjuste[]) => {
    const current = await storage.getSettings();
    await storage.setSettings({ ...current, salarioAjustes: newAjustes });
  }, []);

  return {
    rendaLiquida: calcRendaLiquida(base, ajustes),
    base,
    ajustes,
    setBase,
    setAjustes,
  };
}
