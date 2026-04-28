import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatCurrencyInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 'R$ 0,00';
  const cents = parseInt(digits, 10);
  return formatCurrency(cents / 100);
}

export function parseCurrencyInput(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}

export function formatDate(iso: string, pattern: string = "dd 'de' MMMM 'de' yyyy"): string {
  try {
    return format(parseISO(iso), pattern, { locale: ptBR });
  } catch {
    return iso;
  }
}

export function formatShortDate(iso: string): string {
  try {
    return format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return iso;
  }
}

export function formatMonthYear(date: Date = new Date()): string {
  const s = format(date, "MMMM 'de' yyyy", { locale: ptBR });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function getCurrentMonthKey(date: Date = new Date()): string {
  return format(date, 'yyyy-MM');
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export type PeriodGranularity = 'week' | 'month' | 'quarter' | 'year';

export function getPeriodKey(iso: string, granularity: PeriodGranularity): string {
  try {
    const d = parseISO(iso);
    const year = d.getFullYear();
    if (granularity === 'year') return String(year);
    if (granularity === 'month') return format(d, 'yyyy-MM');
    if (granularity === 'quarter') {
      const q = Math.floor(d.getMonth() / 3) + 1;
      return `${year}-Q${q}`;
    }
    return format(d, "RRRR-'W'II");
  } catch {
    return iso.slice(0, 7);
  }
}

export function formatPeriodLabel(key: string, granularity: PeriodGranularity): string {
  if (granularity === 'year') return key;
  if (granularity === 'quarter') return key.replace('-Q', ' · T');
  if (granularity === 'month') {
    try {
      return format(parseISO(`${key}-01`), "MMM/yy", { locale: ptBR });
    } catch {
      return key;
    }
  }
  return key.replace('-W', ' · S');
}

export function formatPercentDelta(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? '0%' : '—';
  const delta = ((current - previous) / Math.abs(previous)) * 100;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%`;
}
