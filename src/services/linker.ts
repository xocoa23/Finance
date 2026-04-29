import { storage } from './storage';
import {
  Transaction,
  Installment,
  FixedExpense,
  ExpectedExpense,
  Goal,
  Category,
  GoalContribution,
  InstallmentPayment,
  TransactionOrigin,
  META_CATEGORY_PREFIX,
  META_CATEGORY_COLOR,
} from '../types';
import { generateId, getCurrentMonthKey } from '../utils/formatters';

export interface PayInstallmentInput {
  installmentId: string;
  index: number;
  data: string;
  observacao?: string;
}

export interface PayFixedInput {
  fixedExpenseId: string;
  monthKey: string;
  data: string;
  observacao?: string;
}

export interface ContributeGoalInput {
  goalId: string;
  valor: number;
  data: string;
  tipo: 'manual' | 'fixo';
  observacao?: string;
}

function metaCategoryId(goalId: string): string {
  return `${META_CATEGORY_PREFIX}${goalId}`;
}

async function ensureMetaCategory(goal: Goal): Promise<Category> {
  const categories = await storage.getCategories();
  const id = metaCategoryId(goal.id);
  const existing = categories.find((c) => c.id === id);
  const nome = `Meta: ${goal.nome}`;
  if (existing) {
    if (existing.nome !== nome) {
      const updated = categories.map((c) => (c.id === id ? { ...c, nome } : c));
      await storage.setCategories(updated);
      return { ...existing, nome };
    }
    return existing;
  }
  const cat: Category = { id, nome, cor: META_CATEGORY_COLOR };
  await storage.setCategories([...categories, cat]);
  return cat;
}

export async function syncMetaCategoryName(goal: Goal): Promise<void> {
  await ensureMetaCategory(goal);
}

async function createTransaction(
  partial: Omit<Transaction, 'id' | 'criadoEm'> & { id?: string },
): Promise<Transaction> {
  const tx: Transaction = {
    id: partial.id ?? generateId(),
    descricao: partial.descricao,
    tipo: partial.tipo,
    valor: partial.valor,
    data: partial.data,
    categoriaId: partial.categoriaId,
    observacao: partial.observacao,
    comprovanteUri: partial.comprovanteUri,
    origin: partial.origin,
    criadoEm: new Date().toISOString(),
  };
  const list = await storage.getTransactions();
  await storage.setTransactions([tx, ...list]);
  return tx;
}

async function deleteTransactionById(id: string): Promise<void> {
  const list = await storage.getTransactions();
  await storage.setTransactions(list.filter((t) => t.id !== id));
}

function monthKeyFromDate(data: string): string {
  return data.slice(0, 7);
}

export async function payInstallment(input: PayInstallmentInput): Promise<{
  transaction: Transaction;
  installment: Installment;
}> {
  const installments = await storage.getInstallments();
  const item = installments.find((i) => i.id === input.installmentId);
  if (!item) throw new Error('Parcela nao encontrada');

  const origin: TransactionOrigin = {
    type: 'parcela',
    refId: item.id,
    refIndex: input.index,
  };
  const tx = await createTransaction({
    descricao: `${item.descricao} (parcela ${input.index}/${item.numeroParcelas})`,
    tipo: 'despesa',
    valor: item.valorParcela,
    data: input.data,
    categoriaId: item.categoriaId ?? 'cat-outros',
    observacao: input.observacao,
    origin,
  });

  const pagamentos = (item.pagamentos ?? []).filter((p) => p.index !== input.index);
  pagamentos.push({
    index: input.index,
    transactionId: tx.id,
    paidAt: new Date().toISOString(),
    data: input.data,
  });
  pagamentos.sort((a, b) => a.index - b.index);

  const updated: Installment = {
    ...item,
    pagamentos,
    parcelasPagas: pagamentos.length,
  };
  await storage.setInstallments(
    installments.map((i) => (i.id === updated.id ? updated : i)),
  );

  if (item.linkedFixedExpenseId) {
    const fixed = await storage.getFixedExpenses();
    const fix = fixed.find((f) => f.id === item.linkedFixedExpenseId);
    if (fix) {
      const mk = monthKeyFromDate(input.data);
      const pagamentosPorMes = { ...(fix.pagamentosPorMes ?? {}), [mk]: { transactionId: tx.id, paidAt: new Date().toISOString() } };
      const pagoNoMes = { ...fix.pagoNoMes, [mk]: true };
      const updatedFix: FixedExpense = { ...fix, pagamentosPorMes, pagoNoMes };
      await storage.setFixedExpenses(
        fixed.map((f) => (f.id === fix.id ? updatedFix : f)),
      );
    }
  }

  return { transaction: tx, installment: updated };
}

