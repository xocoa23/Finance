/**
 * Substituto do expo-secure-store APENAS para a versão web de demonstração.
 *
 * No celular, os dados ficam no Keychain (iOS) / Keystore (Android). Na web esse
 * cofre não existe, então a demo guarda tudo no localStorage do próprio visitante.
 * Na primeira visita, preenche o app com dados FICTÍCIOS e com o PIN de demonstração 1234,
 * para quem abrir o portfólio ver o app em uso (e não uma tela vazia).
 */

const PREFIX = 'secure:'
const SEED_FLAG = 'demo:seeded:v1'
const DEMO_PIN = '1234'
const DEMO_SALT = '5f1d0c9a7e3b4a2c8d6e0f1a2b3c4d5e'

let seeding = null

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const pad = (n) => String(n).padStart(2, '0')
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function buildDemoData() {
  const now = new Date()
  const created = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString()
  const thisMonth = monthKey(now)
  const lastMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 15))
  let id = 0
  const tx = (descricao, tipo, valor, dias, categoriaId) => ({
    id: `demo-${++id}`,
    descricao,
    tipo,
    valor,
    data: isoDate(daysAgo(dias)),
    categoriaId,
    criadoEm: daysAgo(dias).toISOString(),
  })

  const transactions = [
    tx('Salário', 'receita', 2400, Math.min(now.getDate() - 1, 4), 'cat-salario'),
    tx('Mercado', 'despesa', 186.4, 1, 'cat-alimentacao'),
    tx('Uber', 'despesa', 23.9, 2, 'cat-transporte'),
    tx('Farmácia', 'despesa', 47.3, 3, 'cat-saude'),
    tx('Cinema', 'despesa', 58, 5, 'cat-lazer'),
    tx('Padaria', 'despesa', 18.5, 6, 'cat-alimentacao'),
    tx('Freela: landing page', 'receita', 650, 9, 'cat-outros'),
    tx('Livro técnico', 'despesa', 89.9, 11, 'cat-educacao'),
    tx('Ônibus (recarga)', 'despesa', 60, 13, 'cat-transporte'),
    tx('Salário', 'receita', 2400, 33, 'cat-salario'),
    tx('Mercado', 'despesa', 212.7, 35, 'cat-alimentacao'),
    tx('Show', 'despesa', 120, 40, 'cat-lazer'),
    tx('Consulta', 'despesa', 150, 44, 'cat-saude'),
  ]

  const fixedExpenses = [
    { id: 'fx-1', descricao: 'Aluguel', valor: 900, categoriaId: 'cat-moradia', diaVencimento: 5, pagoNoMes: { [thisMonth]: true, [lastMonth]: true }, criadoEm: created },
    { id: 'fx-2', descricao: 'Internet', valor: 99.9, categoriaId: 'cat-moradia', diaVencimento: 10, pagoNoMes: { [thisMonth]: true, [lastMonth]: true }, criadoEm: created },
    { id: 'fx-3', descricao: 'Faculdade', valor: 520, categoriaId: 'cat-educacao', diaVencimento: 15, pagoNoMes: { [lastMonth]: true }, criadoEm: created },
    { id: 'fx-4', descricao: 'Academia', valor: 89.9, categoriaId: 'cat-saude', diaVencimento: 20, pagoNoMes: { [lastMonth]: true }, criadoEm: created },
  ]

  const installments = [
    { id: 'in-1', descricao: 'Notebook', valorTotal: 3600, numeroParcelas: 12, parcelasPagas: 5, valorParcela: 300, categoriaId: 'cat-educacao', diaVencimento: 12, criadoEm: created },
  ]

  const goals = [
    { id: 'gl-1', nome: 'Reserva de emergência', valorObjetivo: 6000, valorAtual: 2350, criadoEm: created },
    { id: 'gl-2', nome: 'Viagem', valorObjetivo: 2500, valorAtual: 800, criadoEm: created },
  ]

  const settings = {
    biometriaAtiva: false,
    ultimoBackground: null,
    primeiraAbertura: false,
    ocultarValores: false,
    rendaMensal: 2400,
    tema: 'dark',
  }

  return { transactions, fixed_expenses: fixedExpenses, installments, goals, app_settings: settings }
}

async function seedOnce() {
  if (typeof localStorage === 'undefined' || localStorage.getItem(SEED_FLAG)) return
  if (!seeding) {
    seeding = (async () => {
      const data = buildDemoData()
      for (const [key, value] of Object.entries(data)) {
        localStorage.setItem(PREFIX + key, JSON.stringify(value))
      }
      localStorage.setItem(PREFIX + 'pin_salt', DEMO_SALT)
      localStorage.setItem(PREFIX + 'pin_hash', await sha256Hex(`${DEMO_SALT}:${DEMO_PIN}:${DEMO_SALT}`))
      localStorage.setItem(SEED_FLAG, '1')
    })()
  }
  await seeding
}

export async function isAvailableAsync() {
  return true
}

export async function getItemAsync(key) {
  await seedOnce()
  return localStorage.getItem(PREFIX + key)
}

export async function setItemAsync(key, value) {
  await seedOnce()
  localStorage.setItem(PREFIX + key, value)
}

export async function deleteItemAsync(key) {
  localStorage.removeItem(PREFIX + key)
}

export default { isAvailableAsync, getItemAsync, setItemAsync, deleteItemAsync }
