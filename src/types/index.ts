export type TransactionType = 'receita' | 'despesa';

export type TransactionOriginType = 'parcela' | 'fixo' | 'meta' | 'meta_fixo' | 'esperado';

export interface TransactionOrigin {
  type: TransactionOriginType;
  refId: string;
  refIndex?: number;
}

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
  origin?: TransactionOrigin;
  criadoEm: string;
}

export interface FixedExpensePayment {
  transactionId: string;
  paidAt: string;
}

export interface FixedExpense {
  id: string;
  descricao: string;
  valor: number;
  categoriaId: string;
  diaVencimento?: number;
  pagoNoMes: Record<string, boolean>;
  pagamentosPorMes?: Record<string, FixedExpensePayment>;
  linkedInstallmentId?: string;
  comprovanteUri?: string;
  criadoEm: string;
}

export interface ExpectedExpense {
  id: string;
  descricao: string;
  valor: number;
  categoriaId: string;
  dataVencimento?: string;
  observacao?: string;
  pagoNoMes?: Record<string, boolean>;
  pagamentosPorMes?: Record<string, { transactionId: string; paidAt: string }>;
  criadoEm: string;
}

export interface InstallmentPayment {
  index: number;
  transactionId: string;
  paidAt: string;
  data: string;
}

export interface Installment {
  id: string;
  descricao: string;
  valorTotal: number;
  numeroParcelas: number;
  parcelasPagas: number;
  valorParcela: number;
  categoriaId?: string;
  diaVencimento?: number;
  primeiroVencimento?: string;
  pagamentos?: InstallmentPayment[];
  linkedFixedExpenseId?: string;
  criadoEm: string;
}

export interface GoalContribution {
  data: string;
  valor: number;
  transactionId: string;
  tipo: 'manual' | 'fixo' | 'rendimento';
}

export interface Goal {
  id: string;
  nome: string;
  valorObjetivo: number;
  valorAtual: number;
  dataLimite?: string;
  taxaRendimentoAnual?: number;
  valorMensalFixo?: number;
  aportes?: GoalContribution[];
  ultimaCapitalizacao?: string;
  criadoEm: string;
}

export type SalarioAjusteTipo = 'soma' | 'subtracao';

export interface SalarioAjuste {
  id: string;
  descricao: string;
  valor: number;
  tipo: SalarioAjusteTipo;
  ehPorcentagem: boolean;
}

export type AppTheme = 'dark' | 'light' | 'auto';
export type AppIcon = 'default' | 'light' | 'auto';

export interface AppSettings {
  biometriaAtiva: boolean;
  ultimoBackground: number | null;
  primeiraAbertura: boolean;
  ocultarValores: boolean;
  rendaMensal: number;
  salarioAjusteValor?: number;
  salarioAjusteTipo?: SalarioAjusteTipo;
  salarioAjusteEhPorcentagem?: boolean;
  salarioAjustes?: SalarioAjuste[];
  tema?: AppTheme;
  iconePreferido?: AppIcon;
  nomeCompleto?: string;
  cpf?: string;
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

export const META_CATEGORY_PREFIX = 'meta-';
export const META_CATEGORY_COLOR = '#7c8aff';

export const STORAGE_KEYS = {
  PIN_HASH: 'pin_hash',
  PIN_SALT: 'pin_salt',
  TRANSACTIONS: 'transactions',
  FIXED_EXPENSES: 'fixed_expenses',
  EXPECTED_EXPENSES: 'expected_expenses',
  INSTALLMENTS: 'installments',
  GOALS: 'goals',
  CATEGORIES: 'categories',
  SETTINGS: 'app_settings',
} as const;

export const darkColors = {
  background: '#0a0a0b',
  card: '#15161a',
  cardElevated: '#1d1f24',
  primary: '#00d4aa',
  primaryDim: '#00b38f',
  primarySoft: 'rgba(0, 212, 170, 0.12)',
  danger: '#ff453a',
  dangerSoft: 'rgba(255, 69, 58, 0.12)',
  warning: '#ffc070',
  warningSoft: 'rgba(255, 192, 112, 0.12)',
  text: '#f7f7f8',
  textSecondary: '#9a9ba0',
  textMuted: '#5e6066',
  border: '#23252b',
  borderSoft: '#1a1c20',
};

export const lightColors = {
  background: '#f7f7f8',
  card: '#ffffff',
  cardElevated: '#f0f0f2',
  primary: '#00d4aa',
  primaryDim: '#00b38f',
  primarySoft: 'rgba(0, 212, 170, 0.12)',
  danger: '#ff453a',
  dangerSoft: 'rgba(255, 69, 58, 0.12)',
  warning: '#ffc070',
  warningSoft: 'rgba(255, 192, 112, 0.12)',
  text: '#0a0a0b',
  textSecondary: '#5e6066',
  textMuted: '#9a9ba0',
  border: '#e5e5e7',
  borderSoft: '#d5d5d8',
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