export async function revertInstallmentPayment(
  installmentId: string,
  index: number,
): Promise<void> {
  const installments = await storage.getInstallments();
  const item = installments.find((i) => i.id === installmentId);
  if (!item) return;
  const pagamento = (item.pagamentos ?? []).find((p) => p.index === index);
  if (!pagamento) return;

  await deleteTransactionById(pagamento.transactionId);

  const pagamentos = (item.pagamentos ?? []).filter((p) => p.index !== index);
  const updated: Installment = {
    ...item,
    pagamentos,
    parcelasPagas: pagamentos.length,
  };
  await storage.setInstallments(
    installments.map((i) => (i.id === updated.id ? updated : i)),
  );

  if (item.linkedFixedExpenseId) {
    const fixed = await storage.getFixedExpenses();
    const fix = fixed.find((f) => f.id === item.linkedFixedExpenseId);
    if (fix) {
      const mk = monthKeyFromDate(pagamento.data);
      const pagamentosPorMes = { ...(fix.pagamentosPorMes ?? {}) };
      delete pagamentosPorMes[mk];
      const pagoNoMes = { ...fix.pagoNoMes };
      delete pagoNoMes[mk];
      const updatedFix: FixedExpense = { ...fix, pagamentosPorMes, pagoNoMes };
      await storage.setFixedExpenses(
        fixed.map((f) => (f.id === fix.id ? updatedFix : f)),
      );
    }
  }
}

export async function payFixedExpense(input: PayFixedInput): Promise<{
  transaction: Transaction;
  fixed: FixedExpense;
}> {
  const fixed = await storage.getFixedExpenses();
  const item = fixed.find((f) => f.id === input.fixedExpenseId);
  if (!item) throw new Error('Gasto fixo nao encontrado');

  const origin: TransactionOrigin = { type: 'fixo', refId: item.id };
  const tx = await createTransaction({
    descricao: item.descricao,
    tipo: 'despesa',
    valor: item.valor,
    data: input.data,
    categoriaId: item.categoriaId,
    observacao: input.observacao,
    origin,
  });

  const pagamentosPorMes = {
    ...(item.pagamentosPorMes ?? {}),
    [input.monthKey]: { transactionId: tx.id, paidAt: new Date().toISOString() },
  };
  const pagoNoMes = { ...item.pagoNoMes, [input.monthKey]: true };
  const updated: FixedExpense = { ...item, pagamentosPorMes, pagoNoMes };
  await storage.setFixedExpenses(
    fixed.map((f) => (f.id === updated.id ? updated : f)),
  );

  if (item.linkedInstallmentId) {
    const installments = await storage.getInstallments();
    const inst = installments.find((i) => i.id === item.linkedInstallmentId);
    if (inst && inst.parcelasPagas < inst.numeroParcelas) {
      const nextIndex = (inst.pagamentos?.length ?? 0) + 1;
      const pagamentos = [...(inst.pagamentos ?? [])];
      pagamentos.push({
        index: nextIndex,
        transactionId: tx.id,
        paidAt: new Date().toISOString(),
        data: input.data,
      });
      const updatedInst: Installment = {
        ...inst,
        pagamentos,
        parcelasPagas: pagamentos.length,
      };
      await storage.setInstallments(
        installments.map((i) => (i.id === updatedInst.id ? updatedInst : i)),
      );
    }
  }

  return { transaction: tx, fixed: updated };
}

