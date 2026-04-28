import * as LocalAuthentication from 'expo-local-authentication';
import { generateSalt, hashPin, verifyPin } from '../utils/crypto';
import { storage } from './storage';
import { STORAGE_KEYS } from '../types';

export const auth = {
  async isPinSet(): Promise<boolean> {
    const hash = await storage.getRaw(STORAGE_KEYS.PIN_HASH);
    return !!hash;
  },

  async setPin(pin: string): Promise<void> {
    if (!/^\d{4}$/.test(pin)) {
      throw new Error('PIN deve conter exatamente 4 dígitos');
    }
    const salt = await generateSalt();
    const hash = await hashPin(pin, salt);
    await storage.setRaw(STORAGE_KEYS.PIN_SALT, salt);
    await storage.setRaw(STORAGE_KEYS.PIN_HASH, hash);
  },

  async checkPin(pin: string): Promise<boolean> {
    const [hash, salt] = await Promise.all([
      storage.getRaw(STORAGE_KEYS.PIN_HASH),
      storage.getRaw(STORAGE_KEYS.PIN_SALT),
    ]);
    if (!hash || !salt) return false;
    return verifyPin(pin, hash, salt);
  },

  async hasBiometricSupport(): Promise<boolean> {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hasHardware && isEnrolled;
  },

  async getBiometricLabel(): Promise<string> {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'Face ID';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'Impressão digital';
    }
    return 'Biometria';
  },

  async authenticateBiometric(): Promise<boolean> {
    const supported = await this.hasBiometricSupport();
    if (!supported) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Desbloqueie suas finanças',
      cancelLabel: 'Usar PIN',
      fallbackLabel: 'Usar PIN',
      disableDeviceFallback: false,
    });
    return result.success;
  },

  async setBiometricEnabled(enabled: boolean): Promise<void> {
    const settings = await storage.getSettings();
    await storage.setSettings({ ...settings, biometriaAtiva: enabled });
  },

  async isBiometricEnabled(): Promise<boolean> {
    const settings = await storage.getSettings();
    return settings.biometriaAtiva;
  },

  async resetAll(): Promise<void> {
    await storage.deleteRaw(STORAGE_KEYS.PIN_HASH);
    await storage.deleteRaw(STORAGE_KEYS.PIN_SALT);
  },
};
