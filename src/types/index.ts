export type TransactionType = 'receita' | 'despesa';

export interface Category {
  id: string;
  nome: string;
  cor: string;
  icone?: string;
}

export interface Transaction {
  id: string;
  descricao: string;
  tipo: TransactionType;
  valor: number;
  data: string;
  categoriaId: string;
  observacao?: string;
  comprovanteUri?: string;
  criadoEm: string;
}

export interface FixedExpense {
  id: string;
  descricao: string;
  valor: number;
  categoriaId: string;
  diaVencimento: number;
  pagoNoMes: Record<string, boolean>;
  comprovanteUri?: string;
  criadoEm: string;
}

export interface Installment {
  id: string;
  descricao: string;
  valorTotal: number;
  numeroParcelas: number;
  parcelasPagas: number;
  valorParcela: number;
  categoriaId?: string;
  criadoEm: string;
}

export interface Goal {
  id: string;
  nome: string;
  valorObjetivo: number;
  valorAtual: number;
  dataLimite?: string;
  criadoEm: string;
}

export interface AppSettings {
  biometriaAtiva: boolean;
  ultimoBackground: number | null;
  primeiraAbertura: boolean;
  ocultarValores: boolean;
  rendaMensal: number;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-alimentacao', nome: 'Alimentação', cor: '#ff6b6b' },
  { id: 'cat-transporte', nome: 'Transporte', cor: '#4ecdc4' },
  { id: 'cat-moradia', nome: 'Moradia', cor: '#ffe66d' },
  { id: 'cat-lazer', nome: 'Lazer', cor: '#a8e6cf' },
  { id: 'cat-saude', nome: 'Saúde', cor: '#ff8b94' },
  { id: 'cat-educacao', nome: 'Educação', cor: '#c7ceea' },
  { id: 'cat-salario', nome: 'Salário', cor: '#00d4aa' },
  { id: 'cat-outros', nome: 'Outros', cor: '#b8b8b8' },
];

export const STORAGE_KEYS = {
  PIN_HASH: 'pin_hash',
  PIN_SALT: 'pin_salt',
  TRANSACTIONS: 'transactions',
  FIXED_EXPENSES: 'fixed_expenses',
  INSTALLMENTS: 'installments',
  GOALS: 'goals',
  CATEGORIES: 'categories',
  SETTINGS: 'app_settings',
} as const;

export const COLORS = {
  background: '#0a0a0b',
  card: '#15161a',
  cardElevated: '#1d1f24',
  primary: '#3ddc97',
  primaryDim: '#2eb87b',
  primarySoft: 'rgba(61, 220, 151, 0.12)',
  danger: '#ff6b6b',
  dangerSoft: 'rgba(255, 107, 107, 0.12)',
  warning: '#ffc070',
  warningSoft: 'rgba(255, 192, 112, 0.12)',
  text: '#f7f7f8',
  textSecondary: '#9a9ba0',
  textMuted: '#5e6066',
  border: '#23252b',
  borderSoft: '#1a1c20',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const SESSION_TIMEOUT_MS = 5 * 60 * 1000;