export async function unmarkFixedExpense(
  fixedExpenseId: string,
  monthKey: string,
): Promise<void> {
  const fixed = await storage.getFixedExpenses();
  const item = fixed.find((f) => f.id === fixedExpenseId);
  if (!item) return;
  const payment = item.pagamentosPorMes?.[monthKey];
  if (payment) {
    await deleteTransactionById(payment.transactionId);
  }
  const pagamentosPorMes = { ...(item.pagamentosPorMes ?? {}) };
  delete pagamentosPorMes[monthKey];
  const pagoNoMes = { ...item.pagoNoMes };
  delete pagoNoMes[monthKey];
  const updated: FixedExpense = { ...item, pagamentosPorMes, pagoNoMes };
  await storage.setFixedExpenses(
    fixed.map((f) => (f.id === updated.id ? updated : f)),
  );
}

export async function contributeToGoal(input: ContributeGoalInput): Promise<{
  transaction: Transaction;
  goal: Goal;
}> {
  const goals = await storage.getGoals();
  const item = goals.find((g) => g.id === input.goalId);
  if (!item) throw new Error('Meta nao encontrada');

  const cat = await ensureMetaCategory(item);
  const origin: TransactionOrigin = {
    type: input.tipo === 'fixo' ? 'meta_fixo' : 'meta',
    refId: item.id,
  };
  const tx = await createTransaction({
    descricao: input.tipo === 'fixo' ? `Aporte mensal: ${item.nome}` : `Aporte: ${item.nome}`,
    tipo: 'despesa',
    valor: input.valor,
    data: input.data,
    categoriaId: cat.id,
    observacao: input.observacao,
    origin,
  });

  const aportes: GoalContribution[] = [
    ...(item.aportes ?? []),
    { data: input.data, valor: input.valor, transactionId: tx.id, tipo: input.tipo },
  ];
  const updated: Goal = {
    ...item,
    valorAtual: item.valorAtual + input.valor,
    aportes,
  };
  await storage.setGoals(goals.map((g) => (g.id === updated.id ? updated : g)));
  return { transaction: tx, goal: updated };
}

function monthsBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso);
  const b = new Date(toIso);
  return (
    (b.getFullYear() - a.getFullYear()) * 12 +
    (b.getMonth() - a.getMonth())
  );
}

export async function applyGoalsInterest(): Promise<void> {
  const goals = await storage.getGoals();
  const now = new Date();
  const nowKey = getCurrentMonthKey(now);
  const updates: Goal[] = [];
  let changed = false;

  for (const g of goals) {
    if (!g.taxaRendimentoAnual || g.taxaRendimentoAnual <= 0 || g.valorAtual <= 0) {
      updates.push(g);
      continue;
    }
    const last = g.ultimaCapitalizacao ?? g.criadoEm;
    const lastKey = last.slice(0, 7);
    if (lastKey >= nowKey) {
      updates.push(g);
      continue;
    }
    const months = Math.max(0, monthsBetween(`${lastKey}-01`, `${nowKey}-01`));
    if (months <= 0) {
      updates.push(g);
      continue;
    }
    const monthlyRate = Math.pow(1 + g.taxaRendimentoAnual / 100, 1 / 12) - 1;
    const novoValor = g.valorAtual * Math.pow(1 + monthlyRate, months);
    const ganho = novoValor - g.valorAtual;
    if (ganho <= 0.01) {
      updates.push({ ...g, ultimaCapitalizacao: new Date().toISOString() });
    } else {
      const aportes: GoalContribution[] = [
        ...(g.aportes ?? []),
        {
          data: now.toISOString().slice(0, 10),
          valor: Number(ganho.toFixed(2)),
          transactionId: '',
          tipo: 'rendimento',
        },
      ];
      updates.push({
        ...g,
        valorAtual: Number(novoValor.toFixed(2)),
        aportes,
        ultimaCapitalizacao: new Date().toISOString(),
      });
      changed = true;
    }
  }

  if (changed) {
    await storage.setGoals(updates);
  }
}

