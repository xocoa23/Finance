import { useCallback, useEffect, useState } from 'react';
import { storage, subscribe } from '../services/storage';
import {
  Transaction,
  FixedExpense,
  ExpectedExpense,
  Installment,
  Goal,
  Category,
  STORAGE_KEYS,
} from '../types';

export function useTransactions() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const list = await storage.getTransactions();
    list.sort((a, b) => b.data.localeCompare(a.data));
    setItems(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    return subscribe(STORAGE_KEYS.TRANSACTIONS, reload);
  }, [reload]);

  const add = useCallback(async (item: Transaction) => {
    const list = await storage.getTransactions();
    await storage.setTransactions([item, ...list]);
  }, []);

  const update = useCallback(async (item: Transaction) => {
    const list = await storage.getTransactions();
    await storage.setTransactions(list.map((t) => (t.id === item.id ? item : t)));
  }, []);

  const remove = useCallback(async (id: string) => {
    const list = await storage.getTransactions();
    await storage.setTransactions(list.filter((t) => t.id !== id));
  }, []);

  return { items, loading, reload, add, update, remove };
}

export function useFixedExpenses() {
  const [items, setItems] = useState<FixedExpense[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setItems(await storage.getFixedExpenses());
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    return subscribe(STORAGE_KEYS.FIXED_EXPENSES, reload);
  }, [reload]);

  const add = useCallback(async (item: FixedExpense) => {
    const list = await storage.getFixedExpenses();
    await storage.setFixedExpenses([...list, item]);
  }, []);

  const update = useCallback(async (item: FixedExpense) => {
    const list = await storage.getFixedExpenses();
    await storage.setFixedExpenses(list.map((f) => (f.id === item.id ? item : f)));
  }, []);

  const remove = useCallback(async (id: string) => {
    const list = await storage.getFixedExpenses();
    await storage.setFixedExpenses(list.filter((f) => f.id !== id));
  }, []);

  return { items, loading, reload, add, update, remove };
}

export function useExpectedExpenses() {
  const [items, setItems] = useState<ExpectedExpense[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setItems(await storage.getExpectedExpenses());
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    return subscribe(STORAGE_KEYS.EXPECTED_EXPENSES, reload);
  }, [reload]);

  const add = useCallback(async (item: ExpectedExpense) => {
    const list = await storage.getExpectedExpenses();
    await storage.setExpectedExpenses([...list, item]);
  }, []);

  const update = useCallback(async (item: ExpectedExpense) => {
    const list = await storage.getExpectedExpenses();
    await storage.setExpectedExpenses(list.map((e) => (e.id === item.id ? item : e)));
  }, []);

  const remove = useCallback(async (id: string) => {
    const list = await storage.getExpectedExpenses();
    await storage.setExpectedExpenses(list.filter((e) => e.id !== id));
  }, []);

  return { items, loading, reload, add, update, remove };
}

export function useInstallments() {
  const [items, setItems] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setItems(await storage.getInstallments());
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    return subscribe(STORAGE_KEYS.INSTALLMENTS, reload);
  }, [reload]);

  const add = useCallback(async (item: Installment) => {
    const list = await storage.getInstallments();
    await storage.setInstallments([...list, item]);
  }, []);

  const update = useCallback(async (item: Installment) => {
    const list = await storage.getInstallments();
    await storage.setInstallments(list.map((i) => (i.id === item.id ? item : i)));
  }, []);

  const remove = useCallback(async (id: string) => {
    const list = await storage.getInstallments();
    await storage.setInstallments(list.filter((i) => i.id !== id));
  }, []);

  return { items, loading, reload, add, update, remove };
}

export function useGoals() {
  const [items, setItems] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setItems(await storage.getGoals());
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    return subscribe(STORAGE_KEYS.GOALS, reload);
  }, [reload]);

  const add = useCallback(async (item: Goal) => {
    const list = await storage.getGoals();
    await storage.setGoals([...list, item]);
  }, []);

  const update = useCallback(async (item: Goal) => {
    const list = await storage.getGoals();
    await storage.setGoals(list.map((g) => (g.id === item.id ? item : g)));
  }, []);

  const remove = useCallback(async (id: string) => {
    const list = await storage.getGoals();
    await storage.setGoals(list.filter((g) => g.id !== id));
  }, []);

  return { items, loading, reload, add, update, remove };
}

export function useCategories() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setItems(await storage.getCategories());
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    return subscribe(STORAGE_KEYS.CATEGORIES, reload);
  }, [reload]);

  const save = useCallback(async (list: Category[]) => {
    await storage.setCategories(list);
  }, []);

  return { items, loading, reload, save };
}
