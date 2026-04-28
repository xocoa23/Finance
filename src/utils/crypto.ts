import * as Crypto from 'expo-crypto';

export async function generateSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const input = `${salt}:${pin}:${salt}`;
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
}

export async function verifyPin(pin: string, hash: string, salt: string): Promise<boolean> {
  const computed = await hashPin(pin, salt);
  return computed === hash;
}