export async function deleteInstallment(
  id: string,
  cascadeTransactions: boolean,
): Promise<void> {
  const installments = await storage.getInstallments();
  const item = installments.find((i) => i.id === id);
  if (!item) return;

  if (cascadeTransactions && item.pagamentos?.length) {
    const txs = await storage.getTransactions();
    const ids = new Set(item.pagamentos.map((p) => p.transactionId));
    await storage.setTransactions(txs.filter((t) => !ids.has(t.id)));
  }

  if (item.linkedFixedExpenseId) {
    const fixed = await storage.getFixedExpenses();
    await storage.setFixedExpenses(
      fixed.filter((f) => f.id !== item.linkedFixedExpenseId),
    );
  }

  await storage.setInstallments(installments.filter((i) => i.id !== id));
}

export interface PayExpectedInput {
  expectedExpenseId: string;
  data: string;
  valor?: number;
  observacao?: string;
  keepAfterPayment?: boolean;
  monthKey?: string;
}

export async function payExpectedExpense(input: PayExpectedInput): Promise<{
  transaction: Transaction;
}> {
  const expected = await storage.getExpectedExpenses();
  const item = expected.find((e) => e.id === input.expectedExpenseId);
  if (!item) throw new Error('Gasto esperado nao encontrado');

  const tx = await createTransaction({
    descricao: item.descricao,
    tipo: 'despesa',
    valor: input.valor ?? item.valor,
    data: input.data,
    categoriaId: item.categoriaId,
    observacao: input.observacao ?? item.observacao,
    origin: { type: 'fixo', refId: item.id }, // Keeping type 'fixo' or 'esperado' if supported
  });

  if (input.keepAfterPayment && input.monthKey) {
    const pagamentosPorMes = {
      ...(item.pagamentosPorMes ?? {}),
      [input.monthKey]: { transactionId: tx.id, paidAt: new Date().toISOString() },
    };
    const pagoNoMes = { ...(item.pagoNoMes ?? {}), [input.monthKey]: true };
    const updated = { ...item, pagamentosPorMes, pagoNoMes };
    await storage.setExpectedExpenses(expected.map((e) => e.id === item.id ? updated : e));
  } else {
    await storage.setExpectedExpenses(expected.filter((e) => e.id !== item.id));
  }

  return { transaction: tx };
}

export async function unmarkExpectedExpense(
  expectedExpenseId: string,
  monthKey: string,
): Promise<void> {
  const expected = await storage.getExpectedExpenses();
  const item = expected.find((e) => e.id === expectedExpenseId);
  if (!item) return;
  const payment = item.pagamentosPorMes?.[monthKey];
  if (payment) {
    await deleteTransactionById(payment.transactionId);
  }
  const pagamentosPorMes = { ...(item.pagamentosPorMes ?? {}) };
  delete pagamentosPorMes[monthKey];
  const pagoNoMes = { ...item.pagoNoMes };
  delete pagoNoMes[monthKey];
  const updated = { ...item, pagamentosPorMes, pagoNoMes };
  await storage.setExpectedExpenses(
    expected.map((e) => (e.id === updated.id ? updated : e)),
  );
}

export async function deleteExpectedExpense(id: string, cascadeTransactions: boolean = false): Promise<void> {
  const expected = await storage.getExpectedExpenses();
  const item = expected.find((e) => e.id === id);
  if (!item) return;

  if (cascadeTransactions && item.pagamentosPorMes) {
    const txs = await storage.getTransactions();
    const ids = new Set(Object.values(item.pagamentosPorMes).map((p) => p.transactionId));
    await storage.setTransactions(txs.filter((t) => !ids.has(t.id)));
  }

  await storage.setExpectedExpenses(expected.filter((e) => e.id !== id));
}

