import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Transaction,
  FixedExpense,
  Installment,
  Goal,
  Category,
  AppSettings,
  STORAGE_KEYS,
  DEFAULT_CATEGORIES,
} from '../types';

const SECURE_STORE_LIMIT = 2000;

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

export function subscribe(key: string, fn: Listener): () => void {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(fn);
  return () => {
    listeners.get(key)?.delete(fn);
  };
}

function notify(key: string) {
  listeners.get(key)?.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

async function setSecureValue(key: string, value: string): Promise<void> {
  if (value.length < SECURE_STORE_LIMIT) {
    await SecureStore.setItemAsync(key, value);
    await AsyncStorage.removeItem(`fallback:${key}`);
  } else {
    await AsyncStorage.setItem(`fallback:${key}`, value);
    await SecureStore.deleteItemAsync(key).catch(() => {});
  }
}

async function getSecureValue(key: string): Promise<string | null> {
  const secure = await SecureStore.getItemAsync(key).catch(() => null);
  if (secure !== null) return secure;
  return AsyncStorage.getItem(`fallback:${key}`);
}

async function setJson<T>(key: string, value: T): Promise<void> {
  await setSecureValue(key, JSON.stringify(value));
}

async function getJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await getSecureValue(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const storage = {
  async getTransactions(): Promise<Transaction[]> {
    return getJson<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
  },
  async setTransactions(list: Transaction[]): Promise<void> {
    await setJson(STORAGE_KEYS.TRANSACTIONS, list);
    notify(STORAGE_KEYS.TRANSACTIONS);
  },

  async getFixedExpenses(): Promise<FixedExpense[]> {
    return getJson<FixedExpense[]>(STORAGE_KEYS.FIXED_EXPENSES, []);
  },
  async setFixedExpenses(list: FixedExpense[]): Promise<void> {
    await setJson(STORAGE_KEYS.FIXED_EXPENSES, list);
    notify(STORAGE_KEYS.FIXED_EXPENSES);
  },

  async getInstallments(): Promise<Installment[]> {
    return getJson<Installment[]>(STORAGE_KEYS.INSTALLMENTS, []);
  },
  async setInstallments(list: Installment[]): Promise<void> {
    await setJson(STORAGE_KEYS.INSTALLMENTS, list);
    notify(STORAGE_KEYS.INSTALLMENTS);
  },

  async getGoals(): Promise<Goal[]> {
    return getJson<Goal[]>(STORAGE_KEYS.GOALS, []);
  },
  async setGoals(list: Goal[]): Promise<void> {
    await setJson(STORAGE_KEYS.GOALS, list);
    notify(STORAGE_KEYS.GOALS);
  },

  async getCategories(): Promise<Category[]> {
    return getJson<Category[]>(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
  },
  async setCategories(list: Category[]): Promise<void> {
    await setJson(STORAGE_KEYS.CATEGORIES, list);
    notify(STORAGE_KEYS.CATEGORIES);
  },

  async getSettings(): Promise<AppSettings> {
    return getJson<AppSettings>(STORAGE_KEYS.SETTINGS, {
      biometriaAtiva: false,
      ultimoBackground: null,
      primeiraAbertura: true,
      ocultarValores: false,
      rendaMensal: 0,
    });
  },
  async setSettings(settings: AppSettings): Promise<void> {
    await setJson(STORAGE_KEYS.SETTINGS, settings);
    notify(STORAGE_KEYS.SETTINGS);
  },

  async getRaw(key: string): Promise<string | null> {
    return getSecureValue(key);
  },
  async setRaw(key: string, value: string): Promise<void> {
    await setSecureValue(key, value);
  },
  async deleteRaw(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key).catch(() => {});
    await AsyncStorage.removeItem(`fallback:${key}`);
  },

  async exportAll() {
    const [transactions, fixedExpenses, installments, goals, categories] = await Promise.all([
      this.getTransactions(),
      this.getFixedExpenses(),
      this.getInstallments(),
      this.getGoals(),
      this.getCategories(),
    ]);
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { transactions, fixedExpenses, installments, goals, categories },
    };
  },

  async importAll(payload: any): Promise<void> {
    if (!payload?.data) throw new Error('Backup inválido');
    const d = payload.data;
    if (Array.isArray(d.transactions)) await this.setTransactions(d.transactions);
    if (Array.isArray(d.fixedExpenses)) await this.setFixedExpenses(d.fixedExpenses);
    if (Array.isArray(d.installments)) await this.setInstallments(d.installments);
    if (Array.isArray(d.goals)) await this.setGoals(d.goals);
    if (Array.isArray(d.categories)) await this.setCategories(d.categories);
  },
};
