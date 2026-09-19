/**
 * Substituto do expo-crypto APENAS na versão web de demonstração.
 *
 * O app guarda o PIN como SHA-256(salt:pin:salt). Na demo, qualquer PIN de 4
 * dígitos deve abrir o app, então o hash devolvido é sempre o mesmo valor
 * (o que também foi gravado como "hash do PIN" pelos dados de exemplo).
 * O resto do expo-crypto (bytes aleatórios etc.) continua o original.
 */
export * from 'expo-crypto-original'

export const HASH_DEMO = 'pin-de-demonstracao-qualquer-combinacao'

export async function digestStringAsync() {
  return HASH_DEMO
}
