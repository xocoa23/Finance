import { createContext, useContext } from 'react';

export type AuthState = 'loading' | 'setup' | 'locked' | 'unlocked';

export interface AuthContextValue {
  state: AuthState;
  biometricAvailable: boolean;
  biometricLabel: string;
  biometricEnabled: boolean;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithBiometric: () => Promise<boolean>;
  setupPin: (pin: string, enableBiometric: boolean) => Promise<void>;
  changePin: (currentPin: string, newPin: string) => Promise<boolean>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  lock: () => void;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