export async function deleteFixedExpense(
  id: string,
  cascadeTransactions: boolean,
): Promise<void> {
  const fixed = await storage.getFixedExpenses();
  const item = fixed.find((f) => f.id === id);
  if (!item) return;

  if (cascadeTransactions && item.pagamentosPorMes) {
    const txs = await storage.getTransactions();
    const ids = new Set(Object.values(item.pagamentosPorMes).map((p) => p.transactionId));
    await storage.setTransactions(txs.filter((t) => !ids.has(t.id)));
  }

  await storage.setFixedExpenses(fixed.filter((f) => f.id !== id));
}

export async function deleteGoal(
  id: string,
  cascadeTransactions: boolean,
): Promise<void> {
  const goals = await storage.getGoals();
  const item = goals.find((g) => g.id === id);
  if (!item) return;

  if (cascadeTransactions && item.aportes?.length) {
    const txs = await storage.getTransactions();
    const ids = new Set(item.aportes.map((a) => a.transactionId).filter(Boolean));
    await storage.setTransactions(txs.filter((t) => !ids.has(t.id)));
  }

  await storage.setGoals(goals.filter((g) => g.id !== id));
}

export async function createInstallmentWithLinkedFixed(
  base: Omit<Installment, 'id' | 'criadoEm' | 'pagamentos' | 'parcelasPagas' | 'valorParcela' | 'linkedFixedExpenseId'> & {
    parcelasPagas?: number;
  },
): Promise<{ installment: Installment; fixed?: FixedExpense }> {
  const installmentId = generateId();
  const fixedId = generateId();
  const valorParcela = base.valorTotal / base.numeroParcelas;

  const fixed: FixedExpense | undefined = base.diaVencimento
    ? {
        id: fixedId,
        descricao: base.descricao,
        valor: valorParcela,
        categoriaId: base.categoriaId ?? 'cat-outros',
        diaVencimento: base.diaVencimento,
        pagoNoMes: {},
        pagamentosPorMes: {},
        linkedInstallmentId: installmentId,
        criadoEm: new Date().toISOString(),
      }
    : undefined;

  const installment: Installment = {
    id: installmentId,
    descricao: base.descricao,
    valorTotal: base.valorTotal,
    numeroParcelas: base.numeroParcelas,
    parcelasPagas: base.parcelasPagas ?? 0,
    valorParcela,
    categoriaId: base.categoriaId,
    diaVencimento: base.diaVencimento,
    primeiroVencimento: base.primeiroVencimento,
    pagamentos: [],
    linkedFixedExpenseId: fixed?.id,
    criadoEm: new Date().toISOString(),
  };

  const list = await storage.getInstallments();
  await storage.setInstallments([...list, installment]);

  if (fixed) {
    const fixedList = await storage.getFixedExpenses();
    await storage.setFixedExpenses([...fixedList, fixed]);
  }

  return { installment, fixed };
}

export async function recalculateInstallmentValor(
  id: string,
  newTotal: number,
  newNumeroParcelas: number,
): Promise<Installment> {
  const installments = await storage.getInstallments();
  const item = installments.find((i) => i.id === id);
  if (!item) throw new Error('Parcela nao encontrada');

  const valorParcela = newTotal / newNumeroParcelas;
  const updated: Installment = {
    ...item,
    valorTotal: newTotal,
    numeroParcelas: newNumeroParcelas,
    valorParcela,
    parcelasPagas: Math.min(item.parcelasPagas, newNumeroParcelas),
    pagamentos: (item.pagamentos ?? []).filter((p) => p.index <= newNumeroParcelas),
  };
  await storage.setInstallments(
    installments.map((i) => (i.id === updated.id ? updated : i)),
  );

  if (item.linkedFixedExpenseId) {
    const fixed = await storage.getFixedExpenses();
    const fix = fixed.find((f) => f.id === item.linkedFixedExpenseId);
    if (fix) {
      const updatedFix: FixedExpense = { ...fix, valor: valorParcela };
      await storage.setFixedExpenses(
        fixed.map((f) => (f.id === fix.id ? updatedFix : f)),
      );
    }
  }
  return updated;
}
